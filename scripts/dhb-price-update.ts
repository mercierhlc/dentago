/**
 * DHB Dental price update via public Magento 2 GraphQL.
 * No login needed — dhb.co.uk GraphQL is publicly accessible.
 *
 * Strategy:
 *  1. Auto-discover all DHB category IDs (recursive children)
 *  2. Crawl all categories paginated, build SKU → price map
 *  3. Load all existing DHB products from dentago_supplier_products (paginated)
 *  4. Update prices + SKUs in DB
 *  5. Remove DHB from products not found in feed
 *
 * Run: cd ~/dentago && npx tsx scripts/dhb-price-update.ts
 */
import "dotenv/config";
import * as https from "https";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const WARREN_CLINIC_ID = "f3aa7eb1-ae23-4253-bf01-0f382d36ccb5";
const DHB_DENTAGO_ID = 4;
const DHB_HOST = "dhb.co.uk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function gqlPost(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request(
      {
        hostname: DHB_HOST,
        path: "/graphql",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch (e) { reject(e); }
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function discoverAllCategoryIds(): Promise<Array<{ id: string; name: string }>> {
  const query = `{
    categoryList(filters: { ids: { eq: "2" } }) {
      id name
      children {
        id name
        children {
          id name
          children { id name children { id name } }
        }
      }
    }
  }`;
  try {
    const res = await gqlPost(query);
    const roots: any[] = res?.data?.categoryList ?? [];
    const collected: Array<{ id: string; name: string }> = [];
    function walk(nodes: any[]) {
      for (const node of nodes) {
        if (node.id && node.name) collected.push({ id: String(node.id), name: node.name });
        if (node.children?.length) walk(node.children);
      }
    }
    for (const root of roots) {
      if (root.children?.length) walk(root.children);
    }
    const seen = new Set<string>();
    return collected.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  } catch {
    // Fallback: top-level categories from initial test
    return [
      { id: "4", name: "Anaesthetics & Pharmaceuticals" },
      { id: "167", name: "Cadcam" },
      { id: "170", name: "Cross Infection" },
      { id: "3", name: "Disposables" },
      { id: "5", name: "Endodontics" },
      { id: "6", name: "Etching & Bonding" },
      { id: "7", name: "Filling Materials" },
      { id: "52", name: "Finishing & Polishing" },
      { id: "57", name: "Hand Instruments" },
      { id: "64", name: "Infection Control" },
      { id: "63", name: "Impression Material" },
      { id: "65", name: "Liners & Cements" },
      { id: "66", name: "Oral Hygiene" },
      { id: "67", name: "Orthodontic" },
      { id: "68", name: "Posts & Pins" },
      { id: "69", name: "Practice Builders" },
      { id: "70", name: "Prosthetics" },
      { id: "71", name: "Rotary Instruments" },
      { id: "74", name: "Temporary Crown" },
      { id: "73", name: "Surgical" },
      { id: "61", name: "Small Equipment" },
      { id: "75", name: "Whitening" },
      { id: "76", name: "X-Ray" },
    ];
  }
}

const PAGE_SIZE = 100;

async function crawlCategory(catId: string, catName: string, priceMap: Map<string, { price: number; stock: boolean }>): Promise<number> {
  let page = 1;
  let found = 0;
  while (true) {
    const query = `{
      products(
        filter: { category_id: { eq: "${catId}" } }
        pageSize: ${PAGE_SIZE}
        currentPage: ${page}
      ) {
        total_count
        items {
          sku
          name
          stock_status
          price_range {
            minimum_price {
              final_price { value }
              regular_price { value }
            }
          }
        }
      }
    }`;
    try {
      const res = await gqlPost(query);
      const items: any[] = res?.data?.products?.items ?? [];
      if (!items.length) break;
      for (const item of items) {
        if (!item.sku) continue;
        const finalPrice = item.price_range?.minimum_price?.final_price?.value;
        const regPrice = item.price_range?.minimum_price?.regular_price?.value;
        const price = (typeof finalPrice === "number" && finalPrice > 0) ? finalPrice
          : (typeof regPrice === "number" && regPrice > 0) ? regPrice : 0;
        if (price > 0) {
          const stock = item.stock_status !== "OUT_OF_STOCK";
          priceMap.set(item.sku.trim(), { price, stock });
          found++;
        }
      }
      if (items.length < PAGE_SIZE) break;
      page++;
      await delay(50);
    } catch (e) {
      console.error(`  Error crawling cat ${catId} page ${page}:`, e);
      break;
    }
  }
  return found;
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  DHB DENTAL — GraphQL Price Update");
  console.log("═══════════════════════════════════════\n");

  // Step 1: Discover categories
  console.log("🔍 Discovering DHB categories...");
  const categories = await discoverAllCategoryIds();
  console.log(`  Found ${categories.length} categories`);

  // Step 2: Crawl all categories
  console.log("\n🕷️ Crawling categories for prices...");
  const priceMap = new Map<string, { price: number; stock: boolean }>();
  let catsDone = 0;
  for (const cat of categories) {
    const found = await crawlCategory(cat.id, cat.name, priceMap);
    catsDone++;
    if (catsDone % 10 === 0 || catsDone === categories.length) {
      console.log(`  ${catsDone}/${categories.length} categories | ${priceMap.size} unique SKUs so far`);
    }
    await delay(50);
  }
  console.log(`\n✅ Crawl complete — ${priceMap.size} unique DHB SKUs with prices`);

  // Step 3: Load existing DHB products from DB
  console.log("\n📥 Loading existing DHB products from DB...");
  const dbProducts: Array<{ productId: number; sku: string; productName: string }> = [];
  let pg = 0;
  while (true) {
    const { data } = await supabase
      .from("dentago_supplier_products")
      .select("product_id, sku, dentago_products(name)")
      .eq("supplier_id", DHB_DENTAGO_ID)
      .range(pg * 1000, pg * 1000 + 999);
    if (!data?.length) break;
    for (const row of data) {
      dbProducts.push({
        productId: row.product_id,
        sku: row.sku ?? "",
        productName: (row as any).dentago_products?.name ?? "",
      });
    }
    console.log(`  Loaded ${dbProducts.length}...`);
    if (data.length < 1000) break;
    pg++;
    await delay(100);
  }
  console.log(`✅ ${dbProducts.length} existing DHB products in DB`);

  // Step 4: Match and update
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const foundProductIds = new Set<number>();
  let updated = 0, noPrice = 0, noSku = 0;
  const cacheRows: any[] = [];

  for (const { productId, sku, productName } of dbProducts) {
    if (!sku) { noSku++; continue; }
    const result = priceMap.get(sku.trim());
    if (!result) { noPrice++; continue; }

    foundProductIds.add(productId);
    updated++;

    await supabase.from("dentago_supplier_products")
      .update({ price: result.price, stock: result.stock })
      .eq("product_id", productId)
      .eq("supplier_id", DHB_DENTAGO_ID);

    cacheRows.push({
      clinic_id: WARREN_CLINIC_ID,
      product_id: String(productId),
      supplier: "DHB",
      price: result.price,
      stock: result.stock,
      authenticated: false,
      fetched_at: now,
      expires_at: expiresAt,
    });

    if (cacheRows.length >= 200) {
      await supabase.from("price_cache").upsert(cacheRows.splice(0, 200), { onConflict: "clinic_id,product_id,supplier" });
    }
  }

  if (cacheRows.length) {
    await supabase.from("price_cache").upsert(cacheRows, { onConflict: "clinic_id,product_id,supplier" });
  }

  // Step 5: Remove DHB from products not in feed
  const toRemove = dbProducts.filter(p => !foundProductIds.has(p.productId)).map(p => p.productId);
  if (toRemove.length) {
    for (let i = 0; i < toRemove.length; i += 200) {
      await supabase.from("dentago_supplier_products").delete()
        .eq("supplier_id", DHB_DENTAGO_ID).in("product_id", toRemove.slice(i, i + 200));
    }
  }

  const { count: finalCatalog } = await supabase
    .from("dentago_supplier_products").select("*", { count: "exact", head: true })
    .eq("supplier_id", DHB_DENTAGO_ID);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DHB PRICE UPDATE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DHB SKUs fetched from GraphQL:  ${priceMap.size}
  DB products loaded:              ${dbProducts.length}
  Prices updated:                  ${updated}
  No SKU in DB:                    ${noSku}
  SKU not in DHB feed:             ${noPrice}
  Removed from catalog:            ${toRemove.length}
  Final DHB catalog:               ${finalCatalog}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
