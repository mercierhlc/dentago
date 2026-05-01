import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const PROGRESS_PATH = path.join(process.env.HOME!, "Downloads", "ds-voco-products.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const CATEGORY_MAP: Record<string, string> = {
  "glove": "PPE", "mask": "PPE", "ppe": "PPE", "apron": "PPE",
  "infection": "Infection Control", "disinfect": "Infection Control", "steril": "Infection Control", "wipe": "Infection Control", "autoclave": "Infection Control", "pouch": "Infection Control",
  "anaesth": "Anaesthetics", "cartridge": "Anaesthetics", "needle": "Anaesthetics", "articaine": "Anaesthetics", "lidocaine": "Anaesthetics",
  "composite": "Composites", "bond": "Composites", "resin": "Composites", "cement": "Composites", "ionomer": "Composites", "adhesive": "Composites",
  "endo": "Endodontics", "file": "Endodontics", "gutta": "Endodontics", "sealer": "Endodontics", "apex": "Endodontics",
  "implant": "Implants", "abutment": "Implants",
  "impression": "Impression Materials", "alginate": "Impression Materials", "silicone": "Impression Materials", "putty": "Impression Materials",
  "instrument": "Instruments", "forcep": "Instruments", "probe": "Instruments", "mirror": "Instruments", "scaler": "Instruments", "curette": "Instruments",
  "orthodont": "Orthodontics", "bracket": "Orthodontics", "archwire": "Orthodontics",
  "xray": "Diagnostics", "x-ray": "Diagnostics", "sensor": "Diagnostics",
  "fluoride": "Consumables", "whitening": "Consumables", "polish": "Consumables", "prophyl": "Consumables",
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
  url: string;
}

// ─── Dental Sky ───────────────────────────────────────────────────────────────
// Category pages have LD+JSON with ItemList or Product data
const DS_CATEGORIES = [
  "https://www.dentalsky.com/gloves.html",
  "https://www.dentalsky.com/face-masks.html",
  "https://www.dentalsky.com/infection-control.html",
  "https://www.dentalsky.com/anaesthetics.html",
  "https://www.dentalsky.com/composites.html",
  "https://www.dentalsky.com/endodontics.html",
  "https://www.dentalsky.com/impression-materials.html",
  "https://www.dentalsky.com/hand-instruments.html",
  "https://www.dentalsky.com/preventive.html",
  "https://www.dentalsky.com/orthodontics.html",
  "https://www.dentalsky.com/radiography.html",
  "https://www.dentalsky.com/dental-consumables.html",
  "https://www.dentalsky.com/disposables.html",
  "https://www.dentalsky.com/sterilisation.html",
  "https://www.dentalsky.com/cements-liners-bases.html",
  "https://www.dentalsky.com/teeth-whitening.html",
  // Page 2s for bigger categories
  "https://www.dentalsky.com/gloves.html?p=2",
  "https://www.dentalsky.com/gloves.html?p=3",
  "https://www.dentalsky.com/infection-control.html?p=2",
  "https://www.dentalsky.com/composites.html?p=2",
  "https://www.dentalsky.com/endodontics.html?p=2",
  "https://www.dentalsky.com/dental-consumables.html?p=2",
  "https://www.dentalsky.com/dental-consumables.html?p=3",
];

async function scrapeDentalSkyCategory(page: any, url: string): Promise<Product[]> {
  const products: Product[] = [];
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await delay(6000);

    const extracted = await page.evaluate(() => {
      const results: any[] = [];

      // Method 1: LD+JSON ItemList or individual Product schemas
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s: any) => {
        try {
          const d = JSON.parse(s.textContent);
          // ItemList format
          if (d.itemListElement) {
            d.itemListElement.forEach((item: any) => {
              const p = item.item || item;
              if (p.name && (p.image || p["@type"] === "Product")) {
                const img = Array.isArray(p.image) ? p.image[0] : p.image;
                results.push({
                  name: p.name,
                  image: img || "",
                  sku: p.sku || p.mpn || "",
                  brand: p.brand?.name || "",
                  desc: p.description || "",
                  price: parseFloat(p.offers?.price || p.offers?.lowPrice || 0) || 0,
                  url: p.url || p["@id"] || "",
                });
              }
            });
          }
          // Direct Product
          if (d["@type"] === "Product" && d.name) {
            const img = Array.isArray(d.image) ? d.image[0] : d.image;
            results.push({
              name: d.name, image: img || "", sku: d.sku || "", brand: d.brand?.name || "",
              desc: d.description || "", price: parseFloat(d.offers?.price || 0) || 0, url: d.url || "",
            });
          }
          // @graph array
          if (Array.isArray(d["@graph"])) {
            d["@graph"].forEach((p: any) => {
              if (p["@type"] === "Product" && p.name) {
                const img = Array.isArray(p.image) ? p.image[0] : p.image;
                results.push({
                  name: p.name, image: img || "", sku: p.sku || "", brand: p.brand?.name || "",
                  desc: p.description || "", price: parseFloat(p.offers?.price || 0) || 0, url: p.url || "",
                });
              }
            });
          }
        } catch {}
      });

      // Method 2: Magento product listing DOM
      if (results.length === 0) {
        document.querySelectorAll(".product-item, .item.product.product-item").forEach((el: any) => {
          const nameEl = el.querySelector(".product-item-name a, .product-item-link");
          const imgEl = el.querySelector("img.product-image-photo");
          const priceEl = el.querySelector(".price");
          const name = nameEl?.textContent?.trim() ?? "";
          let image = imgEl?.src || imgEl?.getAttribute("data-src") || "";
          // Skip placeholder images
          if (image.includes("placeholder") || image.includes("cache/") || image === "") image = "";
          if (!image) {
            // Try data-src from lazy load
            const lazyImg = el.querySelector("img[data-src], img[data-lazy]");
            image = lazyImg?.getAttribute("data-src") || lazyImg?.getAttribute("data-lazy") || "";
          }
          const price = parseFloat((priceEl?.textContent ?? "").replace(/[^0-9.]/g, "")) || 0;
          const link = nameEl?.href || "";
          if (name.length > 3) {
            results.push({ name, image, sku: "", brand: "", desc: "", price, url: link });
          }
        });
      }

      // Method 3: Magento's mage-init data or x-magento-init script
      if (results.length === 0) {
        const productImages: Record<string, string> = {};
        document.querySelectorAll("[data-mage-init], script").forEach((el: any) => {
          try {
            const text = el.textContent || el.getAttribute("data-mage-init") || "";
            if (text.includes("catalog/product/image") || text.includes("productMedia")) {
              const matches = text.match(/"url"\s*:\s*"(https:[^"]+\.(jpg|png|webp))"/g);
              if (matches) matches.forEach((m: string) => {
                const url = m.match(/"(https:[^"]+)"/)?.[1];
                if (url) productImages[url] = url;
              });
            }
          } catch {}
        });

        // Also try to get product names from page heading/breadcrumb + images
        const headings = Array.from(document.querySelectorAll("h1, h2, .product-item-name")).map((h: any) => h.textContent?.trim()).filter(Boolean);
        const imgUrls = Object.values(productImages);
        headings.forEach((name: any, i: number) => {
          if (name && imgUrls[i]) results.push({ name, image: imgUrls[i], sku: "", brand: "", desc: "", price: 0, url: "" });
        });
      }

      return results;
    });

    for (const p of extracted) {
      if (!p.name || p.name.length < 3) continue;
      products.push({
        name: p.name,
        brand: p.brand || "Dental Sky",
        sku: p.sku,
        image: p.image,
        description: p.desc?.slice(0, 400) || `${p.name} — available from Dental Sky.`,
        packSize: "1 unit",
        price: p.price,
        url: p.url || url,
      });
    }
    console.log(`  ${url.split("/").pop()}: ${products.length} products`);
  } catch (e: any) {
    console.log(`  Error: ${e.message?.slice(0, 80)}`);
  }
  return products;
}

// ─── VOCO ─────────────────────────────────────────────────────────────────────
// VOCO has a product overview page with thumbnails and product names
const VOCO_PAGES = [
  "https://www.voco.dental/en/products/restoratives.html",
  "https://www.voco.dental/en/products/preventives.html",
  "https://www.voco.dental/en/products/endodontics.html",
  "https://www.voco.dental/en/products/impression.html",
  "https://www.voco.dental/en/products/accessories.html",
  "https://www.voco.dental/en/products/cements.html",
  "https://www.voco.dental/en/products/whitening.html",
];

async function scrapeVoco(page: any): Promise<Product[]> {
  const products: Product[] = [];
  for (const url of VOCO_PAGES) {
    try {
      console.log(`  VOCO: ${url.split("/").slice(-2).join("/")}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await delay(4000);

      const items = await page.evaluate(() => {
        const results: any[] = [];
        // VOCO uses a portal-style CMS with module items
        const selectors = [
          ".dn-module-item", ".module-item", "[class*='product-item']",
          "[class*='ProductItem']", ".item", "article",
          "[class*='product-teaser']", "[class*='product-tile']"
        ];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length < 2) continue;
          els.forEach((el: any) => {
            const nameEl = el.querySelector("h2, h3, h4, [class*='name'], [class*='title'], strong");
            const imgEl = el.querySelector("img");
            const name = nameEl?.textContent?.trim() ?? "";
            let image = imgEl?.src || imgEl?.getAttribute("data-src") || "";
            if (image.startsWith("/")) image = "https://www.voco.dental" + image;
            if (name.length > 3 && image.includes("http")) {
              results.push({ name, image });
            }
          });
          if (results.length > 0) break;
        }
        // Fallback: all images + headings on the page
        if (results.length === 0) {
          const imgs = Array.from(document.querySelectorAll("img"))
            .filter((img: any) => {
              const src = img.src || "";
              return src.includes("voco.dental") && (src.includes("portaldata") || src.includes("product") || src.includes("tn_"));
            })
            .map((img: any) => img.src);
          const headings = Array.from(document.querySelectorAll("h2, h3, h4"))
            .map((h: any) => h.textContent?.trim())
            .filter((t: string) => t && t.length > 3 && t.length < 80);
          // Pair them up
          imgs.forEach((img: string, i: number) => {
            if (headings[i]) results.push({ name: headings[i], image: img });
          });
        }
        return results;
      });

      for (const item of items) {
        if (products.find(p => p.name === item.name)) continue;
        products.push({
          name: item.name,
          brand: "VOCO",
          sku: "",
          image: item.image,
          description: `${item.name} — professional dental material from VOCO.`,
          packSize: "1 unit",
          price: 0,
          url,
        });
        console.log(`    ✅ ${item.name.slice(0, 60)}`);
      }
      await delay(1000);
    } catch (e: any) {
      console.log(`  VOCO error: ${e.message?.slice(0, 60)}`);
    }
  }
  return products;
}

async function main() {
  let existing: Product[] = [];
  if (fs.existsSync(PROGRESS_PATH)) {
    existing = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
    console.log(`Resuming: ${existing.length} already scraped`);
  }

  const { data: existingProds } = await supabase.from("dentago_products").select("id").order("id", { ascending: false }).limit(1);
  let nextId = (existingProds?.[0]?.id ?? 100) + 1;
  console.log(`Starting ID: ${nextId}`);

  const { data: suppliers } = await supabase.from("dentago_suppliers").select("id, name");
  const hsId = suppliers?.find((s: any) => s.name.toLowerCase().includes("henry"))?.id;

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  const allProducts = [...existing];
  const seen = new Set(existing.map((p: Product) => p.name.toLowerCase().slice(0, 40)));

  // ── Dental Sky ────────────────────────────────────────────────────
  console.log("\n═══ Dental Sky ═══");
  for (const catUrl of DS_CATEGORIES) {
    if (allProducts.length >= 700) break;
    console.log(`\n  ${catUrl.split("/").pop()}`);
    const items = await scrapeDentalSkyCategory(page, catUrl);
    let added = 0;
    for (const item of items) {
      const key = item.name.toLowerCase().slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      allProducts.push(item);
      added++;
    }
    console.log(`  → ${added} new (total: ${allProducts.length})`);
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(allProducts, null, 2));
    await delay(1000);
  }

  // ── VOCO ──────────────────────────────────────────────────────────
  console.log("\n\n═══ VOCO ═══");
  const vocoItems = await scrapeVoco(page);
  let vocoAdded = 0;
  for (const item of vocoItems) {
    const key = item.name.toLowerCase().slice(0, 40);
    if (seen.has(key) || !item.image) continue;
    seen.add(key);
    allProducts.push(item);
    vocoAdded++;
  }
  console.log(`VOCO: ${vocoAdded} added (total: ${allProducts.length})`);
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(allProducts, null, 2));

  await browser.close();

  // Filter: only keep products WITH images
  const withImages = allProducts.filter(p => p.image && p.image.startsWith("http") && p.name.length > 3);
  console.log(`\n\n📦 ${withImages.length} products with images. Seeding to Supabase...`);

  let seeded = 0;
  for (const p of withImages.slice(0, 1000)) {
    const category = mapCategory(p.name, p.description);
    const { error } = await supabase.from("dentago_products").upsert({
      id: nextId,
      name: p.name,
      brand: p.brand || "Dental Sky",
      category,
      image: p.image,
      pack_size: p.packSize || "1 unit",
      description: p.description || `${p.name} — professional dental supply.`,
      specs: [
        { label: "SKU", value: p.sku || `DS-${nextId}` },
        { label: "Supplier", value: p.brand || "Dental Sky" },
        { label: "Category", value: category },
      ],
      similars: [],
    }, { onConflict: "id" });

    if (!error && hsId) {
      await supabase.from("dentago_supplier_products").upsert({
        product_id: nextId,
        supplier_id: hsId,
        price: p.price || 0,
        stock: true,
        delivery: "1-2 working days",
        sku: p.sku || `DS-${nextId}`,
        pack_size: p.packSize || "1 unit",
      }, { onConflict: "product_id,supplier_id" });
      console.log(`  ✅ [${nextId}] ${p.name.slice(0, 60)}`);
      seeded++;
      nextId++;
    } else if (error) {
      console.error(`  ❌ ${error.message}`);
    }
  }

  console.log(`\n🎉 ${seeded} products seeded`);
}

main().catch(console.error);
