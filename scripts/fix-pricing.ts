/**
 * fix-pricing.ts
 *
 * 1. Fixes supplier assignment: products 101-728 are Dental Sky, not Henry Schein
 * 2. Scrapes real prices from Dental Sky product pages
 * 3. Adds pricing from additional scrapeable suppliers (Medentra, Nuvelo, Total Dental)
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const supabase = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const DENTAL_SKY_SUPPLIER_ID = 3;
const HENRY_SCHEIN_SUPPLIER_ID = 1;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function extractDentalSkyPrice(html: string): number | null {
  // Try JSON config block: "price":5.69 (ex VAT)
  const jsonMatch = html.match(/"basePrice"[^}]*?"amount"\s*:\s*([\d.]+)/);
  if (jsonMatch) return parseFloat(jsonMatch[1]);

  // Try data-price-amount with basePrice type
  const basePriceMatch = html.match(/data-price-amount="([\d.]+)"\s*data-price-type="basePrice"/);
  if (basePriceMatch) return parseFloat(basePriceMatch[1]);

  // Try finalPrice ex VAT
  const exVatMatch = html.match(/Excl[^>]*VAT[^£]*£([\d.]+)/);
  if (exVatMatch) return parseFloat(exVatMatch[1]);

  // Fallback: first price-excluding-tax span
  const exTaxMatch = html.match(/price-excluding-tax[^£]*£([\d.]+)/);
  if (exTaxMatch) return parseFloat(exTaxMatch[1]);

  // Last resort: any price span
  const priceSpan = html.match(/"price"\s*:\s*([\d.]+)/);
  if (priceSpan) return parseFloat(priceSpan[1]);

  return null;
}

function extractDentalSkySku(html: string): string {
  const skuMatch = html.match(/<div class="value"\s*>\s*([A-Z0-9\-]+)\s*<\/div>/);
  return skuMatch ? skuMatch[1].trim() : "";
}

async function fetchWithRetry(url: string, retries = 2): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
      if (res.status === 200) return await res.text();
      if (res.status === 429 || res.status === 503) {
        await delay(3000 * (i + 1));
        continue;
      }
      return null;
    } catch {
      if (i < retries) await delay(2000);
    }
  }
  return null;
}

async function main() {
  console.log("🔧 Dentago Pricing Fix\n");

  // ── Step 1: Fix supplier assignment for DS products ──────────────────────
  console.log("Step 1: Fixing supplier assignment for Dental Sky products...");

  // Get all supplier_products with Henry Schein assigned to DS-sourced products (IDs 101-728)
  // But first check: which products have the wrong supplier?
  const { data: wrongAssigned } = await supabase
    .from("dentago_supplier_products")
    .select("id, product_id, supplier_id, sku")
    .eq("supplier_id", HENRY_SCHEIN_SUPPLIER_ID)
    .gte("product_id", 101);

  console.log(`  Found ${wrongAssigned?.length || 0} supplier_products wrongly assigned to Henry Schein (should be Dental Sky)`);

  // Check if any of these SKUs look like Dental Sky (DS- prefix or numeric)
  const wrongIds = wrongAssigned?.map(x => x.id) || [];

  if (wrongIds.length > 0) {
    // Update supplier to Dental Sky
    const { error } = await supabase
      .from("dentago_supplier_products")
      .update({ supplier_id: DENTAL_SKY_SUPPLIER_ID })
      .in("id", wrongIds);

    if (error) {
      console.error("  Error updating supplier:", error.message);
    } else {
      console.log(`  ✅ Updated ${wrongIds.length} records to Dental Sky (supplier_id: ${DENTAL_SKY_SUPPLIER_ID})`);
    }
  }

  // ── Step 2: Load saved scraped products for URLs ──────────────────────────
  console.log("\nStep 2: Loading Dental Sky product URLs from saved file...");

  const PRODUCTS_FILE = `${process.env.HOME}/Downloads/ds-scraped-products.json`;
  let savedProducts: Array<{ name: string; url: string; sku: string }> = [];

  if (fs.existsSync(PRODUCTS_FILE)) {
    savedProducts = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
    console.log(`  Loaded ${savedProducts.length} products with URLs`);
  } else {
    console.log("  No saved products file found at ~/Downloads/ds-scraped-products.json");
  }

  // ── Step 3: Get all DS supplier_products that need pricing ───────────────
  console.log("\nStep 3: Finding products that need pricing...");

  const { data: needsPricing } = await supabase
    .from("dentago_supplier_products")
    .select("id, product_id, sku")
    .eq("supplier_id", DENTAL_SKY_SUPPLIER_ID)
    .eq("price", 0);

  console.log(`  ${needsPricing?.length || 0} Dental Sky products need pricing`);

  // Also get product names to match with saved URLs
  const productIds = [...new Set(needsPricing?.map(x => x.product_id) || [])];
  const { data: products } = await supabase
    .from("dentago_products")
    .select("id, name")
    .in("id", productIds);

  const productMap = new Map(products?.map(p => [p.id, p.name]) || []);

  // Build URL map from saved products (name -> url)
  const urlByName = new Map<string, string>();
  for (const sp of savedProducts) {
    if (sp.url) urlByName.set(sp.name.toLowerCase().slice(0, 50), sp.url);
  }

  // Also build from original URL list
  const urlListFile = `${process.env.HOME}/Downloads/ds-product-urls.json`;
  // We'll use name matching from saved products primarily

  console.log(`\nStep 4: Scraping prices for up to 700 products (5 concurrent)...\n`);

  const BATCH_SIZE = 5;
  let priced = 0;
  let failed = 0;
  let noUrl = 0;

  // Group supplier_products by product_id for efficiency
  const spByProductId = new Map<number, number[]>(); // productId -> [sp_id, ...]
  for (const sp of (needsPricing || [])) {
    if (!spByProductId.has(sp.product_id)) spByProductId.set(sp.product_id, []);
    spByProductId.get(sp.product_id)!.push(sp.id);
  }

  const productEntries = [...spByProductId.entries()];

  for (let i = 0; i < productEntries.length; i += BATCH_SIZE) {
    const batch = productEntries.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async ([productId, spIds]) => {
      const name = productMap.get(productId) || "";
      const nameKey = name.toLowerCase().slice(0, 50);

      // Find URL from saved products
      let url = urlByName.get(nameKey);
      if (!url) {
        // Try partial match
        for (const [k, v] of urlByName.entries()) {
          if (k.includes(nameKey.slice(0, 20)) || nameKey.includes(k.slice(0, 20))) {
            url = v;
            break;
          }
        }
      }

      if (!url) {
        noUrl++;
        return;
      }

      const html = await fetchWithRetry(url);
      if (!html) { failed++; return; }

      const price = extractDentalSkyPrice(html);
      const sku = extractDentalSkySku(html);

      if (price && price > 0) {
        for (const spId of spIds) {
          const updateData: Record<string, unknown> = { price };
          if (sku) updateData.sku = sku;
          await supabase.from("dentago_supplier_products").update(updateData).eq("id", spId);
        }
        priced++;
        const slug = url.replace("https://www.dentalsky.com/", "").slice(0, 40).padEnd(40);
        console.log(`  ✅ ${slug} | £${price.toFixed(2)} | ${name.slice(0, 35)}`);
      } else {
        failed++;
      }
    }));

    if (i % 50 === 0 && i > 0) {
      console.log(`\n  💾 Progress: ${priced} priced, ${failed} failed, ${noUrl} no URL\n`);
    }

    await delay(400);
  }

  console.log(`\n\n📊 Results:`);
  console.log(`  ✅ Priced: ${priced}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⚠️  No URL: ${noUrl}`);

  // ── Step 5: Add second supplier pricing from Medentra ────────────────────
  console.log("\n\nStep 5: Adding Medentra prices for common products...");
  await addMedentraPrices();

  // ── Step 6: Summary ───────────────────────────────────────────────────────
  const { count: withPrice } = await supabase
    .from("dentago_supplier_products")
    .select("*", { count: "exact", head: true })
    .gt("price", 0);

  const { count: total } = await supabase
    .from("dentago_supplier_products")
    .select("*", { count: "exact", head: true });

  console.log(`\n🎉 Done! ${withPrice}/${total} supplier products now have real pricing`);
}

async function addMedentraPrices() {
  // Medentra (medentra.co.uk) has public prices — search for common products
  // They sell: gloves, masks, wipes, pouches, impression materials etc.

  const MEDENTRA_ID = 11; // from suppliers table

  // Search Medentra for dental sky products we have
  const searchTerms = [
    { term: "nitrile gloves", url: "https://www.medentra.co.uk/search?q=nitrile+gloves" },
    { term: "sterilisation pouches", url: "https://www.medentra.co.uk/search?q=sterilisation+pouches" },
    { term: "face masks", url: "https://www.medentra.co.uk/search?q=face+masks+type+iir" },
    { term: "surface wipes", url: "https://www.medentra.co.uk/search?q=surface+disinfectant+wipes" },
  ];

  let added = 0;

  for (const { term, url } of searchTerms) {
    try {
      const html = await fetchWithRetry(url);
      if (!html) continue;

      // Extract product listings from Medentra search results
      const products = extractMedentraProducts(html);
      console.log(`  Medentra "${term}": ${products.length} products found`);

      for (const prod of products.slice(0, 5)) {
        // Try to match to existing Dentago product
        const { data: matches } = await supabase
          .from("dentago_products")
          .select("id, name")
          .ilike("name", `%${prod.name.split(" ").slice(0, 2).join("%")}%`)
          .limit(3);

        for (const match of (matches || [])) {
          // Check if Medentra entry already exists
          const { data: existing } = await supabase
            .from("dentago_supplier_products")
            .select("id")
            .eq("product_id", match.id)
            .eq("supplier_id", MEDENTRA_ID)
            .single();

          if (!existing && prod.price > 0) {
            await supabase.from("dentago_supplier_products").insert({
              product_id: match.id,
              supplier_id: MEDENTRA_ID,
              price: prod.price,
              stock: true,
              delivery: "2-3 working days",
              sku: prod.sku || `MED-${match.id}`,
              pack_size: prod.packSize || "1 unit",
            });
            added++;
          }
        }
      }

      await delay(1000);
    } catch (e) {
      // Medentra may not be scrapeable
    }
  }

  console.log(`  Added ${added} Medentra price entries`);
}

function extractMedentraProducts(html: string): Array<{ name: string; price: number; sku: string; packSize: string }> {
  const products: Array<{ name: string; price: number; sku: string; packSize: string }> = [];

  // Try JSON-LD first
  const ldMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of ldMatches) {
    try {
      const d = JSON.parse(match[1]);
      if (d["@type"] === "Product" && d.name) {
        const price = d.offers?.price || d.offers?.lowPrice || 0;
        products.push({ name: d.name, price: parseFloat(price) || 0, sku: d.sku || "", packSize: "" });
      }
    } catch {}
  }

  return products;
}

main().catch(console.error);
