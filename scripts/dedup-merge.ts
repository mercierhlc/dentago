/**
 * dedup-merge.ts
 *
 * Finds products in dentago_products that represent the same physical item
 * (scraped separately by different supplier scrapers with slightly different names),
 * then merges them: all dentago_supplier_products rows get redirected to the
 * single canonical product, duplicates are deleted.
 *
 * Matching strategy:
 *  1. Group products by brand (exact match after normalisation)
 *  2. Within each brand group, compute Jaccard token similarity on name
 *  3. Products with >55% token overlap are considered the same item
 *  4. Canonical = the product with the best data (image, longest name, lowest id)
 */

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const DRY_RUN = process.argv.includes("--dry-run");
const SIMILARITY_THRESHOLD = 0.70;

// Stopwords that don't help distinguish products
const STOP = new Set([
  "a","an","the","and","or","of","for","in","to","with","by","from",
  "pack","box","bag","kit","set","unit","units","each","per","ml","mg","g","mm","cm","l",
  "standard","sterile","dental","grade","quality","professional","product","item","uk",
]);

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")   // strip punctuation
    .replace(/\b0+(\d)/g, "$1")      // strip leading zeros from numbers
    .replace(/\s+/g, " ")
    .trim();
}

function tokenise(name: string): Set<string> {
  return new Set(
    normalise(name)
      .split(" ")
      .filter(t => {
        if (!t || STOP.has(t)) return false;
        // Keep pure-digit tokens regardless of length (1, 6, 100 are pack-size signals)
        if (/^\d+$/.test(t)) return true;
        // Keep short letter+digit codes (F1, S2, A2 — file/shade IDs)
        if (/^[a-z]\d+$/i.test(t)) return true;
        // Keep size letter codes (m, l, xl, xs, xxl)
        if (/^(xs|s|m|l|xl|xxl)$/i.test(t)) return true;
        // Otherwise require >=2 chars to avoid noise
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

// Distinguishing tokens — numbers (12, 50ml, 25mm) and short alphanumeric codes
// (F1, S2, A2, B1, M, XL). If two products differ on these, they are NOT the
// same item even if their other tokens overlap a lot.
function distinguishingTokens(tokens: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    // pure numeric
    if (/^\d+$/.test(t)) out.add(t);
    // numeric+unit (e.g. 50ml, 25mm, 4g)
    else if (/^\d+(ml|mm|cm|g|mg|l|kg|oz)$/i.test(t)) out.add(t);
    // file/shade codes (F1, F2, S2, A1, A2, B1, XL, etc.) — letter+digit, ≤4 chars
    else if (/^[a-z]\d{1,2}$/i.test(t) && t.length <= 4) out.add(t);
    // pure short letter codes that look like sizes (xs, s, m, l, xl, xxl)
    else if (/^(xs|s|m|l|xl|xxl)$/i.test(t)) out.add(t);
  }
  return out;
}

// Returns true if the products' distinguishing tokens conflict.
// Three flavours of conflict:
//   1. Symmetric mismatch in same class:    "8" vs "15"     OR  "F1" vs "S2"  OR "M" vs "L"
//   2. Asymmetric size letter:              one has "M"/"XL"  → other must have it too
//   3. Asymmetric letter+digit code:        one has "F1"      → other must have it too
// Asymmetric pure-digit / numeric+unit is allowed (often omitted in titles).
function distinguishingConflict(a: Set<string>, b: Set<string>): boolean {
  const da = distinguishingTokens(a);
  const db = distinguishingTokens(b);

  // Class-1: symmetric same-class mismatch
  for (const t of da) if (!db.has(t)) {
    if ([...db].some(t2 => sameClass(t, t2) && t2 !== t)) return true;
  }
  for (const t of db) if (!da.has(t)) {
    if ([...da].some(t2 => sameClass(t, t2) && t2 !== t)) return true;
  }

  // Class-2 + Class-3: asymmetric high-discriminative tokens
  const isSize = (t: string) => /^(xs|s|m|l|xl|xxl)$/i.test(t);
  const isCode = (t: string) => /^[a-z]\d{1,2}$/i.test(t) && t.length <= 4;
  for (const t of da) {
    if (isSize(t) && !db.has(t)) return true;
    if (isCode(t) && !db.has(t)) return true;
  }
  for (const t of db) {
    if (isSize(t) && !da.has(t)) return true;
    if (isCode(t) && !da.has(t)) return true;
  }

  return false;
}

function sameClass(a: string, b: string): boolean {
  const cls = (t: string) =>
    /^\d+$/.test(t) ? "num" :
    /^\d+(ml|mm|cm|g|mg|l|kg|oz)$/i.test(t) ? t.replace(/^\d+/, "#") :
    /^[a-z]\d+$/i.test(t) ? t[0].toUpperCase() + "#" :
    /^(xs|s|m|l|xl|xxl)$/i.test(t) ? "size" : "other";
  return cls(a) === cls(b);
}

function normaliseBrand(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/limited|ltd|uk|inc|corp|group/g, "")
    .trim();
}

interface Product {
  id: number;
  name: string;
  brand: string;
  category: string;
  image: string;
  pack_size: string;
  description: string;
  tokens: Set<string>;
  normBrand: string;
  suppliers: number[];
}

async function loadAllProducts(): Promise<Product[]> {
  const all: Product[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from("dentago_products")
      .select("id, name, brand, category, image, pack_size, description")
      .range(offset, offset + PAGE - 1)
      .order("id");
    if (error) throw error;
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
    offset += PAGE;
  }
  return all;
}

async function loadSupplierMap(): Promise<Map<number, number[]>> {
  // product_id → [supplier_ids] — paginated to bypass 1000-row default limit
  const map = new Map<number, number[]>();
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from("dentago_supplier_products")
      .select("product_id, supplier_id")
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (!map.has(r.product_id)) map.set(r.product_id, []);
      map.get(r.product_id)!.push(r.supplier_id);
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return map;
}

function pickCanonical(group: Product[]): Product {
  // Prefer: has image > lower id
  const withImage = group.filter(p => p.image);
  const pool = withImage.length > 0 ? withImage : group;
  return pool.sort((a, b) => a.id - b.id)[0];
}

async function mergePair(keepId: number, dropId: number): Promise<void> {
  if (DRY_RUN) return;

  // Pull both sides with full row data so we can compare prices on collision
  const { data: dropSPs } = await sb
    .from("dentago_supplier_products")
    .select("id, supplier_id, price")
    .eq("product_id", dropId);

  const { data: keepSPs } = await sb
    .from("dentago_supplier_products")
    .select("id, supplier_id, price")
    .eq("product_id", keepId);

  const keepBySup = new Map<number, { id: number; price: number }>();
  for (const r of keepSPs ?? []) keepBySup.set(r.supplier_id, { id: r.id, price: Number(r.price) });

  for (const sp of dropSPs ?? []) {
    const existing = keepBySup.get(sp.supplier_id);
    if (existing) {
      // Same supplier on both sides → keep the LOWER price (was: silent delete
      // of the drop's row, which sometimes lost the cheaper SKU).
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
  console.log(`=== Product Deduplication${DRY_RUN ? " (DRY RUN)" : ""} ===\n`);

  console.log("Loading products...");
  const products = await loadAllProducts();
  console.log(`  ${products.length} products loaded`);

  console.log("Loading supplier map...");
  const supplierMap = await loadSupplierMap();
  for (const p of products) p.suppliers = supplierMap.get(p.id) ?? [];

  // Group by normalised brand
  const brandGroups = new Map<string, Product[]>();
  for (const p of products) {
    const key = p.normBrand || "__no_brand__";
    if (!brandGroups.has(key)) brandGroups.set(key, []);
    brandGroups.get(key)!.push(p);
  }
  console.log(`  ${brandGroups.size} brand groups\n`);

  // Find duplicate pairs
  const merges: Array<{ canonical: Product; duplicate: Product; score: number }> = [];
  const merged = new Set<number>(); // track IDs already scheduled for deletion

  for (const [brand, group] of brandGroups) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      if (merged.has(group[i].id)) continue;
      for (let j = i + 1; j < group.length; j++) {
        if (merged.has(group[j].id)) continue;

        // Both must have supplier data (don't merge orphans)
        if (group[i].suppliers.length === 0 && group[j].suppliers.length === 0) continue;

        // Skip if they're the same supplier (would be same product already)
        const iSups = new Set(group[i].suppliers);
        const jSups = new Set(group[j].suppliers);
        const overlap = [...iSups].filter(s => jSups.has(s));
        if (overlap.length > 0) continue; // Already same product or conflicts

        const score = jaccard(group[i].tokens, group[j].tokens);
        if (score < SIMILARITY_THRESHOLD) continue;

        // Numeric / pack-size / shade conflict guard: prevents merging
        // "8 Cakes" with "15pk" or "F1 file" with "S2 file"
        if (distinguishingConflict(group[i].tokens, group[j].tokens)) continue;

        const canonical = pickCanonical([group[i], group[j]]);
        const duplicate = canonical.id === group[i].id ? group[j] : group[i];
        merges.push({ canonical, duplicate, score });
        merged.add(duplicate.id);
        break; // One merge per product at a time — re-run to catch chains
      }
    }
  }

  console.log(`Found ${merges.length} duplicate pairs to merge\n`);

  // Preview top 20
  console.log("Sample merges:");
  for (const m of merges.slice(0, 20)) {
    console.log(`  [${m.score.toFixed(2)}] KEEP id:${m.canonical.id} "${m.canonical.name.slice(0,50)}" (sups:${m.canonical.suppliers.join(",") || "none"})`);
    console.log(`        DROP id:${m.duplicate.id} "${m.duplicate.name.slice(0,50)}" (sups:${m.duplicate.suppliers.join(",") || "none"})`);
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
      if (failed < 5) console.error(`  Merge error: ${e.message} (keep:${canonical.id} drop:${duplicate.id})`);
    }
    // Small delay to avoid rate limits
    if (done % 50 === 0) await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Done — ${done} merged, ${failed} failed`);

  // Final count
  const { count } = await sb.from("dentago_products").select("*", { count: "exact", head: true });
  const { count: spCount } = await sb.from("dentago_supplier_products").select("*", { count: "exact", head: true });
  console.log(`Products remaining: ${count}`);
  console.log(`Supplier product rows: ${spCount}`);
}

main().catch(console.error);
