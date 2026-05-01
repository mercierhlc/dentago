/**
 * sku-fingerprint-dedup.ts
 *
 * Higher-precision dedup pass that complements dedup-merge.ts.
 *
 * Key observation: each supplier uses its OWN internal SKU (DS: "253-0159",
 * DD: "EKN086", HS: "1086666") so a literal SKU equality match across
 * suppliers will find ~zero matches. What IS shared across suppliers is the
 * manufacturer's MODEL SPEC, which is embedded in the product NAME — e.g.
 * "ProTaper Gold F1 25mm (6)" — the "F1 25mm 6" part identifies that exact
 * SKU at every supplier that stocks it.
 *
 * So: build a fingerprint = normalised brand + sorted distinguishing tokens
 *     (numbers, sizes, alphanumeric codes). Group by fingerprint. Within each
 *     group, if 2+ products are from different suppliers and share the same
 *     fingerprint, merge them. Conservative — requires discriminative tokens
 *     to match EXACTLY, no fuzzy.
 *
 * Run after dedup-merge.ts so we don't duplicate work.
 */
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

const STOP = new Set([
  "a","an","the","and","or","of","for","in","to","with","by","from",
  "pack","box","bag","kit","set","unit","units","each","per",
  "standard","sterile","dental","grade","quality","professional","product","item","uk",
]);

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseBrand(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/limited|ltd|uk|inc|corp|group/g, "")
    .trim();
}

interface Tokens {
  numbers: Set<string>;       // 8, 15, 100
  units: Set<string>;         // 50ml, 25mm, 4g, 1l
  codes: Set<string>;         // F1, S2, A2 (letter+digit)
  sizes: Set<string>;         // xs, s, m, l, xl
  qualifiers: Set<string>;    // grit/finish/variant words: fine, coarse, f, xf, ml, mlx, c, ef
  content: Set<string>;       // remaining words >=3 chars
}

// Short grit / finish codes that look like noise (length 1-3) but are highly
// discriminative in dental supplier listings — e.g. Diatech burs use F (Fine),
// XF (Extra Fine), ML (Medium-Long), MLX, EF (Extra Fine).
// Avoid pure single letters like "x" and "c" — they collide with multipliers
// (e.g. "20 x 0.2g") and vitamin/category abbreviations.
const GRIT_CODES = new Set(["xf", "ef", "ml", "mlx", "xc", "xxf"]);

const QUALIFIER_WORDS = new Set([
  "fine", "coarse", "medium", "extrafine", "ultrafine",
  "fast", "regular", "slow", "quick", "regularset", "fastset",
  "powder", "powderfree", "powdered", "latex", "nitrile", "vinyl",
  "matte", "gloss", "satin",
  "long", "short", "extralong", "miniextralong",
  "heavy", "light",
  "universal", "monophase", "putty", "wash", "tray", "lightbody", "heavybody",
  "primary", "secondary", "small", "large",
]);

function tokenise(name: string): Tokens {
  const t: Tokens = {
    numbers: new Set(), units: new Set(), codes: new Set(),
    sizes: new Set(), qualifiers: new Set(), content: new Set(),
  };
  for (const w of normaliseName(name).split(" ")) {
    if (!w || STOP.has(w)) continue;
    if (/^\d+$/.test(w)) t.numbers.add(w);
    else if (/^\d+(ml|mm|cm|g|mg|kg|l|oz)$/i.test(w)) t.units.add(w);
    else if (/^[a-z]\d{1,2}$/i.test(w) && w.length <= 4) t.codes.add(w);
    else if (/^(xs|s|m|l|xl|xxl)$/i.test(w)) t.sizes.add(w.toLowerCase());
    else if (GRIT_CODES.has(w)) t.qualifiers.add(w);
    else if (QUALIFIER_WORDS.has(w)) t.qualifiers.add(w);
    else if (w.length >= 3) t.content.add(w);
  }
  return t;
}

// Fingerprint = brand + every discriminative token (sorted, exact-match).
// Require at least 2 discriminative tokens — a single number/code paired with a
// brand is too loose ("Hu-Friedy + 2" matches knives, scissors, curettes).
function fingerprint(brand: string, t: Tokens): string {
  const norm = normaliseBrand(brand);
  if (!norm) return "";
  const discTokens = [
    ...[...t.numbers].sort(),
    ...[...t.units].sort(),
    ...[...t.codes].sort().map(c => c.toLowerCase()),
    ...[...t.sizes].sort(),
  ];
  if (discTokens.length < 2) return "";
  return `${norm}|${discTokens.join("+")}`;
}

function contentOverlap(a: Tokens, b: Tokens): number {
  if (a.content.size === 0 || b.content.size === 0) return 0;
  let inter = 0;
  for (const t of a.content) if (b.content.has(t)) inter++;
  return inter / Math.min(a.content.size, b.content.size);
}

interface Product {
  id: number;
  name: string;
  brand: string;
  image: string;
  tokens: Tokens;
  fp: string;
  suppliers: number[];
}

async function loadAllProducts(): Promise<Product[]> {
  const all: Product[] = [];
  let off = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from("dentago_products")
      .select("id, name, brand, image")
      .range(off, off + PAGE - 1)
      .order("id");
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const p of data) {
      const tokens = tokenise(p.name ?? "");
      const fp = fingerprint(p.brand ?? "", tokens);
      all.push({ ...p, tokens, fp, suppliers: [] });
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
    const { data, error } = await sb
      .from("dentago_supplier_products")
      .select("product_id, supplier_id")
      .range(off, off + PAGE - 1);
    if (error) throw error;
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
  return pool.sort((a, b) => a.id - b.id)[0];
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
  console.log(`=== SKU-fingerprint dedup${DRY_RUN ? " (DRY RUN)" : ""} ===\n`);

  console.log("Loading products...");
  const products = await loadAllProducts();
  console.log(`  ${products.length} products loaded`);

  console.log("Loading supplier map...");
  const supMap = await loadSupplierMap();
  for (const p of products) p.suppliers = supMap.get(p.id) ?? [];

  // Group by fingerprint (skip empty fingerprints)
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    if (!p.fp) continue;
    if (!groups.has(p.fp)) groups.set(p.fp, []);
    groups.get(p.fp)!.push(p);
  }
  console.log(`  ${groups.size} unique fingerprints (out of ${products.length} products)\n`);

  // Find merge pairs
  const merges: Array<{ canonical: Product; duplicate: Product; fp: string }> = [];
  const merged = new Set<number>();

  let groupCandidates = 0;
  for (const [fp, group] of groups) {
    if (group.length < 2) continue;
    groupCandidates++;

    for (let i = 0; i < group.length; i++) {
      if (merged.has(group[i].id)) continue;
      for (let j = i + 1; j < group.length; j++) {
        if (merged.has(group[j].id)) continue;

        // Both must have at least one supplier
        if (group[i].suppliers.length === 0 && group[j].suppliers.length === 0) continue;

        // Must NOT share a supplier (then they're separate listings on same supplier — different products)
        const iSups = new Set(group[i].suppliers);
        const jSups = new Set(group[j].suppliers);
        const overlap = [...iSups].filter(s => jSups.has(s));
        if (overlap.length > 0) continue;

        // High content-token overlap required. 0.7 filters out same-brand
        // variant collisions (Diatech burs with different grits, "Filtek
        // Universal" vs "Filtek Z500", "Columbia 13/14" vs "Harmony 13/14").
        const co = contentOverlap(group[i].tokens, group[j].tokens);
        if (co < 0.7) continue;

        // Variant qualifier guard: if EITHER product has a qualifier (grit
        // code, finish word, formulation marker) and the other doesn't have
        // the SAME qualifier, they're variants of the same family — not the
        // same SKU. Blocks Diatech grit collisions (F vs XF), powder/powder-
        // free, fine/coarse, etc.
        const qa = group[i].tokens.qualifiers;
        const qb = group[j].tokens.qualifiers;
        if (qa.size > 0 || qb.size > 0) {
          let qInter = 0;
          for (const q of qa) if (qb.has(q)) qInter++;
          // Asymmetric: one side has qualifier(s), the other has none → block
          if ((qa.size === 0) !== (qb.size === 0)) continue;
          // Symmetric but no overlap → variants of the same family
          if (qa.size > 0 && qb.size > 0 && qInter === 0) continue;
        }

        // Hard requirement: at least 2 content tokens in common
        let inter = 0;
        for (const t of group[i].tokens.content) if (group[j].tokens.content.has(t)) inter++;
        if (inter < 2) continue;

        const canonical = pickCanonical([group[i], group[j]]);
        const duplicate = canonical.id === group[i].id ? group[j] : group[i];
        merges.push({ canonical, duplicate, fp });
        merged.add(duplicate.id);
        break; // one merge per loop iter — re-run to chain
      }
    }
  }

  console.log(`Fingerprint groups with 2+ products: ${groupCandidates}`);
  console.log(`Cross-supplier merge pairs found:    ${merges.length}\n`);

  console.log("Sample merges:");
  const sampleN = VERBOSE ? merges.length : Math.min(25, merges.length);
  for (const m of merges.slice(0, sampleN)) {
    console.log(`  fp=${m.fp}`);
    console.log(`    KEEP id:${m.canonical.id} "${m.canonical.name.slice(0, 60)}" (sups:${m.canonical.suppliers.join(",") || "none"})`);
    console.log(`    DROP id:${m.duplicate.id} "${m.duplicate.name.slice(0, 60)}" (sups:${m.duplicate.suppliers.join(",") || "none"})`);
  }

  if (DRY_RUN) {
    console.log(`\nDry run — no changes made. Run without --dry-run to apply.`);
    return;
  }

  console.log(`\nApplying ${merges.length} merges...`);
  let done = 0, failed = 0;
  for (const { canonical, duplicate } of merges) {
    try {
      await mergePair(canonical.id, duplicate.id);
      done++;
      if (done % 100 === 0) console.log(`  ${done}/${merges.length} done...`);
    } catch (e: any) {
      failed++;
      if (failed < 5) console.error(`  err: ${e.message} (keep:${canonical.id} drop:${duplicate.id})`);
    }
    if (done % 50 === 0) await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone — ${done} merged, ${failed} failed`);

  const { count: prods } = await sb.from("dentago_products").select("*", { count: "exact", head: true });
  const { count: sps } = await sb.from("dentago_supplier_products").select("*", { count: "exact", head: true });
  console.log(`Products remaining:    ${prods}`);
  console.log(`Supplier product rows: ${sps}`);
}

main().catch(console.error);
