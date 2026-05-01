/**
 * fix-competitor-stock-and-prices.ts
 *
 * Two problems diagnosed:
 * 1. Competitor suppliers have too many out-of-stock entries → DS always wins
 * 2. Only ~115 products have multi-supplier comparisons, most have only DS
 *
 * Fixes:
 * 1. Set in-stock rate to ~92% for all competitors
 * 2. Re-calibrate prices so different suppliers win for different product types:
 *    - Kent Express: tends to be cheaper on consumables (gloves, masks, wipes)
 *    - Nuvelo: often cheapest overall but slower delivery
 *    - Henry Schein: premium priced (typically 8-20% more)
 *    - Trycare: competitive, sometimes cheaper on endodontic files and composites
 *    - Dental Directory: mid-range
 */

import { createClient } from "@supabase/supabase-js";

const s = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ0eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const supabase = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

// Deterministic but varied pseudo-random
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function roundPrice(price: number): number {
  const endings = [0.25, 0.45, 0.50, 0.75, 0.95, 0.99];
  const base = Math.floor(price);
  const frac = price - base;
  const nearest = endings.reduce((a, b) => Math.abs(b - frac) < Math.abs(a - frac) ? b : a);
  return base + nearest;
}

// Category-specific pricing strategy per supplier
// multiplier vs Dental Sky price
function getMultiplier(supplierId: number, category: string, productId: number): number {
  const seed = productId * supplierId;
  const r = rand(seed);

  const consumableCategories = ["Infection Control", "Consumables", "PPE"];
  const clinicalCategories = ["Composites & Bonding", "Endodontics", "Anaesthetics", "Cements & Liners"];

  const isConsumable = consumableCategories.some(c => category?.includes(c));
  const isClinical = clinicalCategories.some(c => category?.includes(c));

  switch (supplierId) {
    case 1: // Henry Schein - premium priced, always more expensive
      return 1.08 + r * 0.14; // 1.08-1.22x

    case 2: // Kent Express - cheaper on consumables, competitive elsewhere
      if (isConsumable) return 0.87 + r * 0.10; // 0.87-0.97x (often cheaper than DS)
      return 0.94 + r * 0.12; // 0.94-1.06x

    case 5: // Trycare - competitive on clinical, avg on consumables
      if (isClinical) return 0.91 + r * 0.10; // 0.91-1.01x
      return 0.97 + r * 0.10; // 0.97-1.07x

    case 14: // Nuvelo - often cheapest, slower delivery
      return 0.85 + r * 0.12; // 0.85-0.97x (frequently cheapest)

    case 15: // Dental Directory - mid-range
      return 0.96 + r * 0.12; // 0.96-1.08x

    default:
      return 0.92 + r * 0.16;
  }
}

async function main() {
  console.log("🔧 Fixing competitor stock rates and price calibration...\n");

  // Get all products with their categories
  const { data: products } = await supabase
    .from("dentago_products")
    .select("id, category");
  const productCategories = new Map(products?.map(p => [p.id, p.category]) || []);

  // Get all competitor supplier products (not DS)
  const { data: competitorSPs } = await supabase
    .from("dentago_supplier_products")
    .select("id, product_id, supplier_id, price, stock")
    .neq("supplier_id", 3) // not Dental Sky
    .gt("price", 0);

  console.log(`Found ${competitorSPs?.length} competitor supplier products to fix\n`);

  // Also get DS prices for reference
  const { data: dsPrices } = await supabase
    .from("dentago_supplier_products")
    .select("product_id, price")
    .eq("supplier_id", 3)
    .gt("price", 0);
  const dsPriceMap = new Map(dsPrices?.map(d => [d.product_id, d.price]) || []);

  let updated = 0;
  const CHUNK = 50;

  for (let i = 0; i < (competitorSPs?.length || 0); i += CHUNK) {
    const chunk = competitorSPs!.slice(i, i + CHUNK);

    await Promise.all(chunk.map(async (sp) => {
      const dsPrice = dsPriceMap.get(sp.product_id);
      const category = productCategories.get(sp.product_id) || "";

      // Fix stock: 92% in-stock rate
      const stockSeed = sp.product_id * 1000 + sp.supplier_id;
      const newStock = rand(stockSeed) < 0.92;

      // Fix price if we have DS reference
      let newPrice = sp.price;
      if (dsPrice && dsPrice > 0) {
        const multiplier = getMultiplier(sp.supplier_id, category, sp.product_id);
        newPrice = roundPrice(dsPrice * multiplier);
        // Ensure minimum viable price
        if (newPrice < 0.50) newPrice = 0.50;
      }

      await supabase
        .from("dentago_supplier_products")
        .update({ stock: newStock, price: newPrice })
        .eq("id", sp.id);

      updated++;
    }));

    if ((i + CHUNK) % 500 === 0) {
      console.log(`  Progress: ${Math.min(i + CHUNK, competitorSPs!.length)}/${competitorSPs!.length}`);
    }
  }

  console.log(`\n✅ Updated ${updated} competitor supplier products`);

  // Verify results
  const { data: allSPs } = await supabase
    .from("dentago_supplier_products")
    .select("product_id, supplier_id, price, stock")
    .gt("price", 0);

  const byProduct = new Map<number, Array<{supplier_id: number, price: number, stock: boolean}>>();
  for (const sp of allSPs || []) {
    if (!byProduct.has(sp.product_id)) byProduct.set(sp.product_id, []);
    byProduct.get(sp.product_id)!.push(sp);
  }

  let dsWins = 0, competitorWins = 0, multiSupplierProducts = 0;
  const winnerCount: Record<number, number> = {};

  for (const [pid, sps] of byProduct.entries()) {
    const inStock = sps.filter(s => s.stock && s.price > 0);
    if (inStock.length < 2) continue;
    multiSupplierProducts++;

    const minPrice = Math.min(...inStock.map(s => s.price));
    const winner = inStock.find(s => s.price === minPrice);
    if (!winner) continue;

    winnerCount[winner.supplier_id] = (winnerCount[winner.supplier_id] || 0) + 1;

    const dsPrice = inStock.find(s => s.supplier_id === 3)?.price;
    if (!dsPrice) continue;
    if (dsPrice === minPrice) dsWins++;
    else competitorWins++;
  }

  console.log(`\n📊 Products with 2+ in-stock suppliers: ${multiSupplierProducts}`);
  console.log(`  DS wins best price: ${dsWins}`);
  console.log(`  Competitor wins best price: ${competitorWins}`);
  console.log(`\nWins by supplier:`);

  const { data: suppliers } = await supabase.from("dentago_suppliers").select("id, name");
  for (const sup of (suppliers || [])) {
    if (winnerCount[sup.id]) {
      console.log(`  ${sup.name.padEnd(20)}: ${winnerCount[sup.id]} products`);
    }
  }
}

main().catch(console.error);
