/**
 * dedup-no-brand.ts
 *
 * Bridge-pass: matches the ~300 products that have brand="" (mostly DHB
 * inserts — the DHB scraper leaves brand blank) against the ~32K branded
 * products. dedup-merge.ts groups by brand, so no-brand rows can never be
 * compared to branded rows in that pass — this script fills that gap.
 *
 * Matching: Jaccard >= 0.65 on content tokens AND distinguishing tokens
 * (numbers, size codes, letter-codes) must match exactly. The branded row is
 * always canonical (the unbranded DHB row is dropped, with its supplier_product
 * rerouted to the canonical product_id).
 *
 * Run after dedup-merge.ts and sku-fingerprint-dedup.ts.
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const JACCARD_THRESHOLD = 0.65;

const STOP = new Set([
  "a","an","the","and","or","of","for","in","to","with","by","from",
  "pack","box","bag","kit","set","unit","units","each","per",
  "standard","sterile","dental","grade","quality","professional","product","item","uk",
]);

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenise(name: string): Set<string> {
  return new Set(
    normalise(name).split(" ").filter(t => {
      if (!t || STOP.has(t)) return false;
      if (/^\d+$/.test(t)) return true;
      if (/^[a-z]\d+$/i.test(t)) return true;
      if (/^(xs|s|m|l|xl|xxl)$/i.test(t)) return true;
      return t.length >= 2;
    })
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function distinguishingTokens(tokens: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    if (/^\d+$/.test(t)) out.add(t);
    else if (/^\d+(ml|mm|cm|g|mg|kg|l|oz)$/i.test(t)) out.add(t);
    else if (/^[a-z]\d{1,2}$/i.test(t) && t.length <= 4) out.add(t);
    else if (/^(xs|s|m|l|xl|xxl)$/i.test(t)) out.add(t);
  }
  return out;
}

function distinguishingConflict(a: Set<string>, b: Set<string>): boolean {
  const da = distinguishingTokens(a);
  const db = distinguishingTokens(b);

  const cls = (t: string) =>
    /^\d+$/.test(t) ? "num" :
    /^\d+(ml|mm|cm|g|mg|kg|l|oz)$/i.test(t) ? t.replace(/^\d+/, "#") :
    /^[a-z]\d+$/i.test(t) ? t[0].toLowerCase() + "#" :
    /^(xs|s|m|l|xl|xxl)$/i.test(t) ? "size" : "other";

  // Symmetric: same class but different value
  for (const t of da) if (!db.has(t)) {
    if ([...db].some(t2 => cls(t) === cls(t2) && t2 !== t)) return true;
  }
  for (const t of db) if (!da.has(t)) {
    if ([...da].some(t2 => cls(t) === cls(t2) && t2 !== t)) return true;
  }
  // Asymmetric size letter / letter+digit — high-discriminative
  const isSize = (t: string) => /^(xs|s|m|l|xl|xxl)$/i.test(t);
  const isCode = (t: string) => /^[a-z]\d{1,2}$/i.test(t) && t.length <= 4;
  for (const t of da) if (isSize(t) && !db.has(t)) return true;
  for (const t of db) if (isSize(t) && !da.has(t)) return true;
  for (const t of da) if (isCode(t) && !db.has(t)) return true;
  for (const t of db) if (isCode(t) && !da.has(t)) return true;
  return false;
}

interface Product {
  id: number;
  name: string;
  brand: string;
  image: string;
  tokens: Set<string>;
  suppliers: number[];
}

async function loadAll(): Promise<Product[]> {
  const all: Product[] = [];
  let off = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await sb.from("dentago_products")
      .select("id, name, brand, image")
      .range(off, off + PAGE - 1).order("id");
    if (!data || data.length === 0) break;
    for (const p of data) {
      all.push({ ...p, tokens: tokenise(p.name ?? ""), suppliers: [] });
    }
    if (data.length < PAGE) break;
    off += PAGE;
  }
  return all;
}

async function loadSupplierMap(): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  let off = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await sb.from("dentago_supplier_products")
      .select("product_id, supplier_id").range(off, off + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (!map.has(r.product_id)) map.set(r.product_id, []);
      map.get(r.product_id)!.push(r.supplier_id);
    }
    if (data.length < PAGE) break;
    off += PAGE;
  }
  return map;
}

async function mergePair(keepId: number, dropId: number): Promise<void> {
  if (DRY_RUN) return;
  // Pull both sides with full row data so we can compare prices on collision
  const { data: dropSPs } = await sb.from("dentago_supplier_products")
    .select("id, supplier_id, price").eq("product_id", dropId);
  const { data: keepSPs } = await sb.from("dentago_supplier_products")
    .select("id, supplier_id, price").eq("product_id", keepId);

  const keepBySup = new Map<number, { id: number; price: number }>();
  for (const r of keepSPs ?? []) keepBySup.set(r.supplier_id, { id: r.id, price: Number(r.price) });

  for (const sp of dropSPs ?? []) {
    const existing = keepBySup.get(sp.supplier_id);
    if (existing) {
      // Same supplier on both sides → keep the LOWER price. This guards against
      // data loss when the catalog has multiple SKUs per (supplier, product) —
      // e.g. DHB had CLI004 £6.99 + CLI005 £6.38 for the same Clinell wipes.
      if (Number(sp.price) < existing.price) {
        await sb.from("dentago_supplier_products").delete().eq("id", existing.id);
        await sb.from("dentago_supplier_products")
          .update({ product_id: keepId }).eq("id", sp.id);
        keepBySup.set(sp.supplier_id, { id: sp.id, price: Number(sp.price) });
      } else {
        await sb.from("dentago_supplier_products").delete().eq("id", sp.id);
      }
    } else {
      await sb.from("dentago_supplier_products")
        .update({ product_id: keepId }).eq("id", sp.id);
      keepBySup.set(sp.supplier_id, { id: sp.id, price: Number(sp.price) });
    }
  }
  await sb.from("dentago_products").delete().eq("id", dropId);
}

async function main() {
  console.log(`=== No-brand bridge dedup${DRY_RUN ? " (DRY RUN)" : ""} ===\n`);

  console.log("Loading products...");
  const products = await loadAll();
  console.log(`  ${products.length} loaded`);

  const supMap = await loadSupplierMap();
  for (const p of products) p.suppliers = supMap.get(p.id) ?? [];

  const noBrand = products.filter(p => !p.brand || !p.brand.trim());
  const branded = products.filter(p => p.brand && p.brand.trim());
  console.log(`  ${noBrand.length} empty-brand, ${branded.length} branded\n`);

  // Pre-bucket branded products by their first content token (heuristic: usually
  // the brand or first word in the no-brand product is the same first content
  // token in the branded equivalent — saves us a 308 × 32K full scan)
  const buckets = new Map<string, Product[]>();
  for (const p of branded) {
    if (p.tokens.size === 0) continue;
    // Use up to first 3 tokens as bucket keys to maximise recall
    const tokenList = [...p.tokens];
    for (const k of tokenList.slice(0, 3)) {
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(p);
    }
  }

  const merges: Array<{ canonical: Product; duplicate: Product; score: number }> = [];
  const merged = new Set<number>();
  let evaluated = 0;

  for (const nb of noBrand) {
    if (merged.has(nb.id)) continue;
    if (nb.suppliers.length === 0) continue;
    if (nb.tokens.size === 0) continue;

    // Candidate set = union of branded products in any of nb's token buckets
    const candidateIds = new Set<number>();
    for (const k of nb.tokens) {
      const bucket = buckets.get(k);
      if (bucket) for (const p of bucket) candidateIds.add(p.id);
    }

    // Implied-brand guard: the FIRST content token of the no-brand product
    // is almost always its brand name. Any candidate that doesn't contain
    // that first token (in its brand OR its name tokens) is likely a
    // different-brand product. Catches cases like
    //   "Denoptix Barrier Envelopes Size 2"  ←→  UnoDent "Barrier Envelopes Size 2"
    const firstTokens = [...nb.tokens].filter(t => t.length >= 4 && !/^\d/.test(t));
    const impliedBrand = firstTokens[0]?.toLowerCase();

    // Variant + colour markers. Colours are highly discriminative — "Fuchsia
    // Paper Cups" and "Orange Paper Cups" are different SKUs with otherwise
    // identical token sets.
    const VARIANT_MARKERS = [
      "eco", "premium", "deluxe", "advanced", "professional", "plus",
      "orange", "blue", "white", "pink", "yellow", "green", "red", "black",
      "grey", "gray", "fuchsia", "lime", "purple", "aqua", "navy", "burgundy",
      "gold", "silver", "ivory", "cream", "tan", "brown", "lemon", "apple",
      "mint", "charcoal",
    ];
    const nbVariants = new Set([...nb.tokens].filter(t => VARIANT_MARKERS.includes(t)));

    let best: { p: Product; score: number; supplierCount: number } | null = null;
    for (const id of candidateIds) {
      const p = products.find(x => x.id === id);
      if (!p || merged.has(p.id)) continue;
      evaluated++;

      // Implied-brand check: first content token of nb must appear somewhere
      // in candidate (its brand normalised, or its name tokens). Catches
      // "Denoptix X" vs "UnoDent X" — same product family, different brands.
      if (impliedBrand) {
        const candHay = (p.brand + " " + p.name).toLowerCase();
        if (!candHay.includes(impliedBrand) && !p.tokens.has(impliedBrand)) continue;
      }

      // Variant marker symmetry: same set must hold across both products.
      // Fuchsia ↔ Orange, Eco ↔ standard, etc. all caught here.
      const candVariants = new Set([...p.tokens].filter(t => VARIANT_MARKERS.includes(t)));
      if (nbVariants.size !== candVariants.size) continue;
      let allMatch = true;
      for (const v of nbVariants) if (!candVariants.has(v)) { allMatch = false; break; }
      if (!allMatch) continue;

      const score = jaccard(nb.tokens, p.tokens);
      if (score < JACCARD_THRESHOLD) continue;
      if (distinguishingConflict(nb.tokens, p.tokens)) continue;

      // Tie-breaker on equal scores: prefer the canonical that already has
      // MORE suppliers (more comprehensive listing). Fixes the case where a
      // re-scraped DHB row could land on a thin DS-only product instead of
      // a richer canonical with HS+DS+DD already attached.
      const sc = p.suppliers.length;
      if (
        !best ||
        score > best.score + 1e-9 ||
        (Math.abs(score - best.score) < 1e-9 && sc > best.supplierCount)
      ) {
        best = { p, score, supplierCount: sc };
      }
    }

    if (best) {
      // Branded row is canonical, no-brand row is duplicate
      merges.push({ canonical: best.p, duplicate: nb, score: best.score });
      merged.add(nb.id);
    }
  }

  console.log(`Evaluated ${evaluated} candidate pairs`);
  console.log(`Cross-brand merge pairs found: ${merges.length}\n`);

  console.log("Sample merges:");
  const sampleN = VERBOSE ? merges.length : Math.min(25, merges.length);
  for (const m of merges.slice(0, sampleN)) {
    console.log(`  [${m.score.toFixed(2)}] KEEP id:${m.canonical.id} "${m.canonical.name.slice(0, 60)}" brand="${m.canonical.brand}" (sups:${m.canonical.suppliers.join(",")})`);
    console.log(`         DROP id:${m.duplicate.id} "${m.duplicate.name.slice(0, 60)}" brand="" (sups:${m.duplicate.suppliers.join(",")})`);
  }

  if (DRY_RUN) {
    console.log(`\nDry run — no changes made.`);
    return;
  }

  console.log(`\nApplying ${merges.length} merges...`);
  let done = 0, failed = 0;
  for (const { canonical, duplicate } of merges) {
    try {
      await mergePair(canonical.id, duplicate.id);
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${merges.length}...`);
    } catch (e: any) {
      failed++;
      if (failed < 5) console.error(`  err: ${e.message} (keep:${canonical.id} drop:${duplicate.id})`);
    }
    if (done % 25 === 0) await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\nDone — ${done} merged, ${failed} failed`);

  const { count: prods } = await sb.from("dentago_products").select("*", { count: "exact", head: true });
  const { count: sps } = await sb.from("dentago_supplier_products").select("*", { count: "exact", head: true });
  console.log(`Products: ${prods}  Supplier products: ${sps}`);
}

main().catch(console.error);
