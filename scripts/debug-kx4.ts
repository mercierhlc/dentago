import { chromium } from "playwright";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: false }); // Show browser to see what's happening
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const productApiCalls: string[] = [];

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    if (!url.includes("api.kentexpress")) return;
    try {
      const json = await res.json();
      if ((json?.products?.length > 0) || (json?.searchResults?.products?.length > 0)) {
        const count = json?.products?.length ?? json?.searchResults?.products?.length;
        productApiCalls.push(`${count} products from: ${url.slice(0, 150)}`);
      }
    } catch {}
  });

  // Load homepage for session
  console.log("Loading homepage...");
  await page.goto("https://www.kentexpress.co.uk/", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await delay(2000);

  // Dismiss cookie consent
  try {
    await page.click("#uc-btn-accept-banner, [data-testid='uc-accept-all-button'], button:has-text('Accept')", { timeout: 5000 });
    console.log("Accepted cookies");
    await delay(1000);
  } catch {
    // Try via JS
    try {
      await page.evaluate(() => {
        const btn = document.querySelector("button[data-testid], #uc-btn-accept-banner, .uc-btn");
        if (btn) (btn as HTMLElement).click();
      });
      console.log("Accepted cookies via JS");
    } catch {}
  }

  await delay(2000);

  // Now navigate to dental category
  console.log("Navigating to dental...");
  await page.goto("https://www.kentexpress.co.uk/dental", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await delay(3000);

  const title = await page.title();
  const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim());
  console.log("Title:", title, "| H1:", h1);
  console.log("Product API calls:", productApiCalls);

  // Take screenshot
  await page.screenshot({ path: `${process.env.HOME}/Downloads/kx-dental-page.png`, fullPage: false });
  console.log("Screenshot saved");

  await delay(5000);
  await browser.close();
}
main().catch(console.error);
