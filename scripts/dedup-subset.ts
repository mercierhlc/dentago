/**
 * dedup-subset.ts
 *
 * Catches the narrow class of duplicates that previous passes miss:
 * short product names where one supplier's title is just the bare product
 * (e.g. "Skini Syringes") and another's adds packaging info (e.g.
 * "Skini Syringe 20pk").
 *
 * Strategy is intentionally CONSERVATIVE:
 *   - same brand (intra-brand)
 *   - stemmed 4+ char "content" tokens are EXACTLY equal between sides
 *   - "discriminator" tokens (single letters, 2-3 letter abbreviations,
 *      letter+digit codes like F1/A3) are EXACTLY equal between sides
 *   - quantity tokens (pure numbers, num+unit, num+pk/ct) are either equal
 *     between sides or ONE side has an empty quantity set (the other adds
 *     packaging info)
 *
 * This blocks the obvious false positives we hit on the first pass:
 *   - Size A vs Size B  (A,B preserved as discriminators)
 *   - 30G Short vs 30G X-Short  (extra "x" preserved as discriminator)
 *   - A3 vs A3.5  (the trailing "5" preserved as quantity → mismatch)
 *   - Refills A2 vs Refills O-A2  ("o" preserved as discriminator)
 *   - 120 count vs 24mm length  (different quantity tokens both populated)
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

// Minimal STOP list — single letters / 1-2 letter codes are NOT filtered
// (they go through as discriminators) so that "A RM" vs "RM" don't collapse.
const STOP = new Set([
  "the","and","or","of","for","with","by","from","per","in","to",
]);

function normalise(s: string): string {
  let n = s.toLowerCase();
  // Preserve trailing "+" suffix: "Light+" → "lightplus", "A2+" → "a2plus"
  // so shade variants don't collapse to the base name. (Trailing only —
  // mid-token hyphens like "AM-25" are word separators.)
  n = n.replace(/([a-z0-9])\+(\s|$)/g, "$1plus$2");
  // Glue dotted alphanumeric codes so "A3.5" stays distinct from "A3" and
  // "0.25" stays distinct from "25".
  n = n.replace(/([a-z]\d+)\.(\d+)/g, "$1p$2"); // a3.5 → a3p5
  n = n.replace(/(\d+)\.(\d+)/g, "$1p$2");      // 0.25 → 0p25
  return n.replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

// Light, conservative stemmer: only strip trailing 's' / 'es' / 'ies' so
// "syringes" → "syringe" matches "syringe", "wipes" → "wipe" matches "wipe".
function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("xes") && w.length > 4) return w.slice(0, -2);   // boxes → box
  if (w.endsWith("ses") && w.length > 4) return w.slice(0, -2);   // doses → dose
  if (w.endsWith("ches") && w.length > 5) return w.slice(0, -2);  // brushes → brush (well, "brushes" ends in "hes" not "ches" — handled below)
  if (w.endsWith("shes") && w.length > 5) return w.slice(0, -2);  // brushes → brush
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is") && w.length > 3) {
    return w.slice(0, -1);
  }
  return w;
}

interface Tokens {
  contentMS: string;        // multiset signature of stemmed 4+ char words
  discriminatorMS: string;  // multiset of model codes (mixed alphanumeric, bare numbers, 1-3 letter codes)
  quantityMS: string;       // multiset of size/pack tokens (with units only)
  contentSet: Set<string>;  // raw set, used for substance check
}

const PURE_QUANTITY_WORDS = new Set([
  "pk","ct","count","pieces","pcs","packs","packets","pack","each","unit","units",
]);

function ms(arr: string[]): string {
  return arr.slice().sort().join(",");
}

function tokenise(name: string): Tokens {
  const content: string[] = [];
  const contentSet = new Set<string>();
  const discriminator: string[] = [];
  const quantity: string[] = [];

  for (const raw of normalise(name).split(" ")) {
    if (!raw || STOP.has(raw)) continue;

    // Quantity (must have a unit suffix or be a packaging word) — these are
    // the only tokens where asymmetry is allowed (one side may omit pack info)
    if (/^\d+(ml|mm|cm|g|mg|kg|l|oz)$/i.test(raw)) { quantity.push(raw); continue; }
    if (/^\d+(pk|ct|pcs|pack)$/i.test(raw)) { quantity.push(raw); continue; }
    if (/^\d+p\d+(ml|mm|cm|g|mg|kg|l|oz)$/i.test(raw)) { quantity.push(raw); continue; } // 1p5ml
    if (PURE_QUANTITY_WORDS.has(raw)) { quantity.push(raw); continue; }

    // Bare numbers (without unit) are model/version designators, not pack
    // counts — must match exactly across both sides
    if (/^\d+$/.test(raw)) { discriminator.push(raw); continue; }
    if (/^\d+p\d+$/i.test(raw)) { discriminator.push(raw); continue; }   // bare 0.25 → 0p25 → discriminator

    // Mixed letters+digits = model/variant code (TF1, BF5, 67A, 14W, S304, A3p5, lightplus2)
    if (/[a-z]/i.test(raw) && /\d/.test(raw)) { discriminator.push(raw); continue; }

    // Pure-letter codes 1-3 chars → discriminator (preserves "Size A" vs "Size B")
    if (/^[a-z]{1,3}$/i.test(raw)) { discriminator.push(raw); continue; }

    // 4+ char words → content (stemmed)
    if (raw.length >= 4) {
      const s = stem(raw);
      content.push(s);
      contentSet.add(s);
    }
  }
  return {
    contentMS: ms(content),
    discriminatorMS: ms(discriminator),
    quantityMS: ms(quantity),
    contentSet,
  };
}

function normaliseBrand(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]/g, "")
    .replace(/limited|ltd|uk|inc|corp|group/g, "").trim();
}

interface Product {
  id: number;
  name: string;
  brand: string;
  image: string;
  tokens: Tokens;
  normBrand: string;
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
      all.push({
        ...p,
        tokens: tokenise(p.name ?? ""),
        normBrand: normaliseBrand(p.brand ?? ""),
        suppliers: [],
      });
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

function pickCanonical(group: Product[]): Product {
  const withImage = group.filter(p => p.image);
  const pool = withImage.length > 0 ? withImage : group;
  return pool.sort((a, b) =>
    b.suppliers.length - a.suppliers.length ||
    b.name.length - a.name.length ||         // longer name = more specific = often canonical
    a.id - b.id
  )[0];
}

async function mergePair(keepId: number, dropId: number): Promise<void> {
  if (DRY_RUN) return;
  const { data: dropSPs } = await sb.from("dentago_supplier_products")
    .select("id, supplier_id, price").eq("product_id", dropId);
  const { data: keepSPs } = await sb.from("dentago_supplier_products")
    .select("id, supplier_id, price").eq("product_id", keepId);
  const keepBySup = new Map<number, { id: number; price: number }>();
  for (const r of keepSPs ?? []) keepBySup.set(r.supplier_id, { id: r.id, price: Number(r.price) });

  for (const sp of dropSPs ?? []) {
    const existing = keepBySup.get(sp.supplier_id);
    if (existing) {
      if (Number(sp.price) < existing.price) {
        await sb.from("dentago_supplier_products").delete().eq("id", existing.id);
        await sb.from("dentago_supplier_products").update({ product_id: keepId }).eq("id", sp.id);
        keepBySup.set(sp.supplier_id, { id: sp.id, price: Number(sp.price) });
      } else {
        await sb.from("dentago_supplier_products").delete().eq("id", sp.id);
      }
    } else {
      await sb.from("dentago_supplier_products").update({ product_id: keepId }).eq("id", sp.id);
      keepBySup.set(sp.supplier_id, { id: sp.id, price: Number(sp.price) });
    }
  }
  await sb.from("dentago_products").delete().eq("id", dropId);
}

async function main() {
  console.log(`=== Subset dedup${DRY_RUN ? " (DRY RUN)" : ""} ===\n`);

  const products = await loadAll();
  console.log(`  ${products.length} products`);

  const supMap = await loadSupplierMap();
  for (const p of products) p.suppliers = supMap.get(p.id) ?? [];

  const brandGroups = new Map<string, Product[]>();
  for (const p of products) {
    if (!p.normBrand) continue;
    if (p.tokens.contentSet.size < 1) continue;
    if (!brandGroups.has(p.normBrand)) brandGroups.set(p.normBrand, []);
    brandGroups.get(p.normBrand)!.push(p);
  }
  console.log(`  ${brandGroups.size} brand groups\n`);

  const merges: Array<{ canonical: Product; duplicate: Product }> = [];
  const merged = new Set<number>();

  for (const [brand, group] of brandGroups) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      if (merged.has(group[i].id)) continue;
      for (let j = i + 1; j < group.length; j++) {
        if (merged.has(group[j].id)) continue;

        const a = group[i], b = group[j];

        if (a.suppliers.length === 0 && b.suppliers.length === 0) continue;

        // Strict multiset equality on identity-defining tokens
        if (a.tokens.contentMS !== b.tokens.contentMS) continue;
        if (a.tokens.discriminatorMS !== b.tokens.discriminatorMS) continue;

        // Quantity multisets: equal OR exactly one side empty
        const aQ = a.tokens.quantityMS, bQ = b.tokens.quantityMS;
        if (aQ !== "" && bQ !== "" && aQ !== bQ) continue;

        // Need substance: at least 2 distinct content tokens
        if (a.tokens.contentSet.size < 2) continue;

        const canonical = pickCanonical([a, b]);
        const duplicate = canonical.id === a.id ? b : a;
        merges.push({ canonical, duplicate });
        merged.add(duplicate.id);
        break;
      }
    }
  }

  console.log(`Pairs to merge: ${merges.length}\n`);
  console.log("Sample merges:");
  const sampleN = VERBOSE ? merges.length : Math.min(40, merges.length);
  for (const m of merges.slice(0, sampleN)) {
    console.log(`  KEEP id:${m.canonical.id} "${m.canonical.name.slice(0, 70)}" sups:[${m.canonical.suppliers.join(",") || "none"}]`);
    console.log(`  DROP id:${m.duplicate.id} "${m.duplicate.name.slice(0, 70)}" sups:[${m.duplicate.suppliers.join(",") || "none"}]\n`);
  }

  if (DRY_RUN) {
    console.log(`Dry run — no changes made.`);
    return;
  }

  console.log(`\nApplying ${merges.length} merges...`);
  let done = 0, failed = 0;
  for (const { canonical, duplicate } of merges) {
    try {
      await mergePair(canonical.id, duplicate.id);
      done++;
      if (done % 100 === 0) console.log(`  ${done}/${merges.length}...`);
    } catch (e: any) {
      failed++;
      if (failed < 5) console.error(`  err: ${e.message}`);
    }
    if (done % 50 === 0) await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\nDone — ${done} merged, ${failed} failed`);

  const { count: prods } = await sb.from("dentago_products").select("*", { count: "exact", head: true });
  const { count: sps } = await sb.from("dentago_supplier_products").select("*", { count: "exact", head: true });
  console.log(`Products: ${prods}  Supplier products: ${sps}`);
}

main().catch(console.error);
