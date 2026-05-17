/**
 * Kent Express authenticated price scraper.
 *
 * Flow:
 *  1. Load home page (Angular SPA)
 *  2. Click Sign In button → modal appears
 *  3. Fill credentials → captures login API response (auth token + cartId + accountNumber)
 *  4. Use captured headers to hit search + pricing APIs directly
 *  5. Write prices to dentago_supplier_products + price_cache
 *
 * Run: cd ~/dentago && bun run scripts/ke-scraper.ts
 */

import { chromium, type Browser } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";

const KE_USERNAME = "jerome@thedentistgallery.com";
const KE_PASSWORD = "Bracelet26";
// Warren's clinic (Jerome's creds are stored under Warren's account)
const WARREN_CLINIC_ID = "f3aa7eb1-ae23-4253-bf01-0f382d36ccb5";
const KE_DENTAGO_ID = 2; // dentago_suppliers.id for Kent Express

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const KE_SEARCH_TERMS = [
  "nitrile gloves", "latex gloves", "face masks", "infection control",
  "wipes disinfectant", "composites", "bonding adhesive",
  "endodontics files", "gutta percha", "impression material",
  "dental instruments", "fluoride", "x-ray", "crown bridge",
  "burs diamond", "burs carbide", "anaesthetic", "syringes",
  "surgical", "whitening", "glass ionomer cement",
  "matrix bands", "sutures", "implants", "scalers",
  "cotton rolls", "local anaesthetic septanest", "prophy paste",
];

interface AuthContext {
  headers: Record<string, string>;
  cartId: string;
  accountNumber: string;
  companyId: string;
  zipCode: string;
}

async function getKEAuthContext(): Promise<AuthContext | null> {
  console.log("🔐 Logging in to Kent Express as jerome@thedentistgallery.com...");
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    });

    let capturedHeaders: Record<string, string> = {};
    let cartId = "";
    let accountNumber = "";
    let companyId = "04420";
    let zipCode = "";
    let authToken = "";

    const capturedPromise = new Promise<void>(resolve => {
      page.on("request", req => {
        try {
          const url = req.url();
          const postData = req.postData() ?? "";

          // Capture auth token from login response
          if (url.includes("accounts.login") && req.method() === "POST") {
            console.log("  📡 Login API called:", url.slice(0, 100));
          }

          // Capture auth headers from any API call
          if (url.includes("api.kentexpress.co.uk") && req.headers()["authorization"]) {
            capturedHeaders = { ...req.headers() };
            authToken = req.headers()["authorization"] ?? "";
            const cm = url.match(/cartId=([^&]+)/);
            if (cm) cartId = cm[1];
            const acctMatch = postData.match(/"accountNumber":"(\d+)"/);
            const compMatch = postData.match(/"companyId":"(\d+)"/);
            if (acctMatch) accountNumber = acctMatch[1];
            if (compMatch) companyId = compMatch[1];
          }

          // Capture cartId from category/search or cart calls
          if ((url.includes("category/search") || url.includes("/cart")) && url.includes("cartId=") && !cartId) {
            const cm = url.match(/cartId=([^&]+)/);
            if (cm) {
              capturedHeaders = { ...req.headers() };
              cartId = cm[1];
              if (authToken) resolve();
            }
          }

          if (url.includes("web-product-pricing") && url.includes("linelevel")) {
            const zm = postData.match(/"zipCode":"([^"]*)"/);
            if (zm) zipCode = zm[1];
            const zm2 = postData.match(/"accountNumber":"(\d+)"/);
            if (zm2) accountNumber = zm2[1];
            if (cartId && authToken) resolve();
          }
        } catch { /* noop */ }
      });
    });

    // Load home page
    await page.goto("https://www.kentexpress.co.uk", { waitUntil: "networkidle", timeout: 60_000 });
    await delay(2000);

    // Accept cookies if present
    try { await page.click("button:has-text('Accept'), button:has-text('accept'), #accept-all", { timeout: 3000 }); await delay(500); } catch {}

    // Click Sign In using JavaScript (Angular SPA button)
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("a, button"));
      const signIn = buttons.find(el => /sign.?in/i.test(el.textContent?.trim() ?? ""));
      if (signIn) { (signIn as HTMLElement).click(); return true; }
      return false;
    });
    console.log(`  Clicked Sign In: ${clicked}`);
    await delay(3000);

    // Wait for email/username input to appear
    try {
      await page.waitForSelector("input[type='email'], input[name='userId'], input[name='username'], input[placeholder*='mail'], input[placeholder*='ser']", { timeout: 15_000 });
    } catch {
      console.log("  No email input found after clicking Sign In");
      // Try the Angular mat-input
      try { await page.waitForSelector("#mat-input-0, mat-form-field input", { timeout: 8_000 }); } catch {}
    }

    const inputs = await page.$$eval("input", els =>
      els.map(el => ({ type: (el as HTMLInputElement).type, id: el.id, name: (el as HTMLInputElement).name, placeholder: (el as HTMLInputElement).placeholder }))
    );
    console.log("  Visible inputs:", inputs.filter(i => i.type !== "hidden"));

    // Try to fill login form
    const emailSel = "input[type='email'], input[name='userId'], input[id*='email'], input[id*='user'], #mat-input-0, mat-form-field input:first-of-type";
    const passSel = "input[type='password']";

    const hasEmail = await page.$(emailSel);
    const hasPass = await page.$(passSel);

    if (hasEmail && hasPass) {
      await page.fill(emailSel, KE_USERNAME);
      await delay(300);
      await page.fill(passSel, KE_PASSWORD);
      await page.press(passSel, "Enter");
      console.log("  Submitted credentials — waiting for auth...");
      await delay(6000);

      console.log(`  Post-login URL: ${page.url()}`);

      // Navigate to a search to trigger product API calls
      await page.goto("https://www.kentexpress.co.uk/search?q=nitrile+gloves", { waitUntil: "networkidle", timeout: 45_000 });
      await Promise.race([capturedPromise, delay(20_000)]);
      await delay(3000);

      // Try to trigger pricing API
      if (authToken && !cartId) {
        await page.goto("https://www.kentexpress.co.uk/cart", { waitUntil: "networkidle", timeout: 30_000 });
        await Promise.race([capturedPromise, delay(10_000)]);
      }
    } else {
      console.log("  ❌ Login form not accessible via Playwright");
      await browser.close();
      return null;
    }

    await browser.close();
    browser = undefined;

    console.log(`  Auth token captured: ${!!authToken} (${authToken.slice(0, 30)}…)`);
    console.log(`  CartId: ${cartId.slice(0, 20) || "none"}`);
    console.log(`  AccountNumber: ${accountNumber || "none"}`);

    if (!authToken) {
      console.log("❌ No auth token captured — KE login did not work via Playwright");
      return null;
    }

    return { headers: capturedHeaders, cartId, accountNumber, companyId, zipCode };
  } catch (e) {
    console.error("Auth error:", e);
    try { await browser?.close(); } catch {}
    return null;
  }
}

async function searchKEProducts(query: string, auth: AuthContext, pageNum = 0): Promise<{ products: any[]; totalPages: number }> {
  // Try KE's product search API
  const queryB64 = Buffer.from(`${query}:relevance`).toString("base64");
  const url = `https://api.kentexpress.co.uk/eapi/web-product-details/v2/product/category/search/kentxprs-gb?query=${queryB64}&currentPage=${pageNum}&fields=FULL&pageSize=48&refCat=ALL&isPreferred=false&cartId=${auth.cartId}&currentShipToID=`;

  const res = await fetch(url, { headers: auth.headers });
  if (!res.ok) {
    const body = await res.text();
    console.log(`  ⚠️  KE Search ${res.status} for "${query}": ${body.slice(0, 100)}`);
    return { products: [], totalPages: 0 };
  }
  const json = await res.json() as any;
  return {
    products: json.products ?? [],
    totalPages: Math.min(json.pagination?.totalPages ?? 1, 15),
  };
}

async function fetchKEPrices(skus: string[], auth: AuthContext): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!skus.length) return out;

  const res = await fetch("https://api.kentexpress.co.uk/eapi/web-product-pricing/v2/product/pricing/linelevel", {
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
    const p = parseFloat(item.price?.unitPrice ?? "0");
    if (p > 0 && item.productId) out.set(item.productId, p);
  }
  return out;
}

async function main() {
  const auth = await getKEAuthContext();
  if (!auth) {
    console.log("\n❌ KE auth failed. Cannot scrape Kent Express.");
    process.exit(1);
  }

  // Load existing KE products (paginated)
  console.log("\n📥 Loading existing KE products from DB...");
  const dbProducts: { productId: number; sku: string }[] = [];
  let pg = 0;
  while (true) {
    const { data } = await supabase
      .from("dentago_supplier_products")
      .select("product_id, sku")
      .eq("supplier_id", KE_DENTAGO_ID)
      .range(pg * 1000, pg * 1000 + 999);
    if (!data?.length) break;
    for (const row of data) {
      if (row.sku) dbProducts.push({ productId: row.product_id, sku: row.sku });
    }
    console.log(`  Loaded ${dbProducts.length}...`);
    if (data.length < 1000) break;
    pg++;
    await delay(100);
  }
  console.log(`✅ ${dbProducts.length} existing KE products`);

  // Crawl KE for new products
  const captured = new Map<string, { sku: string; name: string; price: number; stock: boolean; packSize: string; category: string }>();

  for (const term of KE_SEARCH_TERMS) {
    console.log(`\n📦 "${term}"`);
    let p = 0, totalPages = 1;
    while (p < totalPages) {
      const { products, totalPages: tp } = await searchKEProducts(term, auth, p);
      totalPages = tp;
      if (!products.length) break;

      const ids = products.map((pr: any) => pr.code).filter(Boolean);
      const priceMap = new Map<string, number>();
      for (let i = 0; i < ids.length; i += 25) {
        const batch = ids.slice(i, i + 25);
        const bm = await fetchKEPrices(batch, auth);
        bm.forEach((v, k) => priceMap.set(k, v));
        if (i + 25 < ids.length) await delay(150);
      }

      let added = 0;
      for (const item of products) {
        const sku = item.code ?? item.sku ?? "";
        if (!sku) continue;
        const price = priceMap.get(sku) ?? item.price?.value ?? 0;
        const priceNum = typeof price === "number" ? price : parseFloat(String(price)) || 0;
        if (priceNum > 0) {
          captured.set(sku, {
            sku, name: item.name, price: priceNum,
            stock: item.stock?.stockLevelStatus !== "outOfStock",
            packSize: item.packSize ?? "1 unit",
            category: item.categories?.[0]?.name ?? "Consumables",
          });
          added++;
        }
      }
      console.log(`  p${p + 1}/${totalPages}: ${products.length} items, ${added} priced | total: ${captured.size}`);
      p++;
      if (p < totalPages) await delay(300);
    }
    await delay(400);
  }

  console.log(`\n🎯 Scraped ${captured.size} KE SKUs`);

  // Write to DB
  const skuToProductId = new Map<string, number>();
  dbProducts.forEach(({ productId, sku }) => skuToProductId.set(sku.toUpperCase(), productId));

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const foundProductIds = new Set<number>();
  let updated = 0, newProd = 0;
  const cacheRows: any[] = [];

  for (const [sku, product] of captured) {
    const productId = skuToProductId.get(sku.toUpperCase());
    if (productId) {
      await supabase.from("dentago_supplier_products").update({
        price: product.price, stock: product.stock, sku,
        delivery: "2-3 working days", pack_size: product.packSize,
      }).eq("product_id", productId).eq("supplier_id", KE_DENTAGO_ID);
      foundProductIds.add(productId);
      updated++;
    } else {
      // New product — need UUID from dentago_products
      const { data: newPr } = await supabase.from("dentago_products").insert({
        name: product.name, brand: "Kent Express", category: product.category,
        image: "", pack_size: product.packSize, description: `${product.name} — available from Kent Express.`,
        specs: [{ label: "SKU", value: sku }], similars: [],
      }).select("id").single();
      if (newPr) {
        await supabase.from("dentago_supplier_products").insert({
          product_id: newPr.id, supplier_id: KE_DENTAGO_ID, price: product.price,
          stock: product.stock, sku, delivery: "2-3 working days", pack_size: product.packSize,
        });
        foundProductIds.add(newPr.id);
        skuToProductId.set(sku.toUpperCase(), newPr.id);
        newProd++;
      }
    }

    const pid = skuToProductId.get(sku.toUpperCase());
    if (pid) {
      cacheRows.push({
        clinic_id: WARREN_CLINIC_ID, product_id: String(pid),
        supplier: "Kent Express", price: product.price, stock: product.stock,
        authenticated: true, fetched_at: now, expires_at: expiresAt,
      });
    }
  }

  // Flush cache
  for (let i = 0; i < cacheRows.length; i += 500) {
    await supabase.from("price_cache").upsert(cacheRows.slice(i, i + 500), { onConflict: "clinic_id,product_id,supplier" });
  }

  // Remove KE from products not found
  const toRemove = dbProducts.filter(p => !foundProductIds.has(p.productId)).map(p => p.productId);
  if (toRemove.length) {
    for (let i = 0; i < toRemove.length; i += 200) {
      await supabase.from("dentago_supplier_products").delete()
        .eq("supplier_id", KE_DENTAGO_ID).in("product_id", toRemove.slice(i, i + 200));
    }
  }

  const { count: finalCount } = await supabase
    .from("dentago_supplier_products").select("*", { count: "exact", head: true })
    .eq("supplier_id", KE_DENTAGO_ID);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ KENT EXPRESS IMPORT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SKUs scraped:             ${captured.size}
  Products updated:         ${updated}
  New products added:       ${newProd}
  KE removed from:          ${toRemove.length}
  Final KE catalog count:   ${finalCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
