/**
 * Henry Schein Full Import — Karuna Giri credentials
 *
 * 1. Logs in via Playwright with karuna.giri / Dental2024
 * 2. Crawls ALL HS products across 22 dental search categories (pagination included)
 * 3. Fetches Karuna's real negotiated unit prices via the HS linelevel pricing API
 * 4. Writes to dentago_supplier_products (SKU + price + stock) — creating new dentago_products if needed
 * 5. Writes Karuna's prices to price_cache
 * 6. After crawl: removes "Henry Schein" from dentago_supplier_products for any product
 *    that was NOT found in this session (keeps the product itself intact)
 *
 * Run: cd ~/dentago && bun run scripts/hs-full-import.ts
 *
 * For maximum SKU coverage + env-based credentials, use instead:
 *   npm run catalog:hs-import-all
 *   (see scripts/hs-import-all-skus.ts)
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";

const HS_USERNAME = "karuna.giri";
const HS_PASSWORD = "Dental2024";
const KARUNA_CLINIC_ID = "2bb8d265-1242-49ad-a830-2e24253e2b1f";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const PROGRESS_PATH = path.join(process.env.HOME!, "Downloads", "hs-full-import-progress.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const HS_SEARCH_TERMS = [
  "anaesthetics", "gloves nitrile", "gloves latex", "face masks",
  "infection control", "wipes disinfectant", "composites", "bonding",
  "endodontics", "files rotary", "gutta percha", "impression materials",
  "instruments forceps", "orthodontics", "preventive fluoride",
  "diagnostics x-ray", "crown bridge", "burs diamond", "burs carbide",
  "syringes dental", "surgical", "whitening", "cement glass ionomer",
  "matrix bands", "sutures", "implants", "scalers", "probes",
  "saliva ejectors", "cotton rolls", "local anaesthetic",
];

interface HSProduct {
  sku: string;
  name: string;
  brand: string;
  price: number;
  stock: boolean;
  image: string;
  packSize: string;
  category: string;
}

interface AuthContext {
  headers: Record<string, string>;
  accountNumber: string;
  companyId: string;
  cartId: string;
  zipCode: string;
}

async function getAuthContext(): Promise<AuthContext> {
  console.log("🔐 Logging in to Henry Schein as karuna.giri...");
  const browser = await chromium.launch({ headless: true });
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

  if (!capturedHeaders["authorization"]) {
    console.error("❌ Failed to capture auth headers — login may have failed");
    process.exit(1);
  }
  if (!cartId) {
    console.error("❌ No cartId captured");
    process.exit(1);
  }

  console.log(`✅ Logged in — account: ${accountNumber}, cartId: ${cartId.slice(0, 10)}…, zip: "${zipCode}"`);
  return { headers: capturedHeaders, accountNumber, companyId, cartId, zipCode };
}

async function searchProducts(query: string, auth: AuthContext, page = 0, pageSize = 48): Promise<{ products: any[]; totalPages: number }> {
  const queryB64 = Buffer.from(`${query}:relevance`).toString("base64");
  const url = `https://api.henryschein.co.uk/eapi/web-product-details/v2/product/category/search/dental-gb?query=${queryB64}&currentPage=${page}&fields=FULL&pageSize=${pageSize}&refCat=ALL&isPreferred=false&cartId=${auth.cartId}&currentShipToID=`;
  const res = await fetch(url, { headers: auth.headers });
  if (!res.ok) {
    console.log(`  ⚠️  Search ${res.status} for "${query}" p${page}`);
    return { products: [], totalPages: 0 };
  }
  const json = await res.json() as any;
  const products = json.products ?? [];
  const totalPages = Math.min(json.pagination?.totalPages ?? 1, 20);
  return { products, totalPages };
}

async function fetchPrices(productIds: string[], auth: AuthContext): Promise<Map<string, number>> {
  if (!productIds.length) return new Map();
  const res = await fetch("https://api.henryschein.co.uk/eapi/web-product-pricing/v2/product/pricing/linelevel", {
    method: "POST",
    headers: { ...auth.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountNumber: auth.accountNumber,
      companyId: auth.companyId,
      countryId: "GB",
      item: productIds.map(id => ({ productId: id, quantity: "1", unitOfMeasure: "EA", hsProductRestricted: false })),
      isInventoryRequired: true, isPriceRequired: true, isRestrictionRequired: true,
      isCostRequired: false, isPriceGuidanceRequired: false, defaultWebShippingMethod: "",
      zipCode: auth.zipCode ?? "", isTsmUser: false, isQuantityBreakRequired: false,
      isPriceOverrideRequired: false, isInventoryStatusRequired: false,
      isInventoryQtyRequired: false, isDeliveryDateRequired: false,
    }),
  });
  if (!res.ok) return new Map();
  const json = await res.json() as any;
  if (json.status?.code !== "200") return new Map();
  const out = new Map<string, number>();
  for (const item of (json.item ?? [])) {
    const p = parseFloat(item.price?.unitPrice ?? "0");
    if (p > 0 && item.productId) out.set(item.productId, p);
  }
  return out;
}

function parseProduct(item: any, priceMap: Map<string, number>): HSProduct | null {
  const name = (item.name ?? "").trim();
  if (!name || name.length < 3) return null;
  const sku = item.code ?? item.sku ?? "";
  if (!sku) return null;
  const price = priceMap.get(sku) ?? item.price?.value ?? 0;
  const priceNum = typeof price === "number" ? price : parseFloat(String(price)) || 0;
  const stock = item.stock?.stockLevelStatus !== "outOfStock"
    && item.availabilityCode?.code !== "TEMPORARY"
    && item.availabilityCode?.code !== "OOS";
  const img = item.images?.[0]?.url ?? item.primaryImage?.url ?? "";
  return {
    sku,
    name,
    brand: item.manufacturer ?? item.brand?.name ?? "Henry Schein",
    price: priceNum,
    stock,
    image: img.startsWith("/") ? `https://www.henryschein.co.uk${img}` : img,
    packSize: item.packSize ?? item.unitOfMeasure ?? "1 unit",
    category: item.categories?.[0]?.name ?? "Consumables",
  };
}

async function runImport() {
  // Load or start fresh
  let capturedRaw: [string, HSProduct][] = [];
  if (fs.existsSync(PROGRESS_PATH)) {
    capturedRaw = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
    console.log(`📋 Resuming — ${capturedRaw.length} products already captured`);
  }
  const captured = new Map<string, HSProduct>(capturedRaw);

  // Get Henry Schein supplier IDs
  const { data: hsRow } = await supabase.from("dentago_suppliers").select("id, name").ilike("name", "henry schein").single();
  if (!hsRow) { console.error("❌ Henry Schein not in dentago_suppliers"); process.exit(1); }
  const hsDentaGoId: number = hsRow.id;

  const { data: hsSupRow } = await supabase.from("suppliers").select("id").ilike("name", "henry schein").maybeSingle();
  const hsSupabaseId: string = hsSupRow?.id ?? "47a097a8-5399-4a7c-b5c6-ae0997e37ee9";

  console.log(`✅ Henry Schein — dentago_suppliers.id: ${hsDentaGoId}, suppliers.id: ${hsSupabaseId}`);

  // Get auth
  const auth = await getAuthContext();

  // Crawl all search terms
  for (const term of HS_SEARCH_TERMS) {
    console.log(`\n📦 "${term}"`);
    let pg = 0, totalPages = 1;

    while (pg < totalPages) {
      const { products, totalPages: tp } = await searchProducts(term, auth, pg);
      totalPages = tp;
      if (!products.length) break;

      const ids = products.map((p: any) => p.code).filter(Boolean);
      const priceMap = new Map<string, number>();
      for (let i = 0; i < ids.length; i += 25) {
        const batch = ids.slice(i, i + 25);
        const bPrices = await fetchPrices(batch, auth);
        bPrices.forEach((v, k) => priceMap.set(k, v));
        if (i + 25 < ids.length) await delay(150);
      }

      let added = 0;
      for (const item of products) {
        const parsed = parseProduct(item, priceMap);
        if (parsed && parsed.price > 0) { captured.set(parsed.sku, parsed); added++; }
      }
      console.log(`  page ${pg + 1}/${totalPages}: ${products.length} items, ${added} priced | running total: ${captured.size}`);
      pg++;
      if (pg < totalPages) await delay(300);
    }

    fs.writeFileSync(PROGRESS_PATH, JSON.stringify([...captured.entries()], null, 2));
    await delay(400);
  }

  console.log(`\n🎯 Crawl complete — ${captured.size} unique SKUs with prices`);

  // ── PHASE 2: Write to DB ──────────────────────────────────────────────────

  // Load existing HS products in dentago_supplier_products
  const { data: existingHsProds } = await supabase
    .from("dentago_supplier_products")
    .select("id, product_id, sku")
    .eq("supplier_id", hsDentaGoId);

  const skuToProductId = new Map<string, number>();
  const productIdToSupProdId = new Map<number, number>();
  (existingHsProds ?? []).forEach((row: any) => {
    if (row.sku) skuToProductId.set(row.sku.toUpperCase(), row.product_id);
    productIdToSupProdId.set(row.product_id, row.id);
  });

  const foundProductIds = new Set<number>();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  let updatedProd = 0, newProd = 0, skipped = 0, priceCacheRows = 0;
  const BATCH = 50;
  const allEntries = [...captured.entries()];

  console.log(`\n💾 Writing ${allEntries.length} products to database in batches of ${BATCH}...`);

  for (let i = 0; i < allEntries.length; i += BATCH) {
    const chunk = allEntries.slice(i, i + BATCH);

    for (const [sku, product] of chunk) {
      if (!product.price || product.price <= 0) { skipped++; continue; }

      const upperSku = sku.toUpperCase();
      let productId = skuToProductId.get(upperSku);

      if (productId) {
        // Update existing
        await supabase.from("dentago_supplier_products").upsert({
          product_id: productId,
          supplier_id: hsDentaGoId,
          price: product.price,
          stock: product.stock,
          sku,
          delivery: "1-2 working days",
          pack_size: product.packSize,
        }, { onConflict: "product_id,supplier_id" });
        updatedProd++;
        foundProductIds.add(productId);
      } else {
        // Create new dentago product
        const { data: newProduct } = await supabase
          .from("dentago_products")
          .insert({
            name: product.name,
            brand: product.brand,
            category: product.category || "Consumables",
            image: product.image,
            pack_size: product.packSize,
            description: `${product.name} — available from Henry Schein UK.`,
            specs: [{ label: "SKU", value: sku }],
            similars: [],
          })
          .select("id")
          .single();

        if (newProduct) {
          await supabase.from("dentago_supplier_products").insert({
            product_id: newProduct.id,
            supplier_id: hsDentaGoId,
            price: product.price,
            stock: product.stock,
            sku,
            delivery: "1-2 working days",
            pack_size: product.packSize,
          });
          skuToProductId.set(upperSku, newProduct.id);
          foundProductIds.add(newProduct.id);
          newProd++;
        }
      }
    }

    // Write price_cache rows for Karuna's clinic (batch)
    const cacheRows = chunk
      .filter(([, p]) => p.price > 0)
      .map(([sku, product]) => {
        const pid = skuToProductId.get(sku.toUpperCase());
        if (!pid) return null;
        return {
          clinic_id: KARUNA_CLINIC_ID,
          product_id: String(pid),
          supplier: "Henry Schein",
          price: product.price,
          stock: product.stock,
          authenticated: true,
          fetched_at: now,
          expires_at: expiresAt,
        };
      })
      .filter(Boolean) as any[];

    if (cacheRows.length) {
      await supabase.from("price_cache").upsert(cacheRows, { onConflict: "clinic_id,product_id,supplier" });
      priceCacheRows += cacheRows.length;
    }

    if ((i / BATCH) % 10 === 0) {
      console.log(`  Progress: ${i + chunk.length}/${allEntries.length} | updated: ${updatedProd} | new: ${newProd} | cache rows: ${priceCacheRows}`);
    }
    await delay(50);
  }

  // ── PHASE 3: Remove HS from products NOT found this session ──────────────
  console.log(`\n🧹 Cleaning up — removing Henry Schein from products not seen this session...`);

  const allHsProductIds = (existingHsProds ?? []).map((r: any) => r.product_id as number);
  const notFoundProductIds = allHsProductIds.filter(pid => !foundProductIds.has(pid));

  console.log(`  Existing HS products: ${allHsProductIds.length}`);
  console.log(`  Found this session:   ${foundProductIds.size}`);
  console.log(`  To remove HS from:    ${notFoundProductIds.length}`);

  if (notFoundProductIds.length > 0) {
    // Delete in chunks of 100
    for (let i = 0; i < notFoundProductIds.length; i += 100) {
      const chunk = notFoundProductIds.slice(i, i + 100);
      await supabase
        .from("dentago_supplier_products")
        .delete()
        .eq("supplier_id", hsDentaGoId)
        .in("product_id", chunk);
    }
    // Also remove from price_cache for Karuna where HS is supplier and product not found
    const notFoundStrings = notFoundProductIds.map(String);
    for (let i = 0; i < notFoundStrings.length; i += 100) {
      const chunk = notFoundStrings.slice(i, i + 100);
      await supabase
        .from("price_cache")
        .delete()
        .eq("clinic_id", KARUNA_CLINIC_ID)
        .eq("supplier", "Henry Schein")
        .in("product_id", chunk);
    }
    console.log(`  ✅ Removed Henry Schein from ${notFoundProductIds.length} products`);
  }

  // Update last_synced on Karuna's credential
  await supabase
    .from("supplier_credentials")
    .update({ last_synced: now })
    .eq("clinic_id", KARUNA_CLINIC_ID)
    .eq("supplier_id", hsSupabaseId);

  // Clean up progress file
  if (fs.existsSync(PROGRESS_PATH)) fs.unlinkSync(PROGRESS_PATH);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ HENRY SCHEIN FULL IMPORT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Products updated:           ${updatedProd}
  New products added:         ${newProd}
  Skipped (no price):         ${skipped}
  Price cache rows (Karuna):  ${priceCacheRows}
  HS removed from products:   ${notFoundProductIds.length}
  Total unique SKUs scraped:  ${captured.size}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

runImport().catch(e => { console.error("❌ Fatal:", e); process.exit(1); });
