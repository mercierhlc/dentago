/**
 * Henry Schein price scraper — API-based
 *
 * Logs in via Playwright, captures auth headers, then calls HS internal APIs
 * directly to fetch product listings + negotiated prices, and upserts to Supabase.
 *
 * Usage:
 *   HS_EMAIL=your-hs-login HS_PASSWORD='…' npx tsx scripts/scrape-hs-prices.ts
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const HS_EMAIL = process.env.HS_EMAIL ?? "";
const HS_PASSWORD = process.env.HS_PASSWORD ?? "";

if (!HS_EMAIL || !HS_PASSWORD) {
  console.error("❌ Set HS_EMAIL and HS_PASSWORD environment variables");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const PROGRESS_PATH = path.join(process.env.HOME!, "Downloads", "hs-prices-progress.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  /** From portal linelevel POST; HS pricing rejects minimal payloads without it. */
  zipCode: string;
}

const HS_SEARCH_TERMS = [
  "anaesthetics", "gloves", "masks", "infection control",
  "composites", "endodontics", "impression", "instruments",
  "orthodontics", "preventive", "diagnostics", "crown bridge",
  "sutures", "implants", "burs", "syringes", "surgical",
  "whitening", "cement", "bonding", "matrix",
];

async function getAuthContext(): Promise<AuthContext> {
  console.log("🔐 Logging in to capture auth context...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.6099.130 Safari/537.36",
  });

  await page.goto("https://www.henryschein.co.uk", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000);
  try { await page.click("button:has-text('Accept all')", { timeout: 3000 }); await delay(1000); } catch {}
  await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find(a => a.textContent?.trim() === "Sign In");
    if (a) (a as HTMLElement).click();
  });
  await delay(3000);
  await page.waitForSelector("input[type='password']", { timeout: 15000 });
  await page.fill("#mat-input-0", HS_EMAIL);
  await delay(300);
  await page.fill("input[type='password']", HS_PASSWORD);
  await page.press("input[type='password']", "Enter");
  await delay(5000);

  let capturedHeaders: Record<string, string> = {};
  let accountNumber = "";
  let companyId = "04420";
  let cartId = "";
  let zipCode = "";

  const captured = new Promise<void>(resolve => {
    page.on("request", req => {
      const url = req.url();
      const postData = req.postData() ?? "";
      if (req.method() === "POST" && url.includes("web-product-pricing") && url.includes("linelevel")) {
        const zm = postData.match(/"zipCode":"([^"]*)"/);
        if (zm) zipCode = zm[1];
      }
      if (url.includes("category/search") && url.includes("cartId=") && !cartId) {
        capturedHeaders = { ...req.headers() };
        const cartMatch = url.match(/cartId=([^&]+)/);
        if (cartMatch) cartId = cartMatch[1];
        resolve();
      }
      const acctMatch = postData.match(/"accountNumber":"(\d+)"/);
      const compMatch = postData.match(/"companyId":"(\d+)"/);
      if (acctMatch) accountNumber = acctMatch[1];
      if (compMatch) companyId = compMatch[1];
    });
  });

  await page.goto("https://www.henryschein.co.uk/search/gloves?type=Products", {
    waitUntil: "networkidle", timeout: 60000
  });
  await Promise.race([captured, delay(20000)]);
  await delay(3000);

  if (!accountNumber) {
    const url = page.url();
    const m = url.match(/shipToAccountNumber=(\d+)/);
    if (m) accountNumber = m[1];
  }

  await browser.close();

  if (!capturedHeaders["authorization"]) {
    console.error("❌ Failed to capture auth headers");
    process.exit(1);
  }

  console.log(`✅ Auth captured — account: ${accountNumber}, cartId: ${cartId.slice(0, 8)}..., zip: ${zipCode || "(none)"}`);
  return { headers: capturedHeaders, accountNumber, companyId, cartId, zipCode };
}

async function searchProducts(
  query: string,
  auth: AuthContext,
  page = 0,
  pageSize = 48
): Promise<{ products: any[]; totalPages: number }> {
  const queryB64 = Buffer.from(`${query}:relevance`).toString("base64");
  const url = `https://api.henryschein.co.uk/eapi/web-product-details/v2/product/category/search/dental-gb?query=${queryB64}&currentPage=${page}&fields=FULL&pageSize=${pageSize}&refCat=ALL&isPreferred=false&cartId=${auth.cartId}&currentShipToID=`;

  const res = await fetch(url, { headers: auth.headers });

  if (!res.ok) {
    const body = await res.text();
    console.log(`  ⚠️  Search API ${res.status} for "${query}": ${body.slice(0, 100)}`);
    return { products: [], totalPages: 0 };
  }

  const json = await res.json() as any;
  const products = json.products ?? [];
  const pagination = json.pagination ?? {};
  const totalPages = pagination.totalPages ?? (products.length < pageSize ? 1 : 2);
  return { products, totalPages };
}

async function fetchPrices(
  productIds: string[],
  auth: AuthContext
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const res = await fetch("https://api.henryschein.co.uk/eapi/web-product-pricing/v2/product/pricing/linelevel", {
    method: "POST",
    headers: { ...auth.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountNumber: auth.accountNumber,
      companyId: auth.companyId,
      countryId: "GB",
      item: productIds.map(id => ({
        productId: id,
        quantity: "1",
        unitOfMeasure: "EA",
        hsProductRestricted: false,
      })),
      isInventoryRequired: true,
      isPriceRequired: true,
      isRestrictionRequired: true,
      isCostRequired: false,
      isPriceGuidanceRequired: false,
      defaultWebShippingMethod: "",
      zipCode: auth.zipCode ?? "",
      isTsmUser: false,
      isQuantityBreakRequired: false,
      isPriceOverrideRequired: false,
      isInventoryStatusRequired: false,
      isInventoryQtyRequired: false,
      isDeliveryDateRequired: false,
    }),
  });

  if (!res.ok) {
    console.log(`  ⚠️  Pricing API ${res.status}`);
    return new Map();
  }

  const json = await res.json() as {
    status?: { code?: string };
    item?: { productId?: string; price?: { unitPrice?: string } }[];
  };
  if (json.status?.code !== "200") {
    console.log(`  ⚠️  Pricing API error status: ${JSON.stringify(json.status)}`);
    return new Map();
  }
  const priceMap = new Map<string, number>();
  for (const item of (json.item ?? [])) {
    const price = parseFloat(item.price?.unitPrice ?? "0");
    if (price > 0 && item.productId) priceMap.set(item.productId, price);
  }
  return priceMap;
}

function parseProduct(item: any, priceMap: Map<string, number>): HSProduct | null {
  const name = item.name ?? "";
  if (!name || name.length < 3) return null;

  const sku = item.code ?? item.sku ?? "";
  if (!sku) return null;

  const price = priceMap.get(sku) ?? item.price?.value ?? 0;
  const priceNum = typeof price === "number" ? price : parseFloat(price) || 0;

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
    image: img.startsWith("https://www.henryschein.co.uk/") ? img : img.startsWith("/") ? `https://www.henryschein.co.uk${img}` : "",
    packSize: item.packSize ?? item.unitOfMeasure ?? "1 unit",
    category: item.categories?.[0]?.name ?? "",
  };
}

async function upsertPrices(captured: Map<string, HSProduct>, hsId: number): Promise<void> {
  console.log(`\n💾 Upserting ${captured.size} products to database...`);

  const { data: existingRows } = await supabase
    .from("dentago_supplier_products")
    .select("product_id, sku")
    .eq("supplier_id", hsId);

  const skuToProductId = new Map<string, number>();
  (existingRows ?? []).forEach((row: any) => {
    if (row.sku) skuToProductId.set(row.sku.toUpperCase(), row.product_id);
  });

  let updated = 0, newProducts = 0, skipped = 0;

  for (const [sku, product] of captured) {
    if (!product.price || product.price <= 0) { skipped++; continue; }

    const productId = skuToProductId.get(sku.toUpperCase());

    if (productId) {
      const { error } = await supabase.from("dentago_supplier_products").upsert({
        product_id: productId,
        supplier_id: hsId,
        price: product.price,
        stock: product.stock,
        sku,
        delivery: "1-2 working days",
        pack_size: product.packSize,
      }, { onConflict: "product_id,supplier_id" });
      if (!error) { updated++; if (updated % 100 === 0) console.log(`  ✅ Updated ${updated}...`); }
    } else {
      const { data: newProduct, error: insertErr } = await supabase
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

      if (!insertErr && newProduct) {
        await supabase.from("dentago_supplier_products").insert({
          product_id: newProduct.id,
          supplier_id: hsId,
          price: product.price,
          stock: product.stock,
          sku,
          delivery: "1-2 working days",
          pack_size: product.packSize,
        });
        newProducts++;
        if (newProducts % 50 === 0) console.log(`  🆕 Added ${newProducts} new...`);
      }
    }
  }

  console.log(`\n✅ Done:`);
  console.log(`   ${updated} prices updated`);
  console.log(`   ${newProducts} new products added`);
  console.log(`   ${skipped} skipped (no price)`);
}

async function main() {
  let capturedRaw: [string, HSProduct][] = [];
  if (fs.existsSync(PROGRESS_PATH)) {
    capturedRaw = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
    console.log(`📋 Resuming — ${capturedRaw.length} products already captured`);
  }
  const captured = new Map<string, HSProduct>(capturedRaw);

  const { data: suppliers } = await supabase.from("dentago_suppliers").select("id, name");
  const hs = suppliers?.find((s: any) => s.name.toLowerCase().includes("henry"));
  if (!hs) { console.error("❌ Henry Schein not found"); process.exit(1); }
  console.log(`✅ Henry Schein supplier ID: ${hs.id}`);

  const auth = await getAuthContext();

  for (const term of HS_SEARCH_TERMS) {
    console.log(`\n📦 Searching: "${term}"`);
    let pg = 0;
    let totalPages = 1;

    while (pg < totalPages && pg < 20) {
      const { products, totalPages: tp } = await searchProducts(term, auth, pg);
      totalPages = Math.min(tp, 20);

      if (products.length === 0) break;

      // Fetch real prices in batches of 25
      const allIds = products.map((p: any) => p.code).filter(Boolean);
      const priceMap = new Map<string, number>();
      for (let i = 0; i < allIds.length; i += 25) {
        const batch = allIds.slice(i, i + 25);
        const batchPrices = await fetchPrices(batch, auth);
        batchPrices.forEach((v, k) => priceMap.set(k, v));
        if (i + 25 < allIds.length) await delay(200);
      }

      let added = 0;
      for (const item of products) {
        const parsed = parseProduct(item, priceMap);
        if (parsed && parsed.price > 0) {
          captured.set(parsed.sku, parsed);
          added++;
        }
      }

      console.log(`  📄 Page ${pg + 1}/${totalPages}: ${products.length} items, ${added} with prices | total: ${captured.size}`);
      pg++;
      if (pg < totalPages) await delay(300);
    }

    fs.writeFileSync(PROGRESS_PATH, JSON.stringify([...captured.entries()], null, 2));
    await delay(500);
  }

  console.log(`\n🎯 Total products captured: ${captured.size}`);
  await upsertPrices(captured, hs.id);
}

main().catch(console.error);
