/**
 * Browser-based basket push for suppliers that do not expose a stable public
 * cart API (Henry Schein, Kent Express, DD Group — SAP Commerce / Next.js).
 *
 * Requires Playwright Chromium on the host (`npx playwright install chromium`).
 * On constrained serverless (e.g. Vercel without bundled browsers), prefer
 * SUPPLIER_BASKET_WORKER_URL or run this path on a Node worker with browsers installed.
 */
import { chromium, type Browser, type Page } from "playwright";
import type {
  BasketItem,
  BasketPushResult,
  MagentoPlaceOrderOptions,
  SupplierOrderPlacementResult,
} from "./basket-push-contract";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PLAYWRIGHT_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-blink-features=AutomationControlled",
];

const ADD_SELECTORS = [
  'button:has-text("Add to basket")',
  'button:has-text("Add to Basket")',
  'button:has-text("Add to cart")',
  'button:has-text("Add to Cart")',
  'a:has-text("Add to basket")',
  'a:has-text("Add to cart")',
  '[data-testid*="add-to-basket" i]',
  '[data-testid*="add-to-cart" i]',
  'button[aria-label*="Add to basket" i]',
  'button[aria-label*="Add to cart" i]',
];

const CHECKOUT_STEP_SELECTORS = [
  'button:has-text("Checkout")',
  'a:has-text("Checkout")',
  'button:has-text("Secure checkout")',
  'button:has-text("Proceed to checkout")',
  'button:has-text("Continue")',
  'button:has-text("Next")',
  'button:has-text("Place order")',
  'button:has-text("Place Order")',
  'button:has-text("Confirm order")',
  'button:has-text("Submit order")',
  '[type="submit"]:has-text("Order")',
];

async function tryCloseBrowser(browser: Browser | undefined) {
  try {
    await browser?.close();
  } catch {
    /* noop */
  }
}

async function acceptCookiesIfPresent(page: Page) {
  const candidates = [
    "button:has-text('Accept all')",
    "button:has-text('Accept All')",
    "button:has-text('Accept')",
    "#accept-all",
    "button[id*='accept' i]",
  ];
  for (const sel of candidates) {
    try {
      await page.click(sel, { timeout: 2000 });
      await delay(400);
      return;
    } catch {
      /* try next */
    }
  }
}

/** Henry Schein UK + Kent Express: Angular “Sign In” modal + mat inputs. */
async function loginAngularTradePortal(
  page: Page,
  baseUrl: string,
  username: string,
  password: string
): Promise<boolean> {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await delay(1200);
  await acceptCookiesIfPresent(page);

  await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a, button")).find((el) =>
      /^sign\s*in$/i.test(el.textContent?.trim() ?? "")
    );
    if (a) (a as HTMLElement).click();
  });
  await delay(1800);

  const emailSel =
    "#mat-input-0, input[type='email'], input[name='userId'], input[name='username'], mat-form-field input:first-of-type";
  const passSel = "input[type='password']";
  try {
    await page.waitForSelector(`${emailSel}, ${passSel}`, { timeout: 25_000 });
  } catch {
    return false;
  }

  const emailHandle = await page.$(emailSel);
  const passHandle = await page.$(passSel);
  if (!emailHandle || !passHandle) return false;

  await page.fill(emailSel, username);
  await delay(200);
  await page.fill(passSel, password);
  await page.press(passSel, "Enter");
  await delay(5500);

  // Heuristic: password field gone or URL changed away from pure landing
  const stillOnPw = await page.$("input[type='password']");
  return !stillOnPw;
}

async function loginDdGroup(page: Page, username: string, password: string): Promise<boolean> {
  await page.goto("https://www.ddgroup.com/login/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await delay(1000);
  await acceptCookiesIfPresent(page);

  const userSel =
    'input[type="email"], input[name="username"], input[name="email"], input[id*="email" i], input[autocomplete="username"]';
  const passSel = 'input[type="password"]';
  try {
    await page.waitForSelector(`${userSel}, ${passSel}`, { timeout: 20_000 });
  } catch {
    return false;
  }
  await page.fill(userSel, username);
  await delay(150);
  await page.fill(passSel, password);

  const submitSel =
    'button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")';
  try {
    await page.click(submitSel, { timeout: 8000 });
  } catch {
    await page.press(passSel, "Enter");
  }
  await delay(4000);
  const u = page.url();
  return !u.includes("/login");
}

function searchUrlForSupplier(supplier: "Henry Schein" | "Kent Express" | "DD Group", term: string): string {
  const q = term.trim();
  if (supplier === "Henry Schein") {
    const path = encodeURIComponent(q).replace(/%20/g, "+");
    return `https://www.henryschein.co.uk/search/${path}?type=Products`;
  }
  if (supplier === "Kent Express") {
    return `https://www.kentexpress.co.uk/search?q=${encodeURIComponent(q)}`;
  }
  return `https://www.ddgroup.com/search/?query=${encodeURIComponent(q)}`;
}

function basketUrlForSupplier(supplier: "Henry Schein" | "Kent Express" | "DD Group"): string {
  if (supplier === "Henry Schein") return "https://www.henryschein.co.uk/";
  if (supplier === "Kent Express") return "https://www.kentexpress.co.uk/cart";
  return "https://www.ddgroup.com/cart/";
}

async function clickFirstVisible(page: Page, selectors: string[], timeoutEach = 2500): Promise<boolean> {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      await loc.waitFor({ state: "visible", timeout: timeoutEach });
      await loc.click({ timeout: timeoutEach });
      return true;
    } catch {
      /* next */
    }
  }
  return false;
}

async function setQuantityIfPresent(page: Page, qty: number): Promise<void> {
  if (qty <= 1) return;
  const qtySel = 'input[type="number"], input[name*="quantity" i], input[aria-label*="quantity" i]';
  try {
    const h = await page.$(qtySel);
    if (h) {
      await page.fill(qtySel, String(Math.min(99, Math.floor(qty))));
      await delay(300);
    }
  } catch {
    /* ignore */
  }
}

async function addOneLine(
  page: Page,
  supplier: "Henry Schein" | "Kent Express" | "DD Group",
  item: BasketItem
): Promise<{ status: BasketPushResult["items"][0]["status"]; reason?: string }> {
  const url = searchUrlForSupplier(supplier, item.searchTerm);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 55_000 });
  } catch {
    return { status: "error", reason: "navigation_failed" };
  }
  await delay(supplier === "DD Group" ? 2500 : 1800);

  const body = await page.textContent("body");
  if (body && /no results|no products|0 results|nothing found/i.test(body) && !body.includes(item.searchTerm)) {
    return { status: "not_found", reason: "no_hits_on_search_page" };
  }

  await setQuantityIfPresent(page, item.quantity);

  let clicks = 0;
  const target = Math.max(1, Math.floor(item.quantity));
  for (let i = 0; i < target; i++) {
    const ok = await clickFirstVisible(page, ADD_SELECTORS, 3500);
    if (!ok) break;
    clicks++;
    await delay(supplier === "DD Group" ? 900 : 600);
    if (i < target - 1) {
      // Re-open PDP or stay — some SPAs need brief wait between duplicate adds
      await delay(400);
    }
  }

  if (clicks === 0) {
    return { status: "add_failed", reason: "add_to_basket_button_not_found" };
  }
  return { status: "added" };
}

async function tryPlaywrightPlaceOrder(
  page: Page,
  supplier: "Henry Schein" | "Kent Express" | "DD Group",
  basketUrl: string,
  options: MagentoPlaceOrderOptions | null | undefined
): Promise<SupplierOrderPlacementResult> {
  if (!options) {
    return { attempted: false, placed: false };
  }
  const errors: string[] = [];
  try {
    await page.goto(basketUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await delay(2000);
  } catch (e) {
    return {
      attempted: true,
      placed: false,
      errors: [`open_basket_failed: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  // Walk a bounded number of checkout steps (site-specific UIs differ).
  for (let step = 0; step < 14; step++) {
    const placed = await clickFirstVisible(
      page,
      ['button:has-text("Place order")', 'button:has-text("Place Order")', 'button:has-text("Confirm order")'],
      4000
    );
    if (placed) {
      await delay(3000);
      const text = (await page.textContent("body")) ?? "";
      const m = text.match(/order\s*#?\s*([A-Z0-9-]{4,})/i) ?? text.match(/confirmation[:\s#]+([A-Z0-9-]{4,})/i);
      return {
        attempted: true,
        placed: true,
        supplierOrderNumber: m?.[1]?.slice(0, 64),
        errors: errors.length ? errors : undefined,
      };
    }

    const progressed = await clickFirstVisible(page, CHECKOUT_STEP_SELECTORS, 3500);
    if (!progressed) {
      errors.push(`checkout_stalled_step_${step}`);
      break;
    }
    await delay(1200);

    // Optional PO / reference fields
    const po = options.purchaseOrderNumber?.trim();
    if (po) {
      const poSel = 'input[name*="purchase" i], input[name*="po" i], input[id*="po" i], input[placeholder*="purchase" i]';
      try {
        const el = await page.$(poSel);
        if (el) await page.fill(poSel, po);
      } catch {
        /* optional */
      }
    }
  }

  return {
    attempted: true,
    placed: false,
    errors: errors.length ? errors : ["playwright_checkout_not_completed"],
  };
}

export type PlaywrightBasketSupplier = "Henry Schein" | "Kent Express" | "DD Group";

export function isPlaywrightBasketSupplier(name: string): name is PlaywrightBasketSupplier {
  return name === "Henry Schein" || name === "Kent Express" || name === "DD Group";
}

/**
 * Log in with clinic credentials, add each line from search, optionally walk checkout.
 */
export async function pushSupplierBasketWithPlaywright(args: {
  supplier: PlaywrightBasketSupplier;
  username: string;
  password: string;
  items: BasketItem[];
  placeOrder?: MagentoPlaceOrderOptions | null;
}): Promise<BasketPushResult> {
  const { supplier, username, password, items, placeOrder } = args;
  const basketUrl = basketUrlForSupplier(supplier);
  const skeleton = (partial: Partial<BasketPushResult>): BasketPushResult => ({
    supplier,
    authenticated: false,
    basketUrl,
    items: [],
    added: 0,
    failed: 0,
    ...partial,
  });

  if (!items.length) return skeleton({});

  if (process.env.SUPPLIER_BASKET_PLAYWRIGHT_DISABLED === "1") {
    return skeleton({
      items: items.map((it) => ({
        searchTerm: it.searchTerm,
        label: it.label,
        quantity: it.quantity,
        status: "error",
        reason: "playwright_disabled_by_env",
      })),
      failed: items.length,
    });
  }

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      args: PLAYWRIGHT_LAUNCH_ARGS,
    });
    const page = await browser.newPage({
      userAgent: UA,
      viewport: { width: 1360, height: 900 },
    });

    let loggedIn = false;
    if (supplier === "DD Group") {
      loggedIn = await loginDdGroup(page, username, password);
    } else {
      const base = supplier === "Henry Schein" ? "https://www.henryschein.co.uk" : "https://www.kentexpress.co.uk";
      loggedIn = await loginAngularTradePortal(page, base, username, password);
    }

    if (!loggedIn) {
      await tryCloseBrowser(browser);
      browser = undefined;
      return skeleton({
        items: items.map((it) => ({
          searchTerm: it.searchTerm,
          label: it.label,
          quantity: it.quantity,
          status: "error",
          reason: "login_failed",
        })),
        failed: items.length,
      });
    }

    const results: BasketPushResult["items"] = [];
    for (const it of items) {
      const r = await addOneLine(page, supplier, it);
      results.push({
        searchTerm: it.searchTerm,
        label: it.label,
        quantity: it.quantity,
        status: r.status,
        externalProductId: r.status === "added" ? it.searchTerm : undefined,
        reason: r.reason,
      });
    }

    const added = results.filter((x) => x.status === "added").length;
    const baseResult: BasketPushResult = {
      supplier,
      authenticated: true,
      basketUrl,
      items: results,
      added,
      failed: results.length - added,
    };

    if (placeOrder && added > 0) {
      baseResult.supplierOrder = await tryPlaywrightPlaceOrder(page, supplier, basketUrl, placeOrder);
    } else if (placeOrder) {
      baseResult.supplierOrder = {
        attempted: false,
        placed: false,
        errors: ["skipped_no_lines_added_to_supplier_cart"],
      };
    }

    await tryCloseBrowser(browser);
    browser = undefined;
    return baseResult;
  } catch (e) {
    await tryCloseBrowser(browser);
    const msg = e instanceof Error ? e.message : String(e);
    return skeleton({
      authenticated: false,
      items: items.map((it) => ({
        searchTerm: it.searchTerm,
        label: it.label,
        quantity: it.quantity,
        status: "error",
        reason: `playwright_exception:${msg.slice(0, 200)}`,
      })),
      failed: items.length,
    });
  }
}
