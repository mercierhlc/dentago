/**
 * Playwright-based basket pusher with:
 *  - playwright-extra + stealth plugin (defeats basic bot detection)
 *  - Per-user session cache (cookies persisted in memory, reused across calls)
 *  - Automatic session refresh on login failure
 *  - Structured per-item results
 */

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { BrowserContext, Page } from "playwright";
import type {
  BasketItem,
  BasketItemResult,
  BasketPushResult,
  MagentoPlaceOrderOptions,
  SupplierOrderPlacementResult,
} from "./types";

chromium.use(StealthPlugin());

// ── Session cache ─────────────────────────────────────────────────────────────
// Key: `${supplier}:${username}`, Value: serialised cookies + expiry
interface CachedSession {
  cookies: Parameters<BrowserContext["addCookies"]>[0];
  expiresAt: number;
}

const SESSION_TTL_MS = 25 * 60 * 1000; // 25 min — suppliers typically expire sessions at 30 min
const sessionCache = new Map<string, CachedSession>();

function sessionKey(supplier: string, username: string) {
  return `${supplier}:${username}`;
}

function getCachedSession(supplier: string, username: string): CachedSession | null {
  const s = sessionCache.get(sessionKey(supplier, username));
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessionCache.delete(sessionKey(supplier, username));
    return null;
  }
  return s;
}

function setCachedSession(supplier: string, username: string, ctx: BrowserContext) {
  ctx.cookies().then((cookies) => {
    sessionCache.set(sessionKey(supplier, username), {
      cookies,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
  }).catch(() => {/* non-fatal */});
}

function clearCachedSession(supplier: string, username: string) {
  sessionCache.delete(sessionKey(supplier, username));
}

// ── Browser singleton ─────────────────────────────────────────────────────────
// One persistent browser process shared across requests — context per request.

let _browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

async function getBrowser() {
  if (_browser) {
    try {
      // Quick health check — will throw if browser process died
      await _browser.contexts();
      return _browser;
    } catch {
      _browser = null;
    }
  }
  _browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  console.log("[browser] launched new Chromium instance");
  return _browser;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function newContext(cachedSession: CachedSession | null) {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1366, height: 768 },
    locale: "en-GB",
    timezoneId: "Europe/London",
  });
  if (cachedSession) {
    try {
      await ctx.addCookies(cachedSession.cookies);
    } catch {/* non-fatal — will re-login */}
  }
  return ctx;
}

async function acceptCookies(page: Page) {
  const banners = [
    "button:has-text('Accept all')",
    "button:has-text('Accept All')",
    "button:has-text('Accept Cookies')",
    "button:has-text('Accept')",
    "#onetrust-accept-btn-handler",
    "#accept-all",
    "button[id*='accept' i]",
    ".cookie-accept",
  ];
  for (const sel of banners) {
    try {
      await page.click(sel, { timeout: 1500 });
      await delay(400);
      return;
    } catch {/* try next */}
  }
}

async function tryClose(ctx: BrowserContext | null) {
  try { await ctx?.close(); } catch {/* noop */}
}

// ── Login: Henry Schein ──────────────────────────────────────────────────────

async function loginHenrySchein(page: Page, username: string, password: string): Promise<boolean> {
  await page.goto("https://www.henryschein.co.uk", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await delay(1500);
  await acceptCookies(page);

  // Click "Sign In" — HS uses an Angular modal
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("a, button")).find(
      (e) => /^sign\s*in$/i.test(e.textContent?.trim() ?? "")
    );
    if (el) (el as HTMLElement).click();
  });
  await delay(2000);

  const emailSel = "#mat-input-0, input[type='email'], input[name='userId'], mat-form-field input:first-of-type";
  const passSel = "input[type='password']";

  try {
    await page.waitForSelector(`${emailSel}, ${passSel}`, { timeout: 20_000 });
  } catch {
    return false;
  }

  await page.fill(emailSel, username);
  await delay(150);
  await page.fill(passSel, password);
  await page.press(passSel, "Enter");
  await delay(6000);

  // Success: password field gone or URL moved off landing
  const stillOnPw = await page.$(passSel);
  if (stillOnPw) return false;

  // Double-check: look for a "My Account" or account name indicator
  const body = await page.textContent("body") ?? "";
  if (/incorrect|invalid|error/i.test(body.slice(0, 3000))) return false;

  return true;
}

// ── Login: Kent Express ──────────────────────────────────────────────────────

async function loginKentExpress(page: Page, username: string, password: string): Promise<boolean> {
  await page.goto("https://www.kentexpress.co.uk", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await delay(1200);
  await acceptCookies(page);

  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll("a, button")).find(
      (e) => /^sign\s*in$/i.test(e.textContent?.trim() ?? "")
    );
    if (el) (el as HTMLElement).click();
  });
  await delay(2000);

  const emailSel = "input[type='email'], input[name='userId'], input[name='username'], mat-form-field input:first-of-type";
  const passSel = "input[type='password']";

  try {
    await page.waitForSelector(`${emailSel}, ${passSel}`, { timeout: 20_000 });
  } catch {
    return false;
  }

  await page.fill(emailSel, username);
  await delay(150);
  await page.fill(passSel, password);
  await page.press(passSel, "Enter");
  await delay(5000);

  const stillOnPw = await page.$(passSel);
  return !stillOnPw;
}

// ── Login: DD Group ──────────────────────────────────────────────────────────

async function loginDdGroup(page: Page, username: string, password: string): Promise<boolean> {
  await page.goto("https://www.ddgroup.com/login/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await delay(1000);
  await acceptCookies(page);

  const emailSel =
    'input[type="email"], input[name="username"], input[name="email"], input[autocomplete="username"]';
  const passSel = 'input[type="password"]';

  try {
    await page.waitForSelector(`${emailSel}, ${passSel}`, { timeout: 20_000 });
  } catch {
    return false;
  }

  await page.fill(emailSel, username);
  await delay(150);
  await page.fill(passSel, password);

  const submitSel =
    'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")';
  try {
    await page.click(submitSel, { timeout: 6000 });
  } catch {
    await page.press(passSel, "Enter");
  }
  await delay(4000);

  return !page.url().includes("/login");
}

// ── Add items ────────────────────────────────────────────────────────────────

const ADD_SELECTORS = [
  'button:has-text("Add to basket")',
  'button:has-text("Add to Basket")',
  'button:has-text("Add to cart")',
  'button:has-text("Add to Cart")',
  '[data-testid*="add-to-basket" i]',
  '[data-testid*="add-to-cart" i]',
  'button[aria-label*="Add to basket" i]',
  'button[aria-label*="Add to cart" i]',
  'a:has-text("Add to basket")',
];

function searchUrl(supplier: "Henry Schein" | "Kent Express" | "DD Group", term: string): string {
  if (supplier === "Henry Schein") {
    return `https://www.henryschein.co.uk/search/${encodeURIComponent(term).replace(/%20/g, "+")}?type=Products`;
  }
  if (supplier === "Kent Express") {
    return `https://www.kentexpress.co.uk/search?q=${encodeURIComponent(term)}`;
  }
  return `https://www.ddgroup.com/search/?query=${encodeURIComponent(term)}`;
}

async function addItem(
  page: Page,
  supplier: "Henry Schein" | "Kent Express" | "DD Group",
  item: BasketItem
): Promise<BasketItemResult> {
  const base: Omit<BasketItemResult, "status" | "reason"> = {
    searchTerm: item.searchTerm,
    label: item.label,
    quantity: item.quantity,
  };

  try {
    await page.goto(searchUrl(supplier, item.searchTerm), {
      waitUntil: "domcontentloaded",
      timeout: 55_000,
    });
  } catch {
    return { ...base, status: "error", reason: "navigation_failed" };
  }

  await delay(supplier === "DD Group" ? 2500 : 1800);

  const body = await page.textContent("body") ?? "";
  if (/no results|no products|0 results|nothing found/i.test(body) &&
      !body.toLowerCase().includes(item.searchTerm.toLowerCase().slice(0, 6))) {
    return { ...base, status: "not_found", reason: "no_search_results" };
  }

  // Set quantity if > 1
  if (item.quantity > 1) {
    const qtySel = 'input[type="number"], input[name*="quantity" i]';
    try {
      const el = await page.$(qtySel);
      if (el) {
        await page.fill(qtySel, String(Math.min(99, Math.floor(item.quantity))));
        await delay(300);
      }
    } catch {/* optional */}
  }

  // Click add-to-basket
  let clicked = false;
  for (const sel of ADD_SELECTORS) {
    try {
      const loc = page.locator(sel).first();
      await loc.waitFor({ state: "visible", timeout: 3000 });
      await loc.click({ timeout: 3000 });
      clicked = true;
      await delay(600);
      break;
    } catch {/* try next */}
  }

  if (!clicked) {
    return { ...base, status: "add_failed", reason: "add_to_basket_button_not_found" };
  }

  return { ...base, status: "added", externalProductId: item.searchTerm };
}

// ── Checkout walk (Angular-portal suppliers) ─────────────────────────────────

const CHECKOUT_SELECTORS = [
  'button:has-text("Checkout")',
  'a:has-text("Checkout")',
  'button:has-text("Proceed to checkout")',
  'button:has-text("Secure checkout")',
  'button:has-text("Continue")',
  'button:has-text("Next")',
  'button:has-text("Place order")',
  'button:has-text("Place Order")',
  'button:has-text("Confirm order")',
  'button:has-text("Submit order")',
];

async function walkCheckout(
  page: Page,
  supplier: "Henry Schein" | "Kent Express" | "DD Group",
  options: MagentoPlaceOrderOptions
): Promise<SupplierOrderPlacementResult> {
  const basketUrl =
    supplier === "Henry Schein" ? "https://www.henryschein.co.uk/" :
    supplier === "Kent Express" ? "https://www.kentexpress.co.uk/cart" :
    "https://www.ddgroup.com/cart/";

  try {
    await page.goto(basketUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await delay(2000);
  } catch {
    return { attempted: true, placed: false, errors: ["open_basket_failed"] };
  }

  const errors: string[] = [];

  for (let step = 0; step < 14; step++) {
    // Check for "Place order" first
    for (const sel of ['button:has-text("Place order")', 'button:has-text("Place Order")', 'button:has-text("Confirm order")']) {
      try {
        const loc = page.locator(sel).first();
        await loc.waitFor({ state: "visible", timeout: 3000 });
        await loc.click({ timeout: 3000 });
        await delay(3000);
        const text = await page.textContent("body") ?? "";
        const m = text.match(/order\s*#?\s*([A-Z0-9-]{4,})/i) ?? text.match(/confirmation[:\s#]+([A-Z0-9-]{4,})/i);
        return {
          attempted: true,
          placed: true,
          supplierOrderNumber: m?.[1]?.slice(0, 64),
          errors: errors.length ? errors : undefined,
        };
      } catch {/* try next sel */}
    }

    // Fill PO field if present
    if (options.purchaseOrderNumber?.trim()) {
      const poSel = 'input[name*="purchase" i], input[name*="po" i], input[placeholder*="purchase" i]';
      try {
        const el = await page.$(poSel);
        if (el) await page.fill(poSel, options.purchaseOrderNumber.trim());
      } catch {/* optional */}
    }

    // Progress through checkout
    let progressed = false;
    for (const sel of CHECKOUT_SELECTORS) {
      try {
        const loc = page.locator(sel).first();
        await loc.waitFor({ state: "visible", timeout: 2500 });
        await loc.click({ timeout: 2500 });
        progressed = true;
        await delay(1200);
        break;
      } catch {/* try next */}
    }

    if (!progressed) {
      errors.push(`checkout_stalled_step_${step}`);
      break;
    }
  }

  return {
    attempted: true,
    placed: false,
    errors: errors.length ? errors : ["checkout_not_completed"],
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function pushBasket(args: {
  supplier: "Henry Schein" | "Kent Express" | "DD Group";
  username: string;
  password: string;
  items: BasketItem[];
  placeOrder: MagentoPlaceOrderOptions | null;
}): Promise<BasketPushResult> {
  const { supplier, username, password, items, placeOrder } = args;

  const basketUrl =
    supplier === "Henry Schein" ? "https://www.henryschein.co.uk/" :
    supplier === "Kent Express" ? "https://www.kentexpress.co.uk/cart" :
    "https://www.ddgroup.com/cart/";

  const skeleton = (overrides: Partial<BasketPushResult> = {}): BasketPushResult => ({
    supplier,
    authenticated: false,
    basketUrl,
    items: items.map((it) => ({
      searchTerm: it.searchTerm,
      label: it.label,
      quantity: it.quantity,
      status: "error" as const,
      reason: "not_reached",
    })),
    added: 0,
    failed: items.length,
    ...overrides,
  });

  // Try with cached session first; fall back to fresh login if it fails
  for (let attempt = 0; attempt < 2; attempt++) {
    const cached = attempt === 0 ? getCachedSession(supplier, username) : null;

    if (attempt === 1) {
      console.log(`[${supplier}] cached session invalid — re-logging in`);
      clearCachedSession(supplier, username);
    }

    let ctx = null;
    try {
      ctx = await newContext(cached);
      const page = await ctx.newPage();

      // Login if no cached session
      let loggedIn = cached !== null; // assume cached session is valid on first pass

      if (!loggedIn) {
        if (supplier === "Henry Schein") loggedIn = await loginHenrySchein(page, username, password);
        else if (supplier === "Kent Express") loggedIn = await loginKentExpress(page, username, password);
        else loggedIn = await loginDdGroup(page, username, password);
      }

      if (!loggedIn) {
        await tryClose(ctx);
        if (attempt === 0) continue; // retry with fresh login
        return skeleton({ items: items.map((it) => ({ ...it, status: "error" as const, reason: "login_failed" })) });
      }

      // Cache fresh session after successful login
      if (!cached) setCachedSession(supplier, username, ctx);

      // Add each item
      const results: BasketItemResult[] = [];
      for (const item of items) {
        const r = await addItem(page, supplier, item);
        results.push(r);

        // If we get an indication the session died mid-run, break and retry
        if (r.reason === "navigation_failed" && attempt === 0) {
          clearCachedSession(supplier, username);
          break;
        }
      }

      // If we bailed early due to session death, retry
      if (results.length < items.length && attempt === 0) {
        await tryClose(ctx);
        continue;
      }

      const added = results.filter((r) => r.status === "added").length;
      const result: BasketPushResult = {
        supplier,
        authenticated: true,
        basketUrl,
        items: results,
        added,
        failed: results.length - added,
      };

      if (placeOrder && added > 0) {
        result.supplierOrder = await walkCheckout(page, supplier, placeOrder);
      } else if (placeOrder) {
        result.supplierOrder = { attempted: false, placed: false, errors: ["no_items_added"] };
      }

      await tryClose(ctx);
      return result;

    } catch (err) {
      await tryClose(ctx);
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${supplier}] attempt ${attempt + 1} threw:`, msg);
      if (attempt === 0) continue;
      return skeleton({ items: items.map((it) => ({ ...it, status: "error" as const, reason: `exception:${msg.slice(0, 100)}` })) });
    }
  }

  return skeleton();
}
