/**
 * Negotiated Henry Schein UK pricing via headless Chromium (Angular sign-in modal).
 *
 * The legacy fetch-based scrape in scrapers targeted an old ASP.NET login path;
 * the live site redirects and uses `#mat-input-0` + Sign In modal (see scrape-hs-prices.ts).
 *
 * This module is intentionally server-side only (`next dev`, Node route handlers).
 * Omit from Edge runtime.
 */

import { chromium, type Browser } from "playwright";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tryCloseBrowser(browser: Browser | undefined) {
  try {
    await browser?.close();
  } catch {
    /* noop */
  }
}

/**
 * Return first SKU's unit price for `searchTerm` after portal login — account-specific negotiated rate.
 */
export async function scrapeHenryScheinNegotiated(
  hsEmailOrUser: string,
  hsPassword: string,
  searchTerm: string,
): Promise<number | null> {
  const trimmedUser = hsEmailOrUser?.trim();
  const trimmedPw = hsPassword ?? "";
  if (!trimmedUser || !trimmedPw || !searchTerm?.trim()) return null;

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: UA,
    });

    let capturedHeaders: Record<string, string> = {};
    let accountNumber = "";
    let companyId = "04420";
    let cartId = "";
    /** Captured from the portal's linelevel POST; required by HS backend (GB storefront still sends zip). */
    let zipCode = "";

    page.on("request", (req) => {
      try {
        const url = req.url();
        const postData = req.postData() ?? "";
        if (postData.includes("accountNumber")) {
          const acctMatch = postData.match(/"accountNumber":"(\d+)"/);
          const compMatch = postData.match(/"companyId":"(\d+)"/);
          if (acctMatch) accountNumber = acctMatch[1];
          if (compMatch) companyId = compMatch[1];
        }
        if (
          req.method() === "POST" &&
          url.includes("web-product-pricing") &&
          url.includes("linelevel")
        ) {
          const zm = postData.match(/"zipCode":"([^"]*)"/);
          if (zm) zipCode = zm[1];
        }
        // Match scrape-hs-prices: auth + cartId from category/search XHR (not arbitrary eapi calls).
        if (url.includes("category/search") && url.includes("cartId=") && !cartId) {
          const cm = url.match(/cartId=([^&]+)/);
          if (cm) {
            capturedHeaders = { ...req.headers() };
            cartId = cm[1];
          }
        }
      } catch {
        /* noop */
      }
    });

    console.log("[HS negotiated] Signing in...");
    await page.goto("https://www.henryschein.co.uk", { waitUntil: "domcontentloaded", timeout: 45_000 });
    await delay(1500);

    try {
      await page.click("button:has-text('Accept all')", { timeout: 2500 });
      await delay(500);
    } catch {
      /* cookie banner absent */
    }

    await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find(
        (el) => el.textContent?.trim() === "Sign In",
      );
      if (a) (a as HTMLElement).click();
    });
    await delay(2000);
    await page.waitForSelector("#mat-input-0,input[type='password']", { timeout: 25_000 });
    await page.fill("#mat-input-0", trimmedUser);
    await delay(250);
    await page.fill("input[type='password']", trimmedPw);
    await page.press("input[type='password']", "Enter");
    await delay(5500);

    const path = encodeURIComponent(searchTerm.trim()).replace(/%20/g, "+");
    await page.goto(
      `https://www.henryschein.co.uk/search/${path}?type=Products`,
      { waitUntil: "networkidle", timeout: 60_000 },
    );
    await delay(3000);

    const href = page.url();
    const mAcc = href.match(/shipToAccountNumber=(\d+)/);
    if (mAcc) accountNumber = mAcc[1];

    await tryCloseBrowser(browser);
    browser = undefined;

    const authHeader =
      capturedHeaders["authorization"] ??
      Object.entries(capturedHeaders).find(([k]) => k.toLowerCase() === "authorization")?.[1];
    const headersOut = authHeader ? { ...capturedHeaders, authorization: authHeader } : capturedHeaders;

    console.log(
      "[HS negotiated] capture:",
      JSON.stringify({
        cartIdPreview: cartId ? cartId.slice(0, 12) + "…" : "",
        cartIdLen: cartId.length,
        hasAuth: !!authHeader,
        accountNumber,
        hasZip: !!zipCode,
      }),
    );

    if (!authHeader || !cartId) {
      console.warn("[HS negotiated] No auth headers or cart — login failed, wrong password, or site layout changed.");
      return null;
    }
    if (!accountNumber) {
      console.warn("[HS negotiated] Missing accountNumber after search — retry with full email if using short login.");
      return null;
    }

    const query = Buffer.from(`${searchTerm}:relevance`).toString("base64");
    const searchUrl = `https://api.henryschein.co.uk/eapi/web-product-details/v2/product/category/search/dental-gb?query=${query}&currentPage=0&fields=FULL&pageSize=8&refCat=ALL&isPreferred=false&cartId=${cartId}&currentShipToID=`;

    const searchRes = await fetch(searchUrl, { headers: headersOut });
    if (!searchRes.ok) {
      console.warn("[HS negotiated] Search API HTTP", searchRes.status, await searchRes.text().then((t) => t.slice(0, 160)));
      return null;
    }

    const json = (await searchRes.json()) as { products?: { code?: string }[] };
    const sku = json.products?.[0]?.code;
    if (!sku) {
      console.warn("[HS negotiated] No product code in search results");
      return null;
    }

    const pricingRes = await fetch(
      "https://api.henryschein.co.uk/eapi/web-product-pricing/v2/product/pricing/linelevel",
      {
        method: "POST",
        headers: { ...headersOut, "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber,
          companyId,
          countryId: "GB",
          item: [
            {
              productId: sku,
              quantity: "1",
              unitOfMeasure: "EA",
              hsProductRestricted: false,
            },
          ],
          isInventoryRequired: true,
          isPriceRequired: true,
          isRestrictionRequired: true,
          isCostRequired: false,
          isPriceGuidanceRequired: false,
          defaultWebShippingMethod: "",
          zipCode,
          isTsmUser: false,
          isQuantityBreakRequired: false,
          isPriceOverrideRequired: false,
          isInventoryStatusRequired: false,
          isInventoryQtyRequired: false,
          isDeliveryDateRequired: false,
        }),
      },
    );
    if (!pricingRes.ok) {
      console.warn("[HS negotiated] Pricing API HTTP", pricingRes.status);
      return null;
    }

    const priceJson = (await pricingRes.json()) as {
      status?: { code?: string; message?: string };
      item?: { price?: { unitPrice?: string } }[];
    };
    const topOk = priceJson.status?.code === "200";
    const unit = priceJson.item?.[0]?.price?.unitPrice;
    if (!topOk || !unit) {
      console.warn(
        "[HS negotiated] Pricing rejected or empty",
        JSON.stringify({ status: priceJson.status, hasItem: !!priceJson.item?.length }).slice(0, 280),
      );
      return null;
    }
    const n = parseFloat(unit);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (e) {
    console.warn("[HS negotiated] scrape error:", e);
    return null;
  } finally {
    await tryCloseBrowser(browser);
  }
}
