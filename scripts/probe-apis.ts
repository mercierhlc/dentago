import { chromium } from "playwright";

async function main() {
  // Try Dental Sky Magento REST API (public by default)
  const magentoEndpoints = [
    "https://www.dentalsky.com/rest/V1/products?searchCriteria[pageSize]=10",
    "https://www.dentalsky.com/rest/all/V1/categories",
    "https://www.dentalsky.com/rest/V1/categories",
  ];

  for (const url of magentoEndpoints) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120", Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      console.log(`\n[${res.status}] ${url}`);
      console.log(text.slice(0, 500));
    } catch (e: any) {
      console.log(`\nFailed ${url}: ${e.message}`);
    }
  }

  // Probe Dental Directory deeper
  console.log("\n\n--- Dental Directory ---");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const jsonResponses: { url: string; snippet: string }[] = [];
  page.on("response", async (res) => {
    const ct = res.headers()["content-type"] ?? "";
    if (ct.includes("json")) {
      try {
        const text = await res.text();
        jsonResponses.push({ url: res.url(), snippet: text.slice(0, 500) });
      } catch {}
    }
  });

  await page.goto("https://www.dental-directory.co.uk/products", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);

  const html = await page.content();
  // Extract product-like data
  const skus = html.match(/sku["\s:=]+["']?([A-Z0-9\-]{4,20})/gi)?.slice(0, 10) ?? [];
  const prices = html.match(/£[\d,.]+/g)?.slice(0, 10) ?? [];
  const imgs = html.match(/https:\/\/[^"']+\.(jpg|png|webp)/gi)?.slice(0, 10) ?? [];

  console.log("SKUs found:", skus);
  console.log("Prices found:", prices);
  console.log("Images found:", imgs);
  console.log("JSON responses:", jsonResponses.length);
  jsonResponses.forEach(r => console.log(`  ${r.url}: ${r.snippet.slice(0, 200)}`));

  // Try their search
  await page.goto("https://www.dental-directory.co.uk/products?q=gloves", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(3000);
  const html2 = await page.content();
  const productTitles = html2.match(/<h[23][^>]*>([^<]{10,80})<\/h[23]>/g)?.slice(0, 15) ?? [];
  console.log("\nDental Directory product titles:", productTitles);

  await browser.close();
}

main().catch(console.error);
