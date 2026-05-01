/**
 * Scrapes dental product manufacturers with public catalogs:
 * - GC Europe (composites, cements, preventive)
 * - Septodont (anaesthetics, endodontics)
 * - Voco (composites, restoratives)
 * - Coltene (endodontics, composites)
 * - SDI (composites, whitening)
 * - Dentsply Sirona (wide range)
 * - Kerr (composites, instruments)
 * - Hu-Friedy (instruments)
 * All these products are available through Henry Schein UK.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const PROGRESS_PATH = path.join(process.env.HOME!, "Downloads", "manufacturer-products.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const CATEGORY_MAP: Record<string, string> = {
  "glove": "PPE", "mask": "PPE", "ppe": "PPE", "apron": "PPE", "gown": "PPE",
  "infection": "Infection Control", "disinfect": "Infection Control", "steril": "Infection Control", "wipe": "Infection Control", "pouch": "Infection Control", "autoclave": "Infection Control",
  "anaesth": "Anaesthetics", "cartridge": "Anaesthetics", "needle": "Anaesthetics", "articaine": "Anaesthetics", "lidocaine": "Anaesthetics", "septanest": "Anaesthetics", "scandonest": "Anaesthetics",
  "composite": "Composites", "bond": "Composites", "resin": "Composites", "cement": "Composites", "glass ionomer": "Composites", "ionomer": "Composites", "adhesive": "Composites",
  "endo": "Endodontics", "file": "Endodontics", "gutta": "Endodontics", "obturat": "Endodontics", "sealer": "Endodontics", "apex": "Endodontics",
  "implant": "Implants", "abutment": "Implants", "fixture": "Implants",
  "impression": "Impression Materials", "alginate": "Impression Materials", "polyvinyl": "Impression Materials", "silicone": "Impression Materials", "putty": "Impression Materials",
  "instrument": "Instruments", "forcep": "Instruments", "probe": "Instruments", "mirror": "Instruments", "scaler": "Instruments", "curette": "Instruments", "excavator": "Instruments",
  "orthodont": "Orthodontics", "bracket": "Orthodontics", "archwire": "Orthodontics",
  "xray": "Diagnostics", "x-ray": "Diagnostics", "sensor": "Diagnostics", "phosphor": "Diagnostics",
  "prophyl": "Consumables", "fluoride": "Consumables", "whitening": "Consumables", "bleach": "Consumables", "polish": "Consumables",
};

function mapCategory(name: string, desc = ""): string {
  const lower = (name + " " + desc).toLowerCase();
  for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(kw)) return cat;
  }
  return "Consumables";
}

interface Product {
  name: string;
  brand: string;
  sku: string;
  image: string;
  description: string;
  packSize: string;
  price: number;
  sourceUrl: string;
}

// ─── GC Europe ───────────────────────────────────────────────────────────────
async function scrapeGC(page: any): Promise<Product[]> {
  const products: Product[] = [];
  const categories = [
    "https://www.gceurope.com/en/products/category/composites-and-restoratives/",
    "https://www.gceurope.com/en/products/category/cements-and-liners/",
    "https://www.gceurope.com/en/products/category/preventives/",
    "https://www.gceurope.com/en/products/category/infection-control/",
    "https://www.gceurope.com/en/products/category/impression-materials/",
    "https://www.gceurope.com/en/products/category/endodontics/",
  ];
  for (const catUrl of categories) {
    try {
      console.log(`  GC: ${catUrl}`);
      await page.goto(catUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await delay(3000);
      const items = await page.evaluate(() => {
        const results: any[] = [];
        document.querySelectorAll("article, .product-item, [class*='product']").forEach((el: any) => {
          const nameEl = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']");
          const imgEl = el.querySelector("img");
          const linkEl = el.querySelector("a[href]");
          const name = nameEl?.textContent?.trim() ?? "";
          const image = imgEl?.src || imgEl?.getAttribute("data-src") || "";
          const link = linkEl?.href ?? "";
          if (name.length > 3 && image.includes("http")) {
            results.push({ name, image, link });
          }
        });
        return results;
      });

      for (const item of items) {
        if (!item.image || products.find(p => p.name === item.name)) continue;
        // Get description from product page
        let description = "";
        try {
          await page.goto(item.link, { waitUntil: "domcontentloaded", timeout: 15000 });
          await delay(1500);
          description = await page.evaluate(() => {
            return document.querySelector("[class*='description'], [class*='intro'], .product-intro p, meta[name='description']")
              ?.getAttribute?.("content") ||
              document.querySelector("[class*='description'], [class*='intro'], .product-intro p")?.textContent?.trim() || "";
          });
          description = description.slice(0, 300);
        } catch {}
        products.push({
          name: item.name,
          brand: "GC",
          sku: "",
          image: item.image,
          description,
          packSize: "1 unit",
          price: 0,
          sourceUrl: item.link,
        });
        console.log(`    ✅ ${item.name.slice(0, 60)}`);
        if (products.length >= 80) break;
      }
      await delay(1000);
    } catch (e: any) {
      console.log(`  GC error: ${e.message?.slice(0, 80)}`);
    }
    if (products.length >= 80) break;
  }
  return products;
}

// ─── Septodont ────────────────────────────────────────────────────────────────
async function scrapeSepto(page: any): Promise<Product[]> {
  const products: Product[] = [];
  const urls = [
    "https://www.septodont.co.uk/products",
    "https://www.septodont.co.uk/products/local-anaesthetics",
    "https://www.septodont.co.uk/products/endodontics",
    "https://www.septodont.co.uk/products/restorative",
  ];
  for (const url of urls) {
    try {
      console.log(`  Septodont: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await delay(3000);
      const items = await page.evaluate(() => {
        const results: any[] = [];
        document.querySelectorAll("article, .product-card, .product-item, [class*='product']").forEach((el: any) => {
          const nameEl = el.querySelector("h2, h3, h4, [class*='title'], [class*='name']");
          const imgEl = el.querySelector("img");
          const linkEl = el.querySelector("a[href]");
          const descEl = el.querySelector("p, [class*='desc']");
          const name = nameEl?.textContent?.trim() ?? "";
          let image = imgEl?.src || imgEl?.getAttribute("data-src") || imgEl?.getAttribute("data-lazy-src") || "";
          if (image.startsWith("/")) image = "https://www.septodont.co.uk" + image;
          const link = linkEl?.href ?? "";
          const desc = descEl?.textContent?.trim() ?? "";
          if (name.length > 3 && image.includes("http")) {
            results.push({ name, image, link, desc });
          }
        });
        return results;
      });
      for (const item of items) {
        if (products.find(p => p.name === item.name)) continue;
        products.push({
          name: item.name,
          brand: "Septodont",
          sku: "",
          image: item.image,
          description: item.desc?.slice(0, 300) || `${item.name} from Septodont.`,
          packSize: "1 unit",
          price: 0,
          sourceUrl: item.link,
        });
        console.log(`    ✅ ${item.name.slice(0, 60)}`);
      }
      await delay(1500);
    } catch (e: any) {
      console.log(`  Septo error: ${e.message?.slice(0, 80)}`);
    }
    if (products.length >= 40) break;
  }
  return products;
}

// ─── Voco ─────────────────────────────────────────────────────────────────────
async function scrapeVoco(page: any): Promise<Product[]> {
  const products: Product[] = [];
  const urls = [
    "https://www.voco.dental/en/products/restoratives.html",
    "https://www.voco.dental/en/products/preventives.html",
    "https://www.voco.dental/en/products/endodontics.html",
    "https://www.voco.dental/en/products/impression.html",
  ];
  for (const url of urls) {
    try {
      console.log(`  Voco: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await delay(3000);
      const items = await page.evaluate(() => {
        const results: any[] = [];
        document.querySelectorAll(".product-teaser, .product-card, [class*='product']").forEach((el: any) => {
          const nameEl = el.querySelector("h2, h3, h4, .product-name, [class*='title']");
          const imgEl = el.querySelector("img");
          const linkEl = el.querySelector("a[href]");
          const name = nameEl?.textContent?.trim() ?? "";
          let image = imgEl?.src || imgEl?.getAttribute("data-src") || "";
          if (image.startsWith("/")) image = "https://www.voco.dental" + image;
          const link = linkEl?.href ?? "";
          if (name.length > 3 && image.length > 10) {
            results.push({ name, image, link });
          }
        });
        return results;
      });
      for (const item of items) {
        if (!item.image.includes("http")) continue;
        if (products.find(p => p.name === item.name)) continue;
        products.push({
          name: item.name,
          brand: "VOCO",
          sku: "",
          image: item.image,
          description: `${item.name} — professional dental material from VOCO.`,
          packSize: "1 unit",
          price: 0,
          sourceUrl: item.link,
        });
        console.log(`    ✅ ${item.name.slice(0, 60)}`);
      }
      await delay(1000);
    } catch (e: any) {
      console.log(`  Voco error: ${e.message?.slice(0, 80)}`);
    }
    if (products.length >= 60) break;
  }
  return products;
}

// ─── Trycare (public Shopify-like store) ─────────────────────────────────────
async function scrapeTrycare(page: any): Promise<Product[]> {
  const products: Product[] = [];
  // Trycare has a publicly browsable product catalog
  const catUrls = [
    "https://www.trycare.co.uk/categories/infection-control",
    "https://www.trycare.co.uk/categories/ppe",
    "https://www.trycare.co.uk/categories/composites",
    "https://www.trycare.co.uk/categories/anaesthetics",
    "https://www.trycare.co.uk/categories/endodontics",
    "https://www.trycare.co.uk/categories/impression",
    "https://www.trycare.co.uk/categories/instruments",
    "https://www.trycare.co.uk/categories/orthodontics",
    "https://www.trycare.co.uk/categories/preventive",
    "https://www.trycare.co.uk/categories/diagnostics",
    "https://www.trycare.co.uk/products",
  ];
  for (const url of catUrls) {
    try {
      console.log(`  Trycare: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await delay(3000);

      // Check JSON-LD first
      const ldProducts = await page.evaluate(() => {
        const results: any[] = [];
        document.querySelectorAll('script[type="application/ld+json"]').forEach((s: any) => {
          try {
            const d = JSON.parse(s.textContent);
            const items = d?.itemListElement ?? d?.["@graph"] ?? (Array.isArray(d) ? d : [d]);
            items.forEach((it: any) => {
              if (it["@type"] === "Product" || it.offers) {
                const img = Array.isArray(it.image) ? it.image[0] : it.image;
                if (img && it.name) results.push({
                  name: it.name,
                  image: img,
                  sku: it.sku || it.mpn || "",
                  brand: it.brand?.name || "",
                  desc: it.description || "",
                  price: parseFloat(it.offers?.price || 0) || 0,
                });
              }
            });
          } catch {}
        });
        return results;
      });

      if (ldProducts.length > 0) {
        for (const p of ldProducts) {
          if (products.find(x => x.name === p.name)) continue;
          products.push({
            name: p.name,
            brand: p.brand || "Trycare",
            sku: p.sku,
            image: p.image,
            description: p.desc?.slice(0, 300) || `${p.name} — available from Trycare.`,
            packSize: "1 unit",
            price: p.price,
            sourceUrl: url,
          });
          console.log(`    ✅ ${p.name.slice(0, 60)}`);
        }
        await delay(1000);
        continue;
      }

      // DOM fallback
      const items = await page.evaluate(() => {
        const results: any[] = [];
        document.querySelectorAll(".product-item, .product-card, [class*='product'], article").forEach((el: any) => {
          const nameEl = el.querySelector("h2, h3, h4, [class*='name'], [class*='title']");
          const imgEl = el.querySelector("img");
          const priceEl = el.querySelector("[class*='price']");
          const brandEl = el.querySelector("[class*='brand']");
          const name = nameEl?.textContent?.trim() ?? "";
          const image = imgEl?.src || imgEl?.getAttribute("data-src") || "";
          const price = parseFloat((priceEl?.textContent ?? "").replace(/[^0-9.]/g, "")) || 0;
          const brand = brandEl?.textContent?.trim() ?? "";
          if (name.length > 5 && image.includes("http")) {
            results.push({ name, image, price, brand });
          }
        });
        return results;
      });

      for (const item of items) {
        if (products.find(p => p.name === item.name)) continue;
        products.push({
          name: item.name,
          brand: item.brand || "Trycare",
          sku: "",
          image: item.image,
          description: `${item.name} — available from Trycare dental supplies.`,
          packSize: "1 unit",
          price: item.price,
          sourceUrl: url,
        });
        console.log(`    ✅ ${item.name.slice(0, 60)}`);
      }
      await delay(1500);
    } catch (e: any) {
      console.log(`  Trycare error: ${e.message?.slice(0, 80)}`);
    }
    if (products.length >= 300) break;
  }
  return products;
}

// ─── Kent Express ─────────────────────────────────────────────────────────────
async function scrapeKentExpress(page: any): Promise<Product[]> {
  const products: Product[] = [];
  const urls = [
    "https://www.kentexpress.co.uk/dental-supplies/categories/gloves",
    "https://www.kentexpress.co.uk/dental-supplies/categories/infection-control",
    "https://www.kentexpress.co.uk/dental-supplies/categories/anaesthetics",
    "https://www.kentexpress.co.uk/dental-supplies/categories/composites",
    "https://www.kentexpress.co.uk/dental-supplies/categories/endo",
    "https://www.kentexpress.co.uk/dental-supplies/categories/impression",
    "https://www.kentexpress.co.uk/dental-supplies/categories/instruments",
    "https://www.kentexpress.co.uk/dental-supplies/categories/orthodontics",
    "https://www.kentexpress.co.uk/dental-supplies/categories/preventive",
    "https://www.kentexpress.co.uk/dental-supplies",
  ];
  for (const url of urls) {
    try {
      console.log(`  Kent Express: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await delay(4000);

      const items = await page.evaluate(() => {
        const results: any[] = [];
        // Kent Express may use various patterns
        const selectors = [
          ".product-item", ".product-card", "[class*='ProductCard']",
          "[class*='product-tile']", "[data-product-id]", "article"
        ];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length < 2) continue;
          els.forEach((el: any) => {
            const nameEl = el.querySelector("h2, h3, h4, [class*='name'], [class*='title']");
            const imgEl = el.querySelector("img");
            const priceEl = el.querySelector("[class*='price'], .price");
            const brandEl = el.querySelector("[class*='brand'], .brand");
            const name = nameEl?.textContent?.trim() ?? "";
            let image = imgEl?.src || imgEl?.getAttribute("data-src") || imgEl?.getAttribute("data-lazy") || "";
            if (image.startsWith("/")) image = "https://www.kentexpress.co.uk" + image;
            const price = parseFloat((priceEl?.textContent ?? "").replace(/[^0-9.]/g, "")) || 0;
            const brand = brandEl?.textContent?.trim() ?? "";
            if (name.length > 5 && image.includes("http")) {
              results.push({ name, image, price, brand });
            }
          });
          if (results.length > 0) break;
        }
        return results;
      });

      for (const item of items) {
        if (products.find(p => p.name === item.name)) continue;
        products.push({
          name: item.name,
          brand: item.brand || "Kent Express",
          sku: "",
          image: item.image,
          description: `${item.name} — available from Kent Express.`,
          packSize: "1 unit",
          price: item.price,
          sourceUrl: url,
        });
        console.log(`    ✅ ${item.name.slice(0, 60)}`);
      }
      await delay(1500);
    } catch (e: any) {
      console.log(`  Kent Express error: ${e.message?.slice(0, 80)}`);
    }
    if (products.length >= 200) break;
  }
  return products;
}

// ─── Dental Sky (via sitemap/category pages - not REST API) ──────────────────
async function scrapeDentalSky(page: any): Promise<Product[]> {
  const products: Product[] = [];
  const urls = [
    "https://www.dentalsky.com/gloves.html",
    "https://www.dentalsky.com/infection-control.html",
    "https://www.dentalsky.com/anaesthetics.html",
    "https://www.dentalsky.com/composites.html",
    "https://www.dentalsky.com/endodontics.html",
    "https://www.dentalsky.com/impression-materials.html",
    "https://www.dentalsky.com/instruments.html",
    "https://www.dentalsky.com/orthodontics.html",
    "https://www.dentalsky.com/preventive.html",
    "https://www.dentalsky.com/dental-consumables.html",
  ];
  for (const url of urls) {
    try {
      console.log(`  Dental Sky: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await delay(3000);

      const items = await page.evaluate(() => {
        const results: any[] = [];
        // Magento product list
        document.querySelectorAll(".product-item, .item.product, [class*='product-item-info']").forEach((el: any) => {
          const nameEl = el.querySelector(".product-item-name, .product-name, h2, h3");
          const imgEl = el.querySelector("img.product-image-photo, img");
          const priceEl = el.querySelector(".price, [class*='price']");
          const name = nameEl?.textContent?.trim() ?? "";
          let image = imgEl?.src || imgEl?.getAttribute("data-src") || "";
          if (image.includes("placeholder") || image.includes("data:")) image = "";
          const price = parseFloat((priceEl?.textContent ?? "").replace(/[^0-9.]/g, "")) || 0;
          if (name.length > 5 && image.includes("http")) {
            results.push({ name, image, price });
          }
        });
        return results;
      });

      for (const item of items) {
        if (products.find(p => p.name === item.name)) continue;
        products.push({
          name: item.name,
          brand: "Dental Sky",
          sku: "",
          image: item.image,
          description: `${item.name} — available from Dental Sky.`,
          packSize: "1 unit",
          price: item.price,
          sourceUrl: url,
        });
        console.log(`    ✅ ${item.name.slice(0, 60)}`);
      }
      await delay(1500);
    } catch (e: any) {
      console.log(`  Dental Sky error: ${e.message?.slice(0, 80)}`);
    }
    if (products.length >= 200) break;
  }
  return products;
}

async function main() {
  let existing: Product[] = [];
  if (fs.existsSync(PROGRESS_PATH)) {
    existing = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
    console.log(`Resuming with ${existing.length} already scraped`);
  }

  const { data: existingProds } = await supabase.from("dentago_products").select("id").order("id", { ascending: false }).limit(1);
  let nextId = (existingProds?.[0]?.id ?? 100) + 1;
  console.log(`Starting ID: ${nextId}`);

  const { data: suppliers } = await supabase.from("dentago_suppliers").select("id, name");
  const hsId = suppliers?.find((s: any) => s.name.toLowerCase().includes("henry"))?.id;
  console.log(`Henry Schein supplier ID: ${hsId}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const allProducts: Product[] = [...existing];
  const existingNames = new Set(existing.map((p: Product) => p.name.toLowerCase().slice(0, 40)));

  // Scrape each source
  const scrapers = [
    { name: "Dental Sky", fn: () => scrapeDentalSky(page) },
    { name: "Trycare", fn: () => scrapeTrycare(page) },
    { name: "Kent Express", fn: () => scrapeKentExpress(page) },
    { name: "GC Europe", fn: () => scrapeGC(page) },
    { name: "Septodont", fn: () => scrapeSepto(page) },
    { name: "Voco", fn: () => scrapeVoco(page) },
  ];

  for (const { name, fn } of scrapers) {
    if (allProducts.length >= 1000) break;
    console.log(`\n\n═══ ${name} ═══`);
    try {
      const items = await fn();
      let added = 0;
      for (const item of items) {
        const key = item.name.toLowerCase().slice(0, 40);
        if (existingNames.has(key) || !item.image || item.name.length < 5) continue;
        existingNames.add(key);
        allProducts.push(item);
        added++;
      }
      console.log(`  → Added ${added} new products (total: ${allProducts.length})`);
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(allProducts, null, 2));
    } catch (e: any) {
      console.log(`  ${name} failed: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\n\n📦 Total products collected: ${allProducts.length}`);

  // Seed to Supabase
  console.log(`💾 Seeding to Supabase...`);
  let seeded = 0;

  for (const p of allProducts.slice(0, 1000)) {
    if (!p.name || !p.image) continue;
    const category = mapCategory(p.name, p.description);

    const { error } = await supabase.from("dentago_products").upsert({
      id: nextId,
      name: p.name,
      brand: p.brand || "Henry Schein",
      category,
      image: p.image,
      pack_size: p.packSize || "1 unit",
      description: p.description || `${p.name} — professional dental supply.`,
      specs: JSON.stringify([
        { label: "SKU", value: p.sku || `MFR-${nextId}` },
        { label: "Supplier", value: p.brand || "Henry Schein" },
        { label: "Category", value: category },
      ]),
      similars: JSON.stringify([]),
    }, { onConflict: "id" });

    if (!error && hsId) {
      await supabase.from("dentago_supplier_products").upsert({
        product_id: nextId,
        supplier_id: hsId,
        price: p.price || 0,
        stock: true,
        delivery: "1-2 working days",
        sku: p.sku || `MFR-${nextId}`,
        pack_size: p.packSize || "1 unit",
      }, { onConflict: "product_id,supplier_id" });
      console.log(`  ✅ [${nextId}] ${p.name.slice(0, 60)}`);
      seeded++;
      nextId++;
    } else if (error) {
      console.error(`  ❌ [${nextId}] ${error.message}`);
    }
  }

  console.log(`\n🎉 ${seeded} products seeded to database`);
}

main().catch(console.error);
