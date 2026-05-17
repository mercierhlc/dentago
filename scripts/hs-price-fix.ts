/**
 * Henry Schein Price Fix — Phase 2 (corrected)
 *
 * The first import run loaded only 1000 existing HS products into memory (Supabase default limit).
 * This script:
 *   1. Loads ALL 32,250 existing HS dentago_supplier_products rows in paginated batches
 *   2. Loads the 15,186 scraped SKUs from the progress file (no re-login needed)
 *   3. Matches by SKU and upserts the real Karuna-negotiated price into dentago_supplier_products
 *   4. Writes price_cache rows for Karuna's clinic
 *   5. Removes Henry Schein from dentago_supplier_products for any product whose SKU
 *      was NOT seen in this session's scrape (product stays, HS link is removed)
 *
 * Run AFTER hs-full-import.ts has finished (progress file must exist).
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const KARUNA_CLINIC_ID = "2bb8d265-1242-49ad-a830-2e24253e2b1f";
// HS supplier_id in dentago_suppliers = 1 (Henry Schein)
// HS uuid in suppliers table = 47a097a8-5399-4a7c-b5c6-ae0997e37ee9
const HS_DENTAGO_ID = 1;
const HS_SUPPLIER_UUID = "47a097a8-5399-4a7c-b5c6-ae0997e37ee9";

const PROGRESS_PATH = path.join(process.env.HOME!, "Downloads", "hs-full-import-progress.json");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function loadAllHsProducts(): Promise<Map<string, number>> {
  console.log("📥 Loading all existing Henry Schein products from DB (paginated)...");
  const skuToProductId = new Map<string, number>();
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("dentago_supplier_products")
      .select("product_id, sku")
      .eq("supplier_id", HS_DENTAGO_ID)
      .range(from, from + PAGE_SIZE - 1);

    if (error) { console.error("Error loading HS products:", error); break; }
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.sku) skuToProductId.set((row.sku as string).toUpperCase(), row.product_id as number);
    }

    console.log(`  Loaded ${from + data.length} existing HS products...`);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    await delay(100);
  }

  console.log(`✅ Loaded ${skuToProductId.size} existing HS products with SKUs`);
  return skuToProductId;
}

async function main() {
  // Load scraped data from progress file
  if (!fs.existsSync(PROGRESS_PATH)) {
    console.error("❌ Progress file not found — run hs-full-import.ts first");
    process.exit(1);
  }

  const rawData: [string, any][] = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
  const scraped = new Map<string, any>(rawData);
  console.log(`📋 Loaded ${scraped.size} scraped SKUs from progress file`);

  // Load all existing HS products (paginated)
  const skuToProductId = await loadAllHsProducts();

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  let updated = 0, skipped = 0, notFound = 0;
  const foundProductIds = new Set<number>();
  const allEntries = [...scraped.entries()];

  console.log(`\n💾 Upserting ${allEntries.length} scraped SKUs against ${skuToProductId.size} existing HS products...`);

  const BATCH = 100;
  for (let i = 0; i < allEntries.length; i += BATCH) {
    const chunk = allEntries.slice(i, i + BATCH);
    const cacheRows: any[] = [];

    for (const [sku, product] of chunk) {
      if (!product.price || product.price <= 0) { skipped++; continue; }

      const productId = skuToProductId.get(sku.toUpperCase());

      if (!productId) {
        notFound++;
        continue;
      }

      foundProductIds.add(productId);

      // Update price + stock in dentago_supplier_products
      await supabase
        .from("dentago_supplier_products")
        .update({
          price: product.price,
          stock: product.stock,
          sku,
          delivery: "1-2 working days",
          pack_size: product.packSize,
        })
        .eq("product_id", productId)
        .eq("supplier_id", HS_DENTAGO_ID);

      updated++;

      // Queue price_cache row for Karuna
      cacheRows.push({
        clinic_id: KARUNA_CLINIC_ID,
        product_id: String(productId),
        supplier: "Henry Schein",
        price: product.price,
        stock: product.stock,
        authenticated: true,
        fetched_at: now,
        expires_at: expiresAt,
      });
    }

    if (cacheRows.length) {
      await supabase.from("price_cache").upsert(cacheRows, { onConflict: "clinic_id,product_id,supplier" });
    }

    if (i % 1000 === 0 || i + BATCH >= allEntries.length) {
      console.log(`  ${i + chunk.length}/${allEntries.length} | updated: ${updated} | not found: ${notFound} | skipped: ${skipped}`);
    }
    await delay(30);
  }

  // Remove HS from products NOT seen this session
  console.log(`\n🧹 Finding HS products NOT in this scrape session...`);

  // Get all product_ids for HS in dentago_supplier_products
  const allHsProductIds: number[] = [];
  let pg = 0;
  while (true) {
    const { data } = await supabase
      .from("dentago_supplier_products")
      .select("product_id")
      .eq("supplier_id", HS_DENTAGO_ID)
      .range(pg * 1000, pg * 1000 + 999);
    if (!data || !data.length) break;
    allHsProductIds.push(...data.map((r: any) => r.product_id));
    if (data.length < 1000) break;
    pg++;
    await delay(50);
  }

  const toRemove = allHsProductIds.filter(pid => !foundProductIds.has(pid));
  console.log(`  Total HS products in DB:  ${allHsProductIds.length}`);
  console.log(`  Found in scrape:          ${foundProductIds.size}`);
  console.log(`  To remove HS from:        ${toRemove.length}`);

  if (toRemove.length > 0 && toRemove.length < 35000) { // sanity check — don't nuke everything
    for (let i = 0; i < toRemove.length; i += 200) {
      const chunk = toRemove.slice(i, i + 200);
      await supabase
        .from("dentago_supplier_products")
        .delete()
        .eq("supplier_id", HS_DENTAGO_ID)
        .in("product_id", chunk);
    }

    // Also clean price_cache for Karuna
    const toRemoveStr = toRemove.map(String);
    for (let i = 0; i < toRemoveStr.length; i += 200) {
      const chunk = toRemoveStr.slice(i, i + 200);
      await supabase
        .from("price_cache")
        .delete()
        .eq("clinic_id", KARUNA_CLINIC_ID)
        .eq("supplier", "Henry Schein")
        .in("product_id", chunk);
    }
    console.log(`  ✅ Removed Henry Schein from ${toRemove.length} products`);
  } else if (toRemove.length === 0) {
    console.log(`  ✅ All HS products were seen — nothing to remove`);
  } else {
    console.log(`  ⚠️  Skipped removal — ${toRemove.length} is suspiciously large, manual review needed`);
  }

  // Update last_synced on Karuna's HS credential
  await supabase
    .from("supplier_credentials")
    .update({ last_synced: now })
    .eq("clinic_id", KARUNA_CLINIC_ID)
    .eq("supplier_id", HS_SUPPLIER_UUID);

  // Verify final state
  const { count: finalCount } = await supabase
    .from("dentago_supplier_products")
    .select("*", { count: "exact", head: true })
    .eq("supplier_id", HS_DENTAGO_ID);

  const { count: cacheCount } = await supabase
    .from("price_cache")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", KARUNA_CLINIC_ID)
    .eq("supplier", "Henry Schein");

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ HENRY SCHEIN PRICE FIX COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Scraped SKUs processed:              ${allEntries.length}
  Prices updated in catalog:           ${updated}
  SKUs not matched (not in DB):        ${notFound}
  Skipped (no price):                  ${skipped}
  HS removed from products:            ${toRemove.length}

  Final HS products in catalog:        ${finalCount}
  Karuna's HS price_cache entries:     ${cacheCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(e => { console.error("❌ Fatal:", e); process.exit(1); });
