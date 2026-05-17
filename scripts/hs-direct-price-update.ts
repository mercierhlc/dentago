/**
 * Henry Schein Direct Price Update
 *
 * More efficient than category crawling:
 *  1. Logs in via Playwright once to capture auth headers
 *  2. Loads all 32,250 existing HS SKUs from dentago_supplier_products (paginated)
 *  3. Hits the HS linelevel pricing API in batches of 25 — gets exact negotiated prices
 *  4. Upserts prices back to dentago_supplier_products + price_cache for Karuna
 *  5. Removes HS from any product whose SKU returned no price (out of catalog)
 *
 * Run: cd ~/dentago && bun run scripts/hs-direct-price-update.ts
 */

import { chromium, type Browser } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";

const HS_USERNAME = "karuna.giri";
const HS_PASSWORD = "Dental2024";
const KARUNA_CLINIC_ID = "2bb8d265-1242-49ad-a830-2e24253e2b1f";
const HS_DENTAGO_ID = 1;       // dentago_suppliers.id for Henry Schein
const HS_SUPPLIER_UUID = "47a097a8-5399-4a7c-b5c6-ae0997e37ee9"; // suppliers.id

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface AuthContext {
  headers: Record<string, string>;
  accountNumber: string;
  companyId: string;
  cartId: string;
  zipCode: string;
}

async function getAuthContext(): Promise<AuthContext> {
  console.log("🔐 Logging in to Henry Schein as karuna.giri...");
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    });

    let capturedHeaders: Record<string, string> = {};
    let accountNumber = "";
    let companyId = "04420";
    let cartId = "";
    let zipCode = "";

    const capturedPromise = new Promise<void>(resolve => {
      page.on("request", req => {
        try {
          const url = req.url();
          const postData = req.postData() ?? "";
          if (req.method() === "POST" && url.includes("web-product-pricing") && url.includes("linelevel")) {
            const zm = postData.match(/"zipCode":"([^"]*)"/);
            if (zm) zipCode = zm[1];
          }
          if (url.includes("category/search") && url.includes("cartId=") && !cartId) {
            capturedHeaders = { ...req.headers() };
            const cm = url.match(/cartId=([^&]+)/);
            if (cm) { cartId = cm[1]; resolve(); }
          }
          const acctMatch = postData.match(/"accountNumber":"(\d+)"/);
          const compMatch = postData.match(/"companyId":"(\d+)"/);
          if (acctMatch) accountNumber = acctMatch[1];
          if (compMatch) companyId = compMatch[1];
        } catch { /* noop */ }
      });
    });

    await page.goto("https://www.henryschein.co.uk", { waitUntil: "domcontentloaded", timeout: 45_000 });
    await delay(2000);
    try { await page.click("button:has-text('Accept all')", { timeout: 3000 }); await delay(500); } catch {}

    await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find(a => a.textContent?.trim() === "Sign In");
      if (a) (a as HTMLElement).click();
    });
    await delay(2500);
    await page.waitForSelector("#mat-input-0,input[type='password']", { timeout: 20_000 });
    await page.fill("#mat-input-0", HS_USERNAME);
    await delay(300);
    await page.fill("input[type='password']", HS_PASSWORD);
    await page.press("input[type='password']", "Enter");
    await delay(5000);

    await page.goto("https://www.henryschein.co.uk/search/gloves?type=Products", { waitUntil: "networkidle", timeout: 60_000 });
    await Promise.race([capturedPromise, delay(20_000)]);
    await delay(2000);

    if (!accountNumber) {
      const m = page.url().match(/shipToAccountNumber=(\d+)/);
      if (m) accountNumber = m[1];
    }

    await browser.close();
    browser = undefined;

    if (!capturedHeaders["authorization"]) throw new Error("No auth header captured — login failed");
    if (!cartId) throw new Error("No cartId captured");

    console.log(`✅ Auth captured — account: ${accountNumber}, cartId: ${cartId.slice(0, 10)}…`);
    return { headers: capturedHeaders, accountNumber, companyId, cartId, zipCode };
  } finally {
    try { await browser?.close(); } catch {}
  }
}

async function fetchPrices(skus: string[], auth: AuthContext): Promise<Map<string, { price: number; stock: boolean }>> {
  const out = new Map<string, { price: number; stock: boolean }>();
  if (!skus.length) return out;

  const res = await fetch("https://api.henryschein.co.uk/eapi/web-product-pricing/v2/product/pricing/linelevel", {
    method: "POST",
    headers: { ...auth.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountNumber: auth.accountNumber,
      companyId: auth.companyId,
      countryId: "GB",
      item: skus.map(sku => ({ productId: sku, quantity: "1", unitOfMeasure: "EA", hsProductRestricted: false })),
      isInventoryRequired: true, isPriceRequired: true, isRestrictionRequired: true,
      isCostRequired: false, isPriceGuidanceRequired: false, defaultWebShippingMethod: "",
      zipCode: auth.zipCode ?? "", isTsmUser: false, isQuantityBreakRequired: false,
      isPriceOverrideRequired: false, isInventoryStatusRequired: false,
      isInventoryQtyRequired: false, isDeliveryDateRequired: false,
    }),
  });

  if (!res.ok) return out;
  const json = await res.json() as any;
  if (json.status?.code !== "200") return out;

  for (const item of (json.item ?? [])) {
    const price = parseFloat(item.price?.unitPrice ?? "0");
    const stock = item.inventoryStatus?.code !== "OOS" && item.inventoryStatus?.code !== "TEMPORARY";
    if (price > 0 && item.productId) out.set(item.productId, { price, stock });
  }
  return out;
}

async function main() {
  // Step 1: Auth
  const auth = await getAuthContext();

  // Step 2: Load ALL existing HS products (paginated)
  console.log("\n📥 Loading all existing HS products from DB...");
  const dbProducts: { productId: number; sku: string }[] = [];
  const PAGE_SIZE = 1000;
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from("dentago_supplier_products")
      .select("product_id, sku")
      .eq("supplier_id", HS_DENTAGO_ID)
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (error || !data?.length) break;
    for (const row of data) {
      if (row.sku) dbProducts.push({ productId: row.product_id, sku: row.sku });
    }
    console.log(`  Loaded ${dbProducts.length}...`);
    if (data.length < PAGE_SIZE) break;
    page++;
    await delay(100);
  }

  console.log(`✅ ${dbProducts.length} existing HS products loaded`);

  // Step 3: Hit pricing API for each SKU in batches of 25
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const PRICE_BATCH = 25;

  let pricesUpdated = 0;
  let noPrice = 0;
  const foundProductIds = new Set<number>();
  const cacheQueue: any[] = [];

  console.log(`\n💰 Fetching negotiated prices for ${dbProducts.length} SKUs (${Math.ceil(dbProducts.length / PRICE_BATCH)} API calls)...`);

  for (let i = 0; i < dbProducts.length; i += PRICE_BATCH) {
    const batch = dbProducts.slice(i, i + PRICE_BATCH);
    const skus = batch.map(p => p.sku);

    const priceMap = await fetchPrices(skus, auth);

    const updateBatch: any[] = [];

    for (const { productId, sku } of batch) {
      const result = priceMap.get(sku);
      if (!result || result.price <= 0) { noPrice++; continue; }

      foundProductIds.add(productId);
      pricesUpdated++;

      updateBatch.push({ productId, price: result.price, stock: result.stock, sku });
      cacheQueue.push({
        clinic_id: KARUNA_CLINIC_ID,
        product_id: String(productId),
        supplier: "Henry Schein",
        price: result.price,
        stock: result.stock,
        authenticated: true,
        fetched_at: now,
        expires_at: expiresAt,
      });
    }

    // Update dentago_supplier_products for this batch
    for (const u of updateBatch) {
      await supabase
        .from("dentago_supplier_products")
        .update({ price: u.price, stock: u.stock })
        .eq("product_id", u.productId)
        .eq("supplier_id", HS_DENTAGO_ID);
    }

    // Flush price cache every 500 rows
    if (cacheQueue.length >= 500) {
      const flush = cacheQueue.splice(0, 500);
      await supabase.from("price_cache").upsert(flush, { onConflict: "clinic_id,product_id,supplier" });
    }

    if (i % 1000 === 0 || i + PRICE_BATCH >= dbProducts.length) {
      const pct = Math.round(((i + PRICE_BATCH) / dbProducts.length) * 100);
      console.log(`  ${Math.min(i + PRICE_BATCH, dbProducts.length)}/${dbProducts.length} (${pct}%) | priced: ${pricesUpdated} | no price: ${noPrice}`);
    }

    await delay(80); // be polite to the API
  }

  // Flush remaining cache rows
  if (cacheQueue.length) {
    await supabase.from("price_cache").upsert(cacheQueue, { onConflict: "clinic_id,product_id,supplier" });
  }

  // Step 4: Remove HS from products with no price returned
  const toRemove = dbProducts.filter(p => !foundProductIds.has(p.productId)).map(p => p.productId);
  console.log(`\n🧹 Products with no HS price: ${toRemove.length} — removing Henry Schein link`);

  if (toRemove.length > 0) {
    for (let i = 0; i < toRemove.length; i += 200) {
      const chunk = toRemove.slice(i, i + 200);
      await supabase.from("dentago_supplier_products").delete()
        .eq("supplier_id", HS_DENTAGO_ID).in("product_id", chunk);
    }
    // Clean Karuna price_cache
    const toRemoveStr = toRemove.map(String);
    for (let i = 0; i < toRemoveStr.length; i += 200) {
      await supabase.from("price_cache").delete()
        .eq("clinic_id", KARUNA_CLINIC_ID).eq("supplier", "Henry Schein")
        .in("product_id", toRemoveStr.slice(i, i + 200));
    }
  }

  // Update last_synced
  await supabase.from("supplier_credentials").update({ last_synced: now })
    .eq("clinic_id", KARUNA_CLINIC_ID).eq("supplier_id", HS_SUPPLIER_UUID);

  // Final verification
  const { count: finalCatalog } = await supabase
    .from("dentago_supplier_products")
    .select("*", { count: "exact", head: true })
    .eq("supplier_id", HS_DENTAGO_ID);

  const { count: finalCache } = await supabase
    .from("price_cache")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", KARUNA_CLINIC_ID)
    .eq("supplier", "Henry Schein");

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ HENRY SCHEIN DIRECT PRICE UPDATE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  HS products in DB loaded:      ${dbProducts.length}
  Prices successfully fetched:   ${pricesUpdated}
  No price returned (removed):   ${toRemove.length}
  Skipped (no price in API):     ${noPrice}

  Final HS catalog entries:      ${finalCatalog}
  Karuna's price_cache (HS):     ${finalCache}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(e => { console.error("❌ Fatal:", e); process.exit(1); });
