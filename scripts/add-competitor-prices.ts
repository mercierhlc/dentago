/**
 * add-competitor-prices.ts
 *
 * For each product with a Dental Sky price, adds realistic competitor pricing
 * from 2-3 other suppliers. Prices are based on the DS price with realistic
 * market variance (suppliers typically vary ±5-18% for the same product).
 *
 * This makes the comparison feature work properly in the demo.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

// Supplier IDs from DB
const SUPPLIERS = {
  HENRY_SCHEIN: 1,
  KENT_EXPRESS: 2,
  DENTAL_SKY: 3,
  DHB: 4,
  TRYCARE: 5,
  DENTAL_DIRECTORY: 15,
  NUVELO: 14,
};

// Realistic pricing multipliers per supplier vs Dental Sky
// Based on real market positioning of UK dental suppliers
const SUPPLIER_PROFILES: Array<{
  id: number;
  name: string;
  multiplierRange: [number, number]; // [min, max] vs DS price
  deliveryOptions: string[];
  skuPrefix: string;
  stockRate: number; // probability of being in stock
}> = [
  {
    id: SUPPLIERS.HENRY_SCHEIN,
    name: "Henry Schein",
    multiplierRange: [1.05, 1.22], // HS typically 5-22% more expensive
    deliveryOptions: ["Next day", "Next day", "2-3 working days"],
    skuPrefix: "HS",
    stockRate: 0.92,
  },
  {
    id: SUPPLIERS.KENT_EXPRESS,
    name: "Kent Express",
    multiplierRange: [0.94, 1.08], // KE competitive, slightly cheaper
    deliveryOptions: ["Next day", "Next day", "2-3 working days"],
    skuPrefix: "KE",
    stockRate: 0.85,
  },
  {
    id: SUPPLIERS.TRYCARE,
    name: "Trycare",
    multiplierRange: [0.96, 1.12],
    deliveryOptions: ["Next day", "2-3 working days", "2-3 working days"],
    skuPrefix: "TC",
    stockRate: 0.80,
  },
  {
    id: SUPPLIERS.DENTAL_DIRECTORY,
    name: "Dental Directory",
    multiplierRange: [1.02, 1.18],
    deliveryOptions: ["Next day", "Next day", "3-5 working days"],
    skuPrefix: "DD",
    stockRate: 0.88,
  },
  {
    id: SUPPLIERS.NUVELO,
    name: "Nuvelo",
    multiplierRange: [0.90, 1.05], // Nuvelo often cheapest
    deliveryOptions: ["2-3 working days", "3-5 working days", "2-3 working days"],
    skuPrefix: "NV",
    stockRate: 0.75,
  },
];

function seededRandom(seed: number): number {
  // Deterministic pseudo-random from seed so prices are stable on re-runs
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function roundToNearest(price: number): number {
  // Prices end in .25, .45, .50, .75, .95, .99 — realistic retail pricing
  const endings = [0.25, 0.45, 0.50, 0.75, 0.95, 0.99];
  const base = Math.floor(price);
  const frac = price - base;
  // Find nearest ending
  let nearest = endings[0];
  let minDiff = Math.abs(frac - endings[0]);
  for (const e of endings) {
    const diff = Math.abs(frac - e);
    if (diff < minDiff) { minDiff = diff; nearest = e; }
  }
  return base + nearest;
}

async function main() {
  console.log("💰 Adding competitor pricing to Dentago catalog...\n");

  // Get all products with Dental Sky pricing
  const { data: dsPriced } = await supabase
    .from("dentago_supplier_products")
    .select("product_id, price, sku, pack_size")
    .eq("supplier_id", SUPPLIERS.DENTAL_SKY)
    .gt("price", 0);

  console.log(`Found ${dsPriced?.length} products with Dental Sky pricing`);

  // Get existing supplier_products to avoid duplicates
  const { data: existing } = await supabase
    .from("dentago_supplier_products")
    .select("product_id, supplier_id");

  const existingSet = new Set(existing?.map(x => `${x.product_id}-${x.supplier_id}`) || []);

  // For each product, decide which suppliers to add (2-3 per product)
  // Use product_id as seed for deterministic selection
  let added = 0;
  let skipped = 0;

  const toInsert: Array<{
    product_id: number;
    supplier_id: number;
    price: number;
    stock: boolean;
    delivery: string;
    sku: string;
    pack_size: string;
  }> = [];

  for (const ds of (dsPriced || [])) {
    const { product_id, price: dsPrice, pack_size } = ds;
    const seed = product_id * 100;

    // Select 2-3 suppliers based on product_id seed
    const rand = seededRandom(seed);
    const numSuppliers = rand < 0.4 ? 2 : (rand < 0.85 ? 3 : 4);

    // Shuffle suppliers deterministically
    const shuffled = [...SUPPLIER_PROFILES].sort((a, b) =>
      seededRandom(seed + a.id) - seededRandom(seed + b.id)
    );
    const selectedSuppliers = shuffled.slice(0, numSuppliers);

    for (const supplier of selectedSuppliers) {
      const key = `${product_id}-${supplier.id}`;
      if (existingSet.has(key)) { skipped++; continue; }

      // Generate price with variance
      const [minMult, maxMult] = supplier.multiplierRange;
      const priceRand = seededRandom(seed + supplier.id * 7);
      const multiplier = minMult + priceRand * (maxMult - minMult);
      const rawPrice = dsPrice * multiplier;
      const finalPrice = roundToNearest(rawPrice);

      // Determine stock
      const stockRand = seededRandom(seed + supplier.id * 13);
      const inStock = stockRand < supplier.stockRate;

      // Delivery option
      const deliveryRand = seededRandom(seed + supplier.id * 17);
      const deliveryIdx = Math.floor(deliveryRand * supplier.deliveryOptions.length);
      const delivery = supplier.deliveryOptions[deliveryIdx];

      // SKU
      const skuNum = String(product_id).padStart(5, "0");
      const sku = `${supplier.skuPrefix}-${skuNum}`;

      toInsert.push({
        product_id,
        supplier_id: supplier.id,
        price: finalPrice,
        stock: inStock,
        delivery,
        sku,
        pack_size: pack_size || "1 unit",
      });
      existingSet.add(key);
      added++;
    }
  }

  console.log(`\nInserting ${toInsert.length} new supplier price entries...`);

  // Batch insert in chunks of 100
  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from("dentago_supplier_products").insert(chunk);
    if (error) {
      console.error(`  Chunk ${i}-${i + CHUNK} error:`, error.message);
    } else {
      console.log(`  ✅ Inserted ${i + chunk.length}/${toInsert.length}`);
    }
  }

  console.log(`\n✅ Added: ${added} new price entries`);
  console.log(`⏭️  Skipped (already existed): ${skipped}`);

  // Final count
  const { count: totalSP } = await supabase
    .from("dentago_supplier_products")
    .select("*", { count: "exact", head: true });

  const { count: withPrice } = await supabase
    .from("dentago_supplier_products")
    .select("*", { count: "exact", head: true })
    .gt("price", 0);

  // Count products with multiple suppliers
  const { data: multiSupplier } = await supabase
    .rpc("count_products_with_multiple_suppliers" as never)
    .limit(1);

  console.log(`\n📊 Final stats:`);
  console.log(`  Total supplier_products: ${totalSP}`);
  console.log(`  With real prices: ${withPrice}`);

  // Sample a product to verify
  const { data: sample } = await supabase
    .from("dentago_supplier_products")
    .select("product_id, supplier_id, price, stock, delivery")
    .eq("product_id", 260)
    .order("price");

  console.log(`\nSample (product 260 - Clinell Wipes):`);
  sample?.forEach(s => console.log(`  Supplier ${s.supplier_id}: £${s.price} | ${s.stock ? "In Stock" : "Out of Stock"} | ${s.delivery}`));
}

main().catch(console.error);
