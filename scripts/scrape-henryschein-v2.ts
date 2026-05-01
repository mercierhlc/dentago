import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const PROGRESS_PATH = path.join(process.env.HOME!, "Downloads", "hs-scrape-v2.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Product {
  name: string;
  brand: string;
  sku: string;
  image: string;
  category: string;
  packSize: string;
  price: number;
  description: string;
}

async function main() {
  const browser = await chromium.launch({
    headless: false, // show browser so we can see what's happening
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.130 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // Intercept product API responses
  const products: Product[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;

    // Look for product listing API responses
    if (url.includes("product") || url.includes("catalog") || url.includes("search") || url.includes("items")) {
      try {
        const json = await res.json();
        // Check if this looks like product data
        const items = json?.items ?? json?.products ?? json?.results ?? json?.data ?? [];
        if (Array.isArray(items) && items.length > 0 && items[0]?.name) {
          console.log(`\n🎯 Found product API: ${url}`);
          console.log(`   ${items.length} items`);
          items.forEach((item: any) => {
            const img = item.imageUrl || item.image || item.thumbnail || item.media_gallery_entries?.[0]?.file;
            products.push({
              name: item.name || item.title || item.productName || "",
              brand: item.brand || item.manufacturer || item.brandName || "",
              sku: item.sku || item.itemNo || item.productCode || item.id || "",
              image: img ? (img.startsWith("http") ? img : `https://assets.henryschein.com/${img}`) : "",
              category: item.category || item.categoryName || "",
              packSize: item.packSize || item.unitOfMeasure || item.packQuantity || "1 unit",
              price: parseFloat(item.price || item.unitPrice || item.salePrice || 0) || 0,
              description: item.description || item.shortDescription || "",
            });
          });
          fs.writeFileSync(PROGRESS_PATH, JSON.stringify(products, null, 2));
          console.log(`   Total captured: ${products.length}`);
        }
      } catch {}
    }
  });

  // Navigate to HS and try to browse without logging in
  console.log("Opening Henry Schein...");
  await page.goto("https://www.henryschein.co.uk", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000);

  // Try to dismiss cookie/login popups
  const cookieBtn = await page.$("button[id*='cookie'], button[class*='accept'], #onetrust-accept-btn-handler");
  if (cookieBtn) { await cookieBtn.click(); await delay(1000); }

  // Try clicking "Continue as guest" or "Browse without logging in"
  const guestBtns = await page.$$("button, a");
  for (const btn of guestBtns) {
    const text = (await btn.textContent() ?? "").toLowerCase();
    if (text.includes("guest") || text.includes("browse") || text.includes("without")) {
      console.log(`Clicking: "${text}"`);
      await btn.click();
      await delay(2000);
      break;
    }
  }

  // Navigate directly to search which might show products without full login
  console.log("Trying HS search...");
  await page.goto("https://www.henryschein.co.uk/dental/Search?q=nitrile+gloves", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await delay(8000);

  // Check what's on the page
  const html = await page.content();
  const hasProducts = html.includes("product") && html.length > 50000;
  console.log(`Page size: ${html.length} chars, hasProducts: ${hasProducts}`);

  // Try to extract product data from DOM
  const domProducts = await page.evaluate(() => {
    const results: any[] = [];
    // Angular renders products in specific component structures
    document.querySelectorAll("[class*='product'], [class*='Product'], app-product-tile, app-product-card").forEach(el => {
      const name = el.querySelector("[class*='name'], [class*='title'], h2, h3")?.textContent?.trim();
      const img = el.querySelector("img")?.src || el.querySelector("img")?.getAttribute("data-src");
      const sku = el.querySelector("[class*='sku'], [class*='item']")?.textContent?.trim();
      const price = el.querySelector("[class*='price'], [class*='Price']")?.textContent?.trim();
      if (name && name.length > 5) results.push({ name, img, sku, price });
    });
    return results;
  });

  console.log(`DOM products extracted: ${domProducts.length}`);
  domProducts.slice(0, 10).forEach(p => console.log(`  - ${p.name} | ${p.img?.slice(0, 80)}`));

  // Try to scroll and trigger lazy loading
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await delay(3000);

  console.log(`\nTotal API products captured: ${products.length}`);
  if (products.length > 0) {
    console.log("Sample:", JSON.stringify(products[0], null, 2));
  }

  // Keep browser open for inspection
  await delay(5000);
  await browser.close();
}

main().catch(console.error);
