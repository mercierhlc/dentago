import { chromium } from "playwright";

async function probeSupplier(name: string, url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const jsonResponses: { url: string; snippet: string }[] = [];

  page.on("response", async (res) => {
    const ct = res.headers()["content-type"] ?? "";
    if (ct.includes("json")) {
      try {
        const text = await res.text();
        if (text.includes("product") || text.includes("name") || text.includes("sku")) {
          jsonResponses.push({ url: res.url(), snippet: text.slice(0, 400) });
        }
      } catch {}
    }
  });

  console.log(`\n🔍 Probing ${name}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);

  // Check for products in HTML
  const html = await page.content();
  const hasProducts = html.includes("product") || html.includes("catalog");
  const requiresAuth = html.toLowerCase().includes("sign in") || html.toLowerCase().includes("log in") || html.toLowerCase().includes("login");

  console.log(`  Requires auth: ${requiresAuth}`);
  console.log(`  Has product content: ${hasProducts}`);
  console.log(`  JSON responses with product data: ${jsonResponses.length}`);
  jsonResponses.slice(0, 2).forEach(r => console.log(`  → ${r.url}\n    ${r.snippet.slice(0, 200)}`));

  // Try to extract product names directly
  const productNames = html.match(/data-name="([^"]{5,80})"/g)?.slice(0, 5) ?? [];
  const titles = html.match(/<h[23][^>]*>([^<]{5,80})<\/h[23]>/g)?.slice(0, 5) ?? [];
  if (productNames.length) console.log("  Product names:", productNames);
  if (titles.length) console.log("  Page titles:", titles);

  await browser.close();
}

async function main() {
  await probeSupplier("Kent Express", "https://www.kentexpress.co.uk/dental-supplies/categories");
  await probeSupplier("Dental Directory", "https://www.dental-directory.co.uk/products");
  await probeSupplier("Trycare", "https://www.trycare.co.uk/products");
  await probeSupplier("Dental Sky", "https://www.dentalsky.com/dental-consumables.html");
}

main().catch(console.error);
