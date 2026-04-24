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

// ─── Dental Sky (Magento 1) ───────────────────────────────────────────────────

export async function scrapeDentalSky(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://www.dentalsky.com";

  // Step 1: get login page → extract CSRF form_key
  const page = await go(`${BASE}/customer/account/login/`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!page) return null;
  jar.ingest(page.headers);
  const pageHtml = await page.text();

  const formKey = pageHtml.match(/name="form_key"\s+value="([^"]+)"/)?.[1];
  if (!formKey) return null;

  // Step 2: POST credentials
  const loginRes = await go(`${BASE}/customer/account/loginPost/`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
      Referer: `${BASE}/customer/account/login/`,
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
  // Magento sends 302 to /customer/account/ on success, back to /login on failure
  if (!location || location.includes("login")) return null;

  // Step 3: follow the redirect to fully establish the session
  const dest = location.startsWith("http") ? location : `${BASE}${location}`;
  const acc = await go(dest, { headers: { "User-Agent": UA, Cookie: jar.header() } });
  if (acc) jar.ingest(acc.headers);

  // Step 4: authenticated search
  const search = await go(
    `${BASE}/catalogsearch/result/?q=${encodeURIComponent(searchTerm)}`,
    { headers: { "User-Agent": UA, Cookie: jar.header() } }
  );
  if (!search?.ok) return null;

  return extractPrice(await search.text());
}

// ─── Kent Express (Magento 2) ─────────────────────────────────────────────────

export async function scrapeKentExpress(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://www.kentexpress.co.uk";

  const page = await go(`${BASE}/customer/account/login/`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!page) return null;
  jar.ingest(page.headers);
  const pageHtml = await page.text();

  const formKey = pageHtml.match(/name="form_key"\s+value="([^"]+)"/)?.[1];
  if (!formKey) return null;

  const loginRes = await go(`${BASE}/customer/account/loginPost/`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
      Referer: `${BASE}/customer/account/login/`,
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

  const dest = location.startsWith("http") ? location : `${BASE}${location}`;
  const acc = await go(dest, { headers: { "User-Agent": UA, Cookie: jar.header() } });
  if (acc) jar.ingest(acc.headers);

  const search = await go(
    `${BASE}/catalogsearch/result/?q=${encodeURIComponent(searchTerm)}`,
    { headers: { "User-Agent": UA, Cookie: jar.header() } }
  );
  if (!search?.ok) return null;

  return extractPrice(await search.text());
}

// ─── Henry Schein UK (ASP.NET) ────────────────────────────────────────────────

export async function scrapeHenrySchein(
  username: string,
  password: string,
  searchTerm: string
): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://www.henryschein.co.uk";

  // Step 1: get login page for __RequestVerificationToken
  const page = await go(`${BASE}/gb-en/dental/Account/Login`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!page) return null;
  jar.ingest(page.headers);
  const pageHtml = await page.text();

  const rvt = pageHtml.match(
    /name="__RequestVerificationToken"[^>]*value="([^"]+)"/
  )?.[1];

  const body: Record<string, string> = { UserName: username, Password: password };
  if (rvt) body["__RequestVerificationToken"] = rvt;

  const loginRes = await go(`${BASE}/gb-en/dental/Account/Login`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
      Referer: `${BASE}/gb-en/dental/Account/Login`,
    },
    body: new URLSearchParams(body).toString(),
    redirect: "manual",
  });
  if (!loginRes) return null;
  jar.ingest(loginRes.headers);

  const location = loginRes.headers.get("location") ?? "";
  if (!location || location.toLowerCase().includes("login")) return null;

  const dest = location.startsWith("http") ? location : `${BASE}${location}`;
  const acc = await go(dest, { headers: { "User-Agent": UA, Cookie: jar.header() } });
  if (acc) jar.ingest(acc.headers);

  // Henry Schein search
  const search = await go(
    `${BASE}/gb-en/dental/Search?searchText=${encodeURIComponent(searchTerm)}`,
    { headers: { "User-Agent": UA, Cookie: jar.header() } }
  );
  if (!search?.ok) return null;

  return extractPrice(await search.text());
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

  const formKey = pageHtml.match(/name="form_key"\s+value="([^"]+)"/)?.[1];
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

  const formKey = pageHtml.match(/name="form_key"\s+value="([^"]+)"/)?.[1];

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

  const formKey = pageHtml.match(/name="form_key"\s+value="([^"]+)"/)?.[1];
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

  const formKey = pageHtml.match(/name="form_key"\s+value="([^"]+)"/)?.[1];
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
  | "Wrights";

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
};

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
