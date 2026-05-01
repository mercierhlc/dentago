import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  await page.goto("https://www.dentalsky.com/gloves.html", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  const debug = await page.evaluate(() => {
    const ldScripts: string[] = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s: any) => {
      ldScripts.push(s.textContent?.slice(0, 800) ?? "");
    });

    // Also check what product elements exist
    const allClasses = new Set<string>();
    document.querySelectorAll("[class]").forEach((el: any) => {
      el.className.split(" ").forEach((c: string) => allClasses.add(c));
    });
    const productClasses = Array.from(allClasses).filter(c => c.toLowerCase().includes("product")).slice(0, 20);

    // Check for Magento product items
    const magentoProducts = document.querySelectorAll(".product-items li, .products-grid .item, ol.product-items li");

    // Check images with catalog in URL
    const catalogImgs = Array.from(document.querySelectorAll("img"))
      .filter((img: any) => (img.src || "").includes("catalog/product"))
      .slice(0, 5)
      .map((img: any) => ({ src: img.src, dataSrc: img.getAttribute("data-src"), alt: img.alt }));

    return {
      ldCount: ldScripts.length,
      ldSnippets: ldScripts,
      productClasses,
      magentoProductCount: magentoProducts.length,
      catalogImgs,
      bodyLen: document.body.innerHTML.length,
    };
  });

  console.log(`LD+JSON scripts: ${debug.ldCount}`);
  debug.ldSnippets.forEach((s, i) => console.log(`\n[LD ${i}]: ${s}`));
  console.log(`\nProduct-related classes: ${debug.productClasses.join(", ")}`);
  console.log(`Magento .product-items li count: ${debug.magentoProductCount}`);
  console.log(`\nCatalog images:`, JSON.stringify(debug.catalogImgs, null, 2));
  console.log(`Body length: ${debug.bodyLen}`);

  await browser.close();
}

main().catch(console.error);
