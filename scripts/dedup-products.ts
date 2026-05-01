/**
 * dedup-products.ts
 *
 * Problem: Same product (e.g. "Smart Blue Nitrile Examination Gloves - M (100)")
 * appears multiple times in the DB, each with different supplier_products.
 *
 * Fix:
 * 1. Group products by normalised name
 * 2. For each duplicate group: pick the best canonical product
 * 3. Move all supplier_products to the canonical product (avoiding duplicates)
 * 4. Delete the duplicate products
 * 5. Also remove "category page" products (no brand, generic names like "Nitrile Gloves")
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

// Normalise name for comparison
function normName(name: string): string {
  return name.toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\(\)\-\.&]/g, "")
    .trim();
}

// Category/landing pages that are not real products
function isCategoryPage(name: string): boolean {
  const catPatterns = [
    /^[a-z\s&]+s$/i,                           // Generic plural: "Nitrile Gloves", "Face Masks"
    /^[a-z\s&]+ by [a-z\s&]+$/i,              // "Gloves by MEDIBASE"
    /\bby [A-Z&]+$/,                            // ends with "by BRAND"
    /^(disposable|infection control|surface|sterilisation|endodontic|impression|composite|cement|anaesthetic|orthodontic|implant|rotary|hand instrument)/i,
  ];

  // Very short generic names without pack info
  const words = name.trim().split(/\s+/);
  if (words.length <= 2 && !name.match(/\d+/)) return true;

  return catPatterns.some(p => p.test(name.trim()));
}

async function main() {
  console.log("🧹 Deduplicating Dentago product catalog...\n");

  // Fetch all products
  const { data: allProducts } = await supabase
    .from("dentago_products")
    .select("id, name, brand, image, category")
    .order("id");

  if (!allProducts) { console.error("Failed to fetch products"); return; }
  console.log(`Total products before cleanup: ${allProducts.length}`);

  // ── Step 1: Remove category landing pages ────────────────────────────────
  const categoryPageIds: number[] = [];
  for (const p of allProducts) {
    if (isCategoryPage(p.name)) categoryPageIds.push(p.id);
  }
  console.log(`\nCategory pages to remove: ${categoryPageIds.length}`);
  console.log("Sample:", categoryPageIds.slice(0, 5).map(id => allProducts.find(p => p.id === id)?.name));

  // Delete supplier_products first, then products
  if (categoryPageIds.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < categoryPageIds.length; i += CHUNK) {
      const chunk = categoryPageIds.slice(i, i + CHUNK);
      await supabase.from("dentago_supplier_products").delete().in("product_id", chunk);
      await supabase.from("dentago_products").delete().in("id", chunk);
    }
    console.log(`✅ Removed ${categoryPageIds.length} category pages`);
  }

  // ── Step 2: Group remaining products by normalised name ──────────────────
  const remaining = allProducts.filter(p => !categoryPageIds.includes(p.id));
  const groups = new Map<string, typeof remaining>();

  for (const p of remaining) {
    const key = normName(p.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const duplicateGroups = [...groups.values()].filter(g => g.length > 1);
  console.log(`\nDuplicate name groups: ${duplicateGroups.length}`);
  console.log(`Products to merge: ${duplicateGroups.reduce((acc, g) => acc + g.length - 1, 0)}`);

  // ── Step 3: For each duplicate group, merge into one product ─────────────
  let merged = 0;
  let deleted = 0;

  for (const group of duplicateGroups) {
    // Pick canonical: prefer product with best image (not placeholder) and lowest ID
    const canonical = group.sort((a, b) => {
      // Prefer one with a real image URL
      const aHasImg = a.image && a.image.includes("dentalsky.com");
      const bHasImg = b.image && b.image.includes("dentalsky.com");
      if (aHasImg && !bHasImg) return -1;
      if (!aHasImg && bHasImg) return 1;
      return a.id - b.id; // lower ID wins
    })[0];

    const duplicates = group.filter(p => p.id !== canonical.id);

    // Get all supplier_products for duplicates
    const dupIds = duplicates.map(d => d.id);
    const { data: dupSPs } = await supabase
      .from("dentago_supplier_products")
      .select("*")
      .in("product_id", dupIds);

    // Get existing supplier_products for canonical to avoid duplicates
    const { data: canonSPs } = await supabase
      .from("dentago_supplier_products")
      .select("supplier_id")
      .eq("product_id", canonical.id);

    const existingSupplierIds = new Set(canonSPs?.map(s => s.supplier_id) || []);

    // Move unique supplier_products to canonical
    const toMove = (dupSPs || []).filter(sp => !existingSupplierIds.has(sp.supplier_id) && sp.price > 0);

    for (const sp of toMove) {
      await supabase.from("dentago_supplier_products").insert({
        product_id: canonical.id,
        supplier_id: sp.supplier_id,
        price: sp.price,
        stock: sp.stock,
        delivery: sp.delivery,
        sku: sp.sku,
        pack_size: sp.pack_size,
      });
      existingSupplierIds.add(sp.supplier_id);
    }

    // Delete all supplier_products for duplicates
    await supabase.from("dentago_supplier_products").delete().in("product_id", dupIds);

    // Delete duplicate products
    await supabase.from("dentago_products").delete().in("id", dupIds);

    merged++;
    deleted += duplicates.length;

    if (merged % 20 === 0) {
      console.log(`  Merged ${merged} groups, deleted ${deleted} duplicates...`);
    }
  }

  console.log(`\n✅ Merged ${merged} duplicate groups, deleted ${deleted} duplicate products`);

  // ── Step 4: Final count ──────────────────────────────────────────────────
  const { count } = await supabase
    .from("dentago_products")
    .select("*", { count: "exact", head: true });

  const { count: spCount } = await supabase
    .from("dentago_supplier_products")
    .select("*", { count: "exact", head: true });

  // How many products have multiple suppliers?
  const { data: multiCheck } = await supabase
    .from("dentago_supplier_products")
    .select("product_id")
    .gt("price", 0);

  const spByProduct = new Map<number, number>();
  for (const sp of multiCheck || []) {
    spByProduct.set(sp.product_id, (spByProduct.get(sp.product_id) || 0) + 1);
  }
  const withMultiple = [...spByProduct.values()].filter(v => v >= 2).length;

  console.log(`\n📊 Final catalog:`);
  console.log(`  Total unique products: ${count}`);
  console.log(`  Total supplier prices: ${spCount}`);
  console.log(`  Products with 2+ supplier prices: ${withMultiple}`);
  console.log(`  Avg suppliers per product: ${(spCount! / count!).toFixed(1)}`);
}

main().catch(console.error);
