/**
 * Henry Schein UK — authenticated catalogue discovery via the same APIs the
 * storefront uses (category search + line-level pricing). Used by
 * `scripts/hs-import-all-skus.ts`; keep free of clinic-specific IDs.
 */

import { chromium } from "playwright";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type HenryScheinAuthContext = {
  headers: Record<string, string>;
  accountNumber: string;
  companyId: string;
  cartId: string;
  zipCode: string;
};

export type HenryScheinCatalogProduct = {
  sku: string;
  name: string;
  brand: string;
  price: number;
  stock: boolean;
  image: string;
  packSize: string;
  category: string;
};

/** Default search stems (overlap heavily — dedupe by SKU in the runner). */
export const HENRY_SCHEIN_DEFAULT_SEARCH_TERMS: readonly string[] = [
  "anaesthetics",
  "gloves nitrile",
  "gloves latex",
  "face masks",
  "infection control",
  "wipes disinfectant",
  "composites",
  "bonding",
  "endodontics",
  "files rotary",
  "gutta percha",
  "impression materials",
  "instruments forceps",
  "orthodontics",
  "preventive fluoride",
  "diagnostics x-ray",
  "crown bridge",
  "burs diamond",
  "burs carbide",
  "syringes dental",
  "surgical",
  "whitening",
  "cement glass ionomer",
  "matrix bands",
  "sutures",
  "implants",
  "scalers",
  "probes",
  "saliva ejectors",
  "cotton rolls",
  "local anaesthetic",
  "handpiece",
  "autoclave",
  "barrier film",
  "bibs",
  "etchant",
  "sealant",
  "articulating",
  "alginate",
  "vinyl polysiloxane",
  "temporary crown",
  "composite gun",
  "endo motor",
  "apex locator",
  "rubber dam",
  "needle",
  "anaesthetic cartridge",
];

export function buildHenryScheinSearchQueries(extraFromEnv?: string): string[] {
  const out = new Set<string>();
  for (const c of "abcdefghijklmnopqrstuvwxyz0123456789") out.add(c);
  for (const t of HENRY_SCHEIN_DEFAULT_SEARCH_TERMS) out.add(t);
  if (extraFromEnv?.trim()) {
    for (const line of extraFromEnv.split(/[\n,]+/)) {
      const q = line.trim();
      if (q.length >= 1) out.add(q);
    }
  }
  return [...out];
}

/**
 * Playwright login + capture auth headers from the first category/search XHR
 * (same technique as legacy `hs-full-import.ts`).
 */
export async function loginHenryScheinCatalogImport(
  username: string,
  password: string,
): Promise<HenryScheinAuthContext> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: UA });

  let capturedHeaders: Record<string, string> = {};
  let accountNumber = "";
  let companyId = "04420";
  let cartId = "";
  let zipCode = "";

  const capturedPromise = new Promise<void>((resolve) => {
    page.on("request", (req) => {
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
          if (cm) {
            cartId = cm[1];
            resolve();
          }
        }
        const acctMatch = postData.match(/"accountNumber":"(\d+)"/);
        const compMatch = postData.match(/"companyId":"(\d+)"/);
        if (acctMatch) accountNumber = acctMatch[1];
        if (compMatch) companyId = compMatch[1];
      } catch {
        /* noop */
      }
    });
  });

  await page.goto("https://www.henryschein.co.uk", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await delay(2000);
  try {
    await page.click("button:has-text('Accept all')", { timeout: 3000 });
    await delay(500);
  } catch {
    /* cookie banner optional */
  }

  await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((x) => x.textContent?.trim() === "Sign In");
    if (a) (a as HTMLElement).click();
  });
  await delay(2500);
  await page.waitForSelector("#mat-input-0,input[type='password']", { timeout: 20_000 });
  await page.fill("#mat-input-0", username);
  await delay(300);
  await page.fill("input[type='password']", password);
  await page.press("input[type='password']", "Enter");
  await delay(5000);

  await page.goto("https://www.henryschein.co.uk/search/gloves?type=Products", {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await Promise.race([capturedPromise, delay(20_000)]);
  await delay(2000);

  if (!accountNumber) {
    const m = page.url().match(/shipToAccountNumber=(\d+)/);
    if (m) accountNumber = m[1];
  }

  await browser.close();

  if (!capturedHeaders["authorization"]) {
    throw new Error("Henry Schein login failed — no Authorization header captured (check credentials / UI).");
  }
  if (!cartId) {
    throw new Error("Henry Schein login failed — no cartId captured.");
  }

  return { headers: capturedHeaders, accountNumber, companyId, cartId, zipCode };
}

/**
 * Alternative login using saved browser cookies (exported via Cookie-Editor).
 * Skips the form-based login entirely — just loads cookies, navigates to a
 * search page, and intercepts the same Authorization + cartId from the API call.
 */
export async function loginHenryScheinWithCookies(
  cookiesPath: string,
): Promise<HenryScheinAuthContext> {
  const fs = await import("fs");
  const rawCookies = JSON.parse(fs.readFileSync(cookiesPath, "utf-8")) as Array<{
    name: string; value: string; domain: string; path: string;
    secure?: boolean; httpOnly?: boolean; sameSite?: string; expirationDate?: number;
  }>;

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });

  // Load the exported cookies into the browser context
  await context.addCookies(rawCookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
    path: c.path ?? '/',
    secure: c.secure ?? false,
    httpOnly: c.httpOnly ?? false,
    sameSite: (() => { const s = (c.sameSite ?? 'Lax').toLowerCase(); return s === 'strict' ? 'Strict' : s === 'none' ? 'None' : 'Lax'; })() as 'Strict' | 'Lax' | 'None',
    expires: c.expirationDate ?? -1,
  })));

  const page = await context.newPage();

  let capturedHeaders: Record<string, string> = {};
  let accountNumber = "";
  let companyId = "04420";
  let cartId = "";
  let zipCode = "";

  const capturedPromise = new Promise<void>((resolve) => {
    page.on("request", (req) => {
      try {
        const url = req.url();
        const postData = req.postData() ?? "";
        if (req.method() === "POST" && url.includes("web-product-pricing") && url.includes("linelevel")) {
          const zm = postData.match(/"zipCode":"([^"]*)"/);
          if (zm) zipCode = zm[1];
        }
        // Capture auth headers from any HS API call
        if (url.includes("api.henryschein.co.uk") && !capturedHeaders["authorization"]) {
          const h = req.headers();
          if (h["authorization"]) {
            capturedHeaders = { ...h };
            const cm = url.match(/cartId=([^&]+)/);
            if (cm) cartId = cm[1];
          }
        }
        // Also try category/search specifically
        if (url.includes("category/search") && !cartId) {
          const cm = url.match(/cartId=([^&]+)/);
          if (cm) { cartId = cm[1]; resolve(); }
          else resolve(); // captured headers without cartId is still useful
        }
        const acctMatch = postData.match(/"accountNumber":"(\d+)"/);
        const compMatch = postData.match(/"companyId":"(\d+)"/);
        if (acctMatch) accountNumber = acctMatch[1];
        if (compMatch) companyId = compMatch[1];
      } catch { /* noop */ }
    });
  });

  console.log('Loading HS homepage with saved cookies...');
  await page.goto("https://www.henryschein.co.uk", { waitUntil: "networkidle", timeout: 60_000 });
  await delay(3000);

  const loggedIn = await page.evaluate(() => document.body.innerText.includes('Sign Out') || document.body.innerText.includes('My Account'));
  console.log(`Logged in: ${loggedIn}`);

  console.log('Navigating to search page...');
  await page.goto("https://www.henryschein.co.uk/search/gloves?type=Products", {
    waitUntil: "networkidle", timeout: 60_000,
  });
  await Promise.race([capturedPromise, delay(30_000)]);
  await delay(1000);

  // Try to get cartId from localStorage if not captured from URL
  if (!cartId) {
    cartId = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) ?? '';
        if (k.toLowerCase().includes('cart')) {
          try { const v = JSON.parse(localStorage.getItem(k) ?? ''); if (v?.cartId) return v.cartId; if (typeof v === 'string' && v.length > 5) return v; } catch {}
        }
      }
      return '';
    }).catch(() => '');
    if (cartId) console.log(`cartId from localStorage: ${cartId}`);
  }

  if (!accountNumber) {
    const m = page.url().match(/shipToAccountNumber=(\d+)/);
    if (m) accountNumber = m[1];
  }

  // Log all captured API URLs for debugging
  if (!capturedHeaders["authorization"]) {
    console.error('No Authorization header captured — logging intercepted HS API calls for debug:');
    page.on("request", (req) => { if (req.url().includes('henryschein')) console.log(' REQ:', req.url().substring(0, 120)); });
  }

  await browser.close();

  if (!capturedHeaders["authorization"]) {
    throw new Error("HS cookie login failed — no Authorization header captured. Cookies may be expired.");
  }

  // cartId may be empty if HS changed their API — try proceeding without it
  if (!cartId) console.warn("Warning: no cartId captured — API calls may fail if cartId is still required.");

  console.log(`Cookie login OK — cartId=${cartId || '(none)'}, account=${accountNumber}`);
  return { headers: capturedHeaders, accountNumber, companyId, cartId, zipCode };
}

export async function searchHenryScheinDentalGb(
  query: string,
  auth: HenryScheinAuthContext,
  page: number,
  pageSize: number,
  maxPagesFromApi: number,
): Promise<{ products: unknown[]; totalPages: number }> {
  const queryB64 = Buffer.from(`${query}:relevance`).toString("base64");
  const url = `https://api.henryschein.co.uk/eapi/web-product-details/v2/product/category/search/dental-gb?query=${queryB64}&currentPage=${page}&fields=FULL&pageSize=${pageSize}&refCat=ALL&isPreferred=false&cartId=${auth.cartId}&currentShipToID=`;
  const res = await fetch(url, { headers: auth.headers });
  if (!res.ok) {
    return { products: [], totalPages: 0 };
  }
  const json = (await res.json()) as {
    products?: unknown[];
    pagination?: { totalPages?: number };
  };
  const products = json.products ?? [];
  const apiTotal = Math.max(1, json.pagination?.totalPages ?? 1);
  const totalPages = Math.min(apiTotal, Math.max(1, maxPagesFromApi));
  return { products, totalPages };
}

export async function fetchHenryScheinLineLevelPrices(
  productIds: string[],
  auth: HenryScheinAuthContext,
): Promise<Map<string, number>> {
  if (!productIds.length) return new Map();
  const res = await fetch("https://api.henryschein.co.uk/eapi/web-product-pricing/v2/product/pricing/linelevel", {
    method: "POST",
    headers: { ...auth.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountNumber: auth.accountNumber,
      companyId: auth.companyId,
      countryId: "GB",
      item: productIds.map((id) => ({
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
  if (!res.ok) return new Map();
  const json = (await res.json()) as { status?: { code?: string }; item?: Array<{ productId?: string; price?: { unitPrice?: string } }> };
  if (json.status?.code !== "200") return new Map();
  const out = new Map<string, number>();
  for (const row of json.item ?? []) {
    const p = parseFloat(row.price?.unitPrice ?? "0");
    if (p > 0 && row.productId) out.set(row.productId, p);
  }
  return out;
}

/**
 * Parse a search hit. Prefers negotiated line-level price; falls back to list
 * price on the product payload so we still persist SKUs when line-level is empty.
 */
export function parseHenryScheinCatalogProduct(
  item: Record<string, unknown>,
  priceMap: Map<string, number>,
): HenryScheinCatalogProduct | null {
  const name = String(item.name ?? "").trim();
  if (!name || name.length < 3) return null;
  const sku = String(item.code ?? item.sku ?? "").trim();
  if (!sku) return null;

  const line = priceMap.get(sku);
  const listRaw = (item.price as { value?: unknown } | undefined)?.value ?? item.price;
  const listNum = typeof listRaw === "number" ? listRaw : parseFloat(String(listRaw ?? "0")) || 0;
  let priceNum = line && line > 0 ? line : listNum;
  if (priceNum <= 0) priceNum = 0.01;

  const stock =
    (item.stock as { stockLevelStatus?: string } | undefined)?.stockLevelStatus !== "outOfStock" &&
    (item.availabilityCode as { code?: string } | undefined)?.code !== "TEMPORARY" &&
    (item.availabilityCode as { code?: string } | undefined)?.code !== "OOS";

  const images = item.images as Array<{ url?: string }> | undefined;
  const primary = item.primaryImage as { url?: string } | undefined;
  const img = images?.[0]?.url ?? primary?.url ?? "";
  const image = typeof img === "string" && img.startsWith("/") ? `https://www.henryschein.co.uk${img}` : String(img);

  const cats = item.categories as Array<{ name?: string }> | undefined;

  return {
    sku,
    name,
    brand: String((item.manufacturer as string) ?? (item.brand as { name?: string } | undefined)?.name ?? "Henry Schein"),
    price: priceNum,
    stock: Boolean(stock),
    image: image || "https://www.henryschein.co.uk/favicon.ico",
    packSize: String((item.packSize as string) ?? (item.unitOfMeasure as string) ?? "1 unit"),
    category: String(cats?.[0]?.name ?? "Consumables"),
  };
}
