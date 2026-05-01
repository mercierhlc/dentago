import { chromium } from "playwright";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const productData: any[] = [];

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    if (!url.includes("api.kentexpress")) return;
    try {
      const json = await res.json();
      if (json?.products?.length > 0) {
        console.log(`\nProduct API hit: ${url.slice(0, 120)}`);
        console.log(`Products: ${json.products.length}`);
        // Show full first product
        console.log("First product:", JSON.stringify(json.products[0], null, 2).slice(0, 800));
        productData.push(...json.products);
      }
      if (json?.searchResults?.products?.length > 0) {
        console.log(`\nSearch result API: ${url.slice(0, 120)}`);
        console.log(`Products: ${json.searchResults.products.length}`);
        productData.push(...json.searchResults.products);
      }
    } catch {}
  });

  // Load homepage first for session
  await page.goto("https://www.kentexpress.co.uk/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await delay(3000);

  // Try navigating via click to dental category
  console.log("\nTrying to click into dental section...");
  try {
    // Find a dental link
    const dentalLink = await page.$("a[href*='/dental']");
    if (dentalLink) {
      console.log("Found dental link, clicking...");
      await dentalLink.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await delay(3000);
    }
  } catch (e: any) {
    console.log("Click failed:", e.message);
  }

  console.log(`\nTotal products captured: ${productData.length}`);
  if (productData.length > 0) {
    console.log("Sample product keys:", Object.keys(productData[0]));
  }

  await browser.close();
}
main().catch(console.error);
