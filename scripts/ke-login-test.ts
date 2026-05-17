/**
 * Kent Express login test via Playwright.
 * KE is an Angular SPA on Henry Schein's SAP Commerce Cloud.
 * Username/password login via the HS identity provider.
 *
 * If successful, captures network requests to find product catalog endpoints
 * and extract prices.
 */

import { chromium, type Browser } from "playwright";

const KE_USERNAME = "jerome@thedentistgallery.com";
const KE_PASSWORD = "Bracelet26";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    });

    const apiRequests: { url: string; method: string; status?: number }[] = [];

    page.on("request", req => {
      const url = req.url();
      if (url.includes("api.") || url.includes("/api/") || url.includes("oauth") || url.includes("token") || url.includes("cart") || url.includes("product") || url.includes("price")) {
        apiRequests.push({ url: url.slice(0, 200), method: req.method() });
      }
    });

    page.on("response", async res => {
      const url = res.url();
      if ((url.includes("api.") || url.includes("/api/")) && res.status() !== 200) {
        const idx = apiRequests.findIndex(r => r.url.startsWith(url.slice(0, 100)));
        if (idx >= 0) apiRequests[idx].status = res.status();
      }
    });

    console.log("🌐 Navigating to Kent Express...");
    await page.goto("https://www.kentexpress.co.uk", { waitUntil: "networkidle", timeout: 60_000 });
    console.log(`URL: ${page.url()}`);
    await delay(2000);

    // Look for login link/button
    const loginLinks = await page.$$eval("a, button", els =>
      els.filter(el => /sign.?in|log.?in/i.test(el.textContent ?? ""))
         .map(el => ({ text: el.textContent?.trim(), tag: el.tagName }))
    );
    console.log("Login links found:", loginLinks.slice(0, 5));

    // Try clicking first Sign In
    try {
      await page.click("a:has-text('Sign in'), a:has-text('Log in'), button:has-text('Sign in')", { timeout: 5000 });
      await delay(3000);
      console.log(`After click URL: ${page.url()}`);
    } catch {
      console.log("No direct sign in button — trying direct URL");
      await page.goto("https://www.kentexpress.co.uk/login", { waitUntil: "networkidle", timeout: 30_000 });
      await delay(2000);
      console.log(`Login page URL: ${page.url()}`);
    }

    // Screenshot of what we see
    const html = await page.content();
    const inputFields = await page.$$eval("input", els =>
      els.map(el => ({ type: (el as HTMLInputElement).type, id: el.id, name: (el as HTMLInputElement).name, placeholder: (el as HTMLInputElement).placeholder }))
    );
    console.log("Input fields on login page:", inputFields);

    // Try to fill credentials
    const emailInput = await page.$("input[type='email'], input[name='email'], input[name='username'], #username, #email, #mat-input-0");
    const passInput = await page.$("input[type='password']");

    if (emailInput && passInput) {
      console.log("✅ Found login form — filling credentials...");
      await emailInput.fill(KE_USERNAME);
      await delay(300);
      await passInput.fill(KE_PASSWORD);
      await passInput.press("Enter");
      await delay(8000);
      console.log(`After login URL: ${page.url()}`);

      const afterHtml = await page.content();
      const isLoggedIn = afterHtml.includes("logout") || afterHtml.includes("My Account") || afterHtml.includes("my-account") || !afterHtml.toLowerCase().includes("sign in");
      console.log(`Logged in: ${isLoggedIn}`);

      if (isLoggedIn) {
        // Try to navigate to a product search
        await page.goto("https://www.kentexpress.co.uk/search?q=gloves", { waitUntil: "networkidle", timeout: 30_000 });
        await delay(5000);
        console.log(`Search URL: ${page.url()}`);

        // Look for prices
        const prices = await page.$$eval("[class*='price'],[data-price]", els =>
          els.slice(0, 10).map(el => ({ text: el.textContent?.trim(), class: el.className }))
        );
        console.log("Prices found:", prices);
      }
    } else {
      console.log("❌ No login form found");
      console.log("Page title:", await page.title());
      console.log("First 500 chars of HTML:", html.slice(0, 500));
    }

    console.log("\nAPI requests captured:", apiRequests.slice(0, 20));

  } finally {
    try { await browser?.close(); } catch {}
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
