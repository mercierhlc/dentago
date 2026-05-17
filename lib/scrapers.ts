/**
 * Authenticated supplier scrapers.
 *
 * Each scraper:
 *  1. Logs into the supplier's website using the clinic's stored credentials
 *  2. Searches for a product term and parses the authenticated (negotiated) price
 *  3. Returns null on any failure — callers fall back to static/public pricing
 *
 * All requests are server-side only. Credentials never leave the server.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT = 12_000;

// ─── Cookie jar ──────────────────────────────────────────────────────────────

class CookieJar {
  private store = new Map<string, string>();

  /** Ingest all Set-Cookie headers from a response. */
  ingest(headers: Headers) {
    // Node 18.14+ exposes getSetCookie() for multiple Set-Cookie headers
    const h = headers as unknown as { getSetCookie?: () => string[] };
    const raw: string[] =
      typeof h.getSetCookie === "function"
        ? h.getSetCookie()
        : (headers.get("set-cookie") ?? "").split(/,(?=\s*[A-Za-z0-9_-]+=)/);

    for (const cookie of raw) {
      const semi = cookie.indexOf(";");
      const pair = cookie.slice(0, semi > 0 ? semi : undefined).trim();
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name) this.store.set(name, value);
    }
  }

  header() {
    return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  size() {
    return this.store.size;
  }
}

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function go(url: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    return null;
  }
}

function extractPrice(html: string): number | null {
  // data-price="4.85" (Magento)
  const m1 = html.match(/data-price="([\d.]+)"/);
  if (m1) return parseFloat(m1[1]);
  // class="price">£4.85 (various)
  const m2 = html.match(/class="[^"]*price[^"]*"[^>]*>[^£]*£\s*([\d,]+\.?\d*)/i);
  if (m2) return parseFloat(m2[1].replace(",", ""));
  // JSON: "price":4.85
  const m3 = html.match(/"price"\s*:\s*([\d.]+)/);
  if (m3) return parseFloat(m3[1]);
  return null;
}

// ─── Dental Sky (Magento 2 GraphQL) ─────────────────────────────────────────
//
// Dental Sky migrated from Magento 1 (HTML form login) to Magento 2. The legacy
// /customer/account/loginPost/ flow now silently rejects pure-HTTP submissions
// (form_key cookie expectations only set by JS, plus likely WAF behaviour) — so
// the form-scrape path returned null for every clinic, leaving price_cache
// empty in production for months. The supported integration surface is
// /graphql, which:
//   - accepts SKU lookups directly
//   - returns the customer-group price (i.e. negotiated trade price) when
//     called with a customer JWT
//   - returns structured errors instead of redirect-to-login on failure
//
// We share the same auth helpers with lib/scrapers-basket.ts; keeping them
// duplicated here so this file stays self-contained for the price-only path.

const DS_BASE_URL = "https://www.dentalsky.com";
const DS_GRAPHQL_URL = `${DS_BASE_URL}/graphql`;

interface DsGqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function dsGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string
): Promise<DsGqlResponse<T> | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": UA,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(DS_GRAPHQL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    return (await res.json()) as DsGqlResponse<T>;
  } catch {
    return null;
  }
}

interface DsPriceProduct {
  sku: string;
  name: string;
  price_range: {
    minimum_price: {
      final_price: { value: number; currency: string };
    };
  };
}

/** Best-effort SKU heuristic: alphanumerics + dashes/underscores, no spaces. */
function looksLikeSku(s: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/\-]{1,30}$/.test(s) && !/\s/.test(s);
}

async function dsLookupProductPrice(
  token: string,
  searchTerm: string
): Promise<number | null> {
  // Strategy 1: direct SKU match. This is the cleanest path and the one the
  // basket pusher already relies on, so a hit here means we and the supplier
  // agree on the same SKU string.
  if (looksLikeSku(searchTerm)) {
    const skuRes = await dsGraphql<{ products: { items: DsPriceProduct[] } }>(
      `query($s:String!){products(filter:{sku:{eq:$s}}){items{sku name price_range{minimum_price{final_price{value currency}}}}}}`,
      { s: searchTerm },
      token
    );
    const item = skuRes?.data?.products?.items?.[0];
    const price = item?.price_range?.minimum_price?.final_price?.value;
    if (typeof price === "number" && price > 0) return price;
  }

  // Strategy 2: relevance search across name/description. We sort by relevance
  // and take the top hit — same behaviour as the legacy catalogsearch result
  // page, just over the supported API.
  const searchRes = await dsGraphql<{ products: { items: DsPriceProduct[] } }>(
    `query($s:String!){products(search:$s,pageSize:1,sort:{relevance:DESC}){items{sku name price_range{minimum_price{final_price{value currency}}}}}}`,
    { s: searchTerm },
    token
  );
  const hit = searchRes?.data?.products?.items?.[0];
  const price = hit?.price_range?.minimum_price?.final_price?.value;
  return typeof price === "number" && price > 0 ? price : null;
}

export async function scrapeDentalSky(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  // Auth: generateCustomerToken returns a JWT that scopes subsequent product
  // queries to this customer's pricing tier.
  const tokenRes = await dsGraphql<{ generateCustomerToken: { token: string } | null }>(
    `mutation($e:String!,$p:String!){generateCustomerToken(email:$e,password:$p){token}}`,
    { e: username, p: password }
  );
  const token = tokenRes?.data?.generateCustomerToken?.token;
  if (!token) return null;

  return dsLookupProductPrice(token, searchTerm);
}

// ─── Kent Express (Angular SPA — NOT Magento) ────────────────────────────────
//
// Verified 2026-05-04: Kent Express is NOT Magento. It is an Angular SPA built
// on Henry Schein's SAP Commerce Cloud / Sitecore platform. Key facts:
//   - /customer/account/login/ → 404 (Magento paths do not exist)
//   - Auth stack: Angular SPA + Henry Schein OAuth/JWT stored in sessionStorage
//   - API layer: api.kentexpress.co.uk (Akamai CDN, 504 on unauthenticated hits)
//   - Credentials: uid + authToken + jwtToken + locationId — requires JS execution
//
// VERDICT: Cannot be scraped with plain HTTP requests. Requires headless browser
// (Playwright/Puppeteer) to execute the Angular login flow and extract the JWT.
//
// ALTERNATIVE PATH: Request API partnership with Kent Express / Henry Schein UK.
// Contact: Anthony Trombetta (existing relationship). API endpoint for pricing is
// https://api.eu.henryschein.com/eapi/web-linepricing/v1/customerprice
// which uses OAuth2 bearer tokens — ideal for a formal B2B integration.

export async function scrapeKentExpress(
  _username: string,
  _password: string,
  _searchTerm: string
): Promise<number | null> {
  // Not implementable via plain HTTP — Angular SPA with JWT OAuth flow.
  // See comment above. Needs headless browser or API partnership.
  return null;
}

// ─── Henry Schein UK (ASP.NET) ────────────────────────────────────────────────

export async function scrapeHenrySchein(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const { scrapeHenryScheinNegotiated } = await import("./henry-schein-negotiated");
  return scrapeHenryScheinNegotiated(username, password, searchTerm);
}

// ─── Dental Directory ─────────────────────────────────────────────────────────

export async function scrapeDentalDirectory(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://www.dental-directory.co.uk";

  const page = await go(`${BASE}/login`, { headers: { "User-Agent": UA } });
  if (!page) return null;
  jar.ingest(page.headers);
  const pageHtml = await page.text();

  const csrf =
    pageHtml.match(/name="_csrf"\s+value="([^"]+)"/i)?.[1] ??
    pageHtml.match(/name="csrf_token"\s+value="([^"]+)"/i)?.[1];

  const body: Record<string, string> = { email: username, password };
  if (csrf) body["_csrf"] = csrf;

  const loginRes = await go(`${BASE}/login`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams(body).toString(),
    redirect: "manual",
  });
  if (!loginRes) return null;
  jar.ingest(loginRes.headers);

  const location = loginRes.headers.get("location") ?? "";
  if (!location || location.includes("login")) return null;

  const search = await go(
    `${BASE}/search?q=${encodeURIComponent(searchTerm)}`,
    { headers: { "User-Agent": UA, Cookie: jar.header() } }
  );
  if (!search?.ok) return null;

  return extractPrice(await search.text());
}

// ─── Clark Dental (Magento) ───────────────────────────────────────────────────

export async function scrapeClarkDental(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://www.clarkdental.co.uk";

  const page = await go(`${BASE}/customer/account/login/`, {
    headers: { "User-Agent": UA },
  });
  if (!page) return null;
  jar.ingest(page.headers);
  const pageHtml = await page.text();

  const formKey = pageHtml.match(/name="form_key"[^>]*value="([^"]+)"/)?.[1] ?? pageHtml.match(/value="([^"]+)"[^>]*name="form_key"/)?.[1];
  if (!formKey) return null;

  const loginRes = await go(`${BASE}/customer/account/loginPost/`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({
      form_key: formKey,
      "login[username]": username,
      "login[password]": password,
      send: "",
    }).toString(),
    redirect: "manual",
  });
  if (!loginRes) return null;
  jar.ingest(loginRes.headers);

  const location = loginRes.headers.get("location") ?? "";
  if (!location || location.includes("login")) return null;

  const search = await go(
    `${BASE}/catalogsearch/result/?q=${encodeURIComponent(searchTerm)}`,
    { headers: { "User-Agent": UA, Cookie: jar.header() } }
  );
  if (!search?.ok) return null;

  return extractPrice(await search.text());
}

// ─── Trycare ─────────────────────────────────────────────────────────────────

export async function scrapeTrycare(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://www.trycare.co.uk";

  const page = await go(`${BASE}/customer/account/login/`, {
    headers: { "User-Agent": UA },
  });
  if (!page) return null;
  jar.ingest(page.headers);
  const pageHtml = await page.text();

  const formKey = pageHtml.match(/name="form_key"[^>]*value="([^"]+)"/)?.[1] ?? pageHtml.match(/value="([^"]+)"[^>]*name="form_key"/)?.[1];

  const body: Record<string, string> = {
    "login[username]": username,
    "login[password]": password,
    send: "",
  };
  if (formKey) body["form_key"] = formKey;

  const loginRes = await go(`${BASE}/customer/account/loginPost/`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams(body).toString(),
    redirect: "manual",
  });
  if (!loginRes) return null;
  jar.ingest(loginRes.headers);

  const location = loginRes.headers.get("location") ?? "";
  if (!location || location.includes("login")) return null;

  const search = await go(
    `${BASE}/catalogsearch/result/?q=${encodeURIComponent(searchTerm)}`,
    { headers: { "User-Agent": UA, Cookie: jar.header() } }
  );
  if (!search?.ok) return null;

  return extractPrice(await search.text());
}

// ─── Optident ─────────────────────────────────────────────────────────────────

export async function scrapeOptident(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://optident.co.uk";

  const page = await go(`${BASE}/my-account/`, { headers: { "User-Agent": UA } });
  if (!page) return null;
  jar.ingest(page.headers);
  const pageHtml = await page.text();

  // WooCommerce uses woocommerce-login nonce
  const nonce = pageHtml.match(/name="woocommerce-login-nonce"\s+value="([^"]+)"/)?.[1];

  const body: Record<string, string> = {
    username,
    password,
    login: "Log in",
  };
  if (nonce) body["woocommerce-login-nonce"] = nonce;

  const loginRes = await go(`${BASE}/my-account/`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
      Referer: `${BASE}/my-account/`,
    },
    body: new URLSearchParams(body).toString(),
    redirect: "manual",
  });
  if (!loginRes) return null;
  jar.ingest(loginRes.headers);

  const location = loginRes.headers.get("location") ?? "";
  if (!location || location.includes("my-account")) {
    // WooCommerce may redirect back to my-account on both success and failure
    // Check if we're logged in by looking for logout link
    const check = await go(location.startsWith("http") ? location : `${BASE}${location}`, {
      headers: { "User-Agent": UA, Cookie: jar.header() },
    });
    if (!check) return null;
    const checkHtml = await check.text();
    if (!checkHtml.includes("logout") && !checkHtml.includes("log-out")) return null;
  }

  const search = await go(
    `${BASE}/?s=${encodeURIComponent(searchTerm)}&post_type=product`,
    { headers: { "User-Agent": UA, Cookie: jar.header() } }
  );
  if (!search?.ok) return null;

  return extractPrice(await search.text());
}

// ─── DHB Dental ───────────────────────────────────────────────────────────────

export async function scrapeDHB(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://www.dhb-dental.com";

  const page = await go(`${BASE}/customer/account/login/`, {
    headers: { "User-Agent": UA },
  });
  if (!page) return null;
  jar.ingest(page.headers);
  const pageHtml = await page.text();

  const formKey = pageHtml.match(/name="form_key"[^>]*value="([^"]+)"/)?.[1] ?? pageHtml.match(/value="([^"]+)"[^>]*name="form_key"/)?.[1];
  if (!formKey) return null;

  const loginRes = await go(`${BASE}/customer/account/loginPost/`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({
      form_key: formKey,
      "login[username]": username,
      "login[password]": password,
      send: "",
    }).toString(),
    redirect: "manual",
  });
  if (!loginRes) return null;
  jar.ingest(loginRes.headers);

  const location = loginRes.headers.get("location") ?? "";
  if (!location || location.includes("login")) return null;

  const search = await go(
    `${BASE}/catalogsearch/result/?q=${encodeURIComponent(searchTerm)}`,
    { headers: { "User-Agent": UA, Cookie: jar.header() } }
  );
  if (!search?.ok) return null;

  return extractPrice(await search.text());
}

// ─── Wrights ──────────────────────────────────────────────────────────────────

export async function scrapeWrights(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://www.wrightsdentals.com";

  const page = await go(`${BASE}/customer/account/login/`, {
    headers: { "User-Agent": UA },
  });
  if (!page) return null;
  jar.ingest(page.headers);
  const pageHtml = await page.text();

  const formKey = pageHtml.match(/name="form_key"[^>]*value="([^"]+)"/)?.[1] ?? pageHtml.match(/value="([^"]+)"[^>]*name="form_key"/)?.[1];
  if (!formKey) return null;

  const loginRes = await go(`${BASE}/customer/account/loginPost/`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({
      form_key: formKey,
      "login[username]": username,
      "login[password]": password,
      send: "",
    }).toString(),
    redirect: "manual",
  });
  if (!loginRes) return null;
  jar.ingest(loginRes.headers);

  const location = loginRes.headers.get("location") ?? "";
  if (!location || location.includes("login")) return null;

  const search = await go(
    `${BASE}/catalogsearch/result/?q=${encodeURIComponent(searchTerm)}`,
    { headers: { "User-Agent": UA, Cookie: jar.header() } }
  );
  if (!search?.ok) return null;

  return extractPrice(await search.text());
}

// ─── DD Group (Next.js + Algolia search) ────────────────────────────────────
//
// Verified 2026-05-04 against live site:
//   Auth:   POST /hapi/user/login/  — Content-Type: application/json
//           Body: { username, password, rememberMe: false }
//           Success: 200 + session cookies
//           Failure: 400 { "error": "Password or username is incorrect." }
//   Search: Algolia — Application ID: CF4C8XNBT0
//           Index: prod_dd  — public API key embedded in client JS
//           Returns catalogPrice (list price).
//           NOTE: Negotiated/account pricing after login uses an unknown
//           authenticated endpoint — requires test credentials to verify.
//           Current implementation falls back to Algolia catalog price.
//
// Anti-bot: none observed. No CAPTCHA on login endpoint.

export async function scrapeDDGroup(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://www.ddgroup.com";
  const ALGOLIA_APP = "CF4C8XNBT0";
  const ALGOLIA_KEY = "0f266d9536c1a3cd9dbd8d672eac4dbd";
  const ALGOLIA_INDEX = "prod_dd";

  // Step 1: attempt authenticated login to get session cookies
  // (for potential future use of negotiated pricing endpoint)
  if (username && password) {
    const loginRes = await go(`${BASE}/hapi/user/login/`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/json",
        Referer: `${BASE}/login/`,
      },
      body: JSON.stringify({ username, password, rememberMe: false }),
    });
    if (loginRes?.ok) {
      jar.ingest(loginRes.headers);
    }
    // If login fails, fall through to Algolia public pricing
  }

  // Step 2: search via Algolia (public catalog prices — reliable regardless of auth)
  const algoliaRes = await go(
    `https://${ALGOLIA_APP}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`,
    {
      method: "POST",
      headers: {
        "X-Algolia-Application-Id": ALGOLIA_APP,
        "X-Algolia-API-Key": ALGOLIA_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: searchTerm, hitsPerPage: 5 }),
    }
  );
  if (!algoliaRes?.ok) return null;

  const data = await algoliaRes.json() as { hits?: Array<{ catalogPrice?: number; name?: string }> };
  const hits = data.hits ?? [];
  if (hits.length === 0) return null;

  // Return catalog price from best-matching result
  const price = hits[0]?.catalogPrice;
  return price && price > 0 ? price : null;
}

// ─── Supplier dispatcher ──────────────────────────────────────────────────────

export type SupplierName =
  | "Dental Sky"
  | "Kent Express"
  | "Henry Schein"
  | "Dental Directory"
  | "Clark Dental"
  | "Trycare"
  | "Optident"
  | "DHB"
  | "Wrights"
  | "DD Group";

type ScraperFn = (u: string, p: string, term: string) => Promise<number | null>;

const SCRAPERS: Partial<Record<SupplierName, ScraperFn>> = {
  "Dental Sky":       scrapeDentalSky,
  "Kent Express":     scrapeKentExpress,
  "Henry Schein":     scrapeHenrySchein,
  "Dental Directory": scrapeDentalDirectory,
  "Clark Dental":     scrapeClarkDental,
  "Trycare":          scrapeTrycare,
  "Optident":         scrapeOptident,
  "DHB":              scrapeDHB,
  "Wrights":          scrapeWrights,
  "DD Group":         scrapeDDGroup,
};

/** True when we can run an automated login + search scrape for this supplier name. */
export function hasLivePriceScraper(supplierName: string): boolean {
  return Object.prototype.hasOwnProperty.call(SCRAPERS, supplierName);
}

export interface AuthenticatedPrice {
  supplier: string;
  price: number;
  stock: boolean;
  authenticated: boolean;
}

/**
 * Run authenticated scraping for every supplier the clinic has credentials for.
 * Returns a map of supplier name → authenticated price (or null if scraping failed).
 * Runs all scrapers in parallel with individual timeouts — failures are silent.
 */
export async function fetchAuthenticatedPrices(
  credentials: { supplierName: string; username: string; password: string }[],
  searchTerm: string
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  await Promise.allSettled(
    credentials.map(async ({ supplierName, username, password }) => {
      const scraper = SCRAPERS[supplierName as SupplierName];
      if (!scraper) return;

      const price = await scraper(username, password, searchTerm);
      if (price !== null && price > 0) {
        results.set(supplierName, price);
      }
    })
  );

  return results;
}
