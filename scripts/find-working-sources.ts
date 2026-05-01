import { chromium } from "playwright";

async function check(browser: any, name: string, url: string) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(4000);

    const result = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"))
        .map(i => i.src || i.getAttribute("data-src") || "")
        .filter(s => s.startsWith("http") && !s.includes("logo") && !s.includes("icon") && !s.includes("banner"))
        .slice(0, 5);
      const h3s = Array.from(document.querySelectorAll("h2,h3,h4"))
        .map(h => h.textContent?.trim())
        .filter(t => t && t.length > 3 && t.length < 100)
        .slice(0, 8);
      const ldProducts: string[] = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s: any) => {
        try {
          const d = JSON.parse(s.textContent);
          if (d["@type"] === "Product" || d?.itemListElement?.length) ldProducts.push(d.name || "item-found");
        } catch {}
      });
      const loginSignals = document.body.innerHTML.toLowerCase();
      const needsLogin = loginSignals.includes("sign in to view") || loginSignals.includes("log in to see") || loginSignals.includes("please login");
      return { imgs, h3s, ldProducts, needsLogin, bodyLen: document.body.innerHTML.length };
    });

    console.log(`\n✅ ${name} — ${url}`);
    console.log(`   Body: ${result.bodyLen} chars | needsLogin: ${result.needsLogin}`);
    console.log(`   Images: ${result.imgs.slice(0, 2).join(" | ")}`);
    console.log(`   Headings: ${result.h3s.slice(0, 4).join(" | ")}`);
    if (result.ldProducts.length) console.log(`   LD+JSON products: ${result.ldProducts.join(", ")}`);
  } catch (e: any) {
    console.log(`\n❌ ${name}: ${e.message?.slice(0, 80)}`);
  }
  await page.close();
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  // Quick check: what actually shows products
  const sources = [
    ["Dental Sky Gloves", "https://www.dentalsky.com/gloves.html"],
    ["Dental Sky Single Product", "https://www.dentalsky.com/medicom-gloves-supersoft-nitrile-powder-free-blue-x-small-100-pack.html"],
    ["Trycare Products", "https://www.trycare.co.uk/products"],
    ["Kent Express Dental", "https://www.kentexpress.co.uk/dental-supplies"],
    ["Dental Directory Products", "https://www.dental-directory.co.uk/products"],
    ["Dentsply UK", "https://www.dentsplysirona.com/en-gb/products.html"],
    ["GC UK", "https://www.gceurope.com/en/products/"],
    ["Septodont UK", "https://www.septodont.co.uk/products"],
    ["Voco Restoratives", "https://www.voco.dental/en/products/restoratives.html"],
    ["Hu-Friedy", "https://www.hu-friedy.com/products"],
    ["SDI Dental", "https://www.sdi.com.au/dental/products/"],
  ];

  for (const [name, url] of sources) {
    await check(ctx, name, url);
  }

  await browser.close();
}

main().catch(console.error);
