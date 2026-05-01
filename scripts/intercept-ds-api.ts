/**
 * Intercepts Dental Sky's AJAX/API calls to capture product data
 * when loading category pages. Magento stores make backend calls
 * to load product listings that may contain full product data.
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const PROGRESS = path.join(process.env.HOME!, "Downloads", "ds-api-products.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  const capturedProducts: any[] = [];
  const capturedUrls: string[] = [];

  // Intercept ALL responses and look for product data
  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("json") && !ct.includes("javascript")) return;

    try {
      const text = await res.text();
      if (!text.includes('"name"') && !text.includes("product") && !text.includes("sku")) return;
      if (text.length < 100) return;

      // Try to find product arrays in the response
      const data = JSON.parse(text);

      // Common Magento API patterns
      const candidates = [
        data?.items, data?.products?.items, data?.searchCriteria,
        data?.data?.products?.items, data?.hits?.hits,
        Object.values(data || {}).find((v: any) => Array.isArray(v) && v.length > 0 && v[0]?.name),
      ].filter(Boolean);

      for (const items of candidates) {
        if (!Array.isArray(items) || items.length === 0) continue;
        const first = items[0];
        if (!first?.name) continue;

        console.log(`\n🎯 Found product API: ${url.slice(0, 100)}`);
        console.log(`   ${items.length} items, first: ${first.name?.slice(0, 50)}`);
        capturedUrls.push(url);

        items.forEach((item: any) => {
          const img = item.image?.url || item.small_image?.url || item.thumbnail?.url ||
            (item.media_gallery_entries?.[0]?.file
              ? `https://www.dentalsky.com/pub/media/catalog/product${item.media_gallery_entries[0].file}`
              : "");
          capturedProducts.push({
            name: item.name || "",
            sku: item.sku || "",
            brand: item.custom_attributes?.find((a: any) => a.attribute_code === "manufacturer")?.value || item.brand || "",
            image: img,
            price: item.price?.regularPrice?.amount?.value || item.price || 0,
            description: item.description?.html?.replace(/<[^>]+>/g, "").slice(0, 400) || item.meta_description || "",
          });
        });
        break;
      }

      // Also look for Magento's x-magento-init data embedded in JSON
      if (text.includes("product_id") && text.includes("media_gallery")) {
        capturedUrls.push(`embedded: ${url}`);
        console.log(`\n📦 Found embedded product data in: ${url.slice(0, 80)}`);
      }
    } catch {
      // Not JSON, skip
    }
  });

  const categories = [
    "https://www.dentalsky.com/gloves.html",
    "https://www.dentalsky.com/face-masks.html",
    "https://www.dentalsky.com/infection-control.html",
    "https://www.dentalsky.com/anaesthetics.html",
    "https://www.dentalsky.com/composites.html",
    "https://www.dentalsky.com/endodontics.html",
    "https://www.dentalsky.com/impression-materials.html",
    "https://www.dentalsky.com/dental-consumables.html",
  ];

  for (const catUrl of categories) {
    console.log(`\nLoading ${catUrl.split("/").pop()}...`);
    try {
      await page.goto(catUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Wait for potential AJAX calls to fire
      await delay(8000);
      // Also scroll to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(3000);
    } catch (e: any) {
      console.log(`  Error: ${e.message?.slice(0, 60)}`);
    }
    await delay(1000);
  }

  await browser.close();

  console.log(`\n\n═══ Results ═══`);
  console.log(`API URLs found: ${capturedUrls.length}`);
  capturedUrls.forEach(u => console.log(`  ${u}`));
  console.log(`Products captured: ${capturedProducts.length}`);
  capturedProducts.slice(0, 5).forEach(p => console.log(`  - ${p.name} | ${p.image?.slice(0, 80)}`));

  if (capturedProducts.length > 0) {
    fs.writeFileSync(PROGRESS, JSON.stringify(capturedProducts, null, 2));
    console.log(`\nSaved to ${PROGRESS}`);
  }
}

main().catch(console.error);
