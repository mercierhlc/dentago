import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PROGRESS_PATH = path.join(process.env.HOME!, "Downloads", "hs-scrape-progress.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Map HS categories to Dentago categories
const CATEGORY_MAP: Record<string, string> = {
  "gloves": "PPE",
  "masks": "PPE",
  "ppe": "PPE",
  "infection": "Infection Control",
  "sterilisation": "Infection Control",
  "disinfect": "Infection Control",
  "anaesth": "Anaesthetics",
  "injection": "Anaesthetics",
  "composite": "Composites",
  "bonding": "Composites",
  "resin": "Composites",
  "endo": "Endodontics",
  "file": "Endodontics",
  "implant": "Implants",
  "orthodont": "Orthodontics",
  "brace": "Orthodontics",
  "instrument": "Instruments",
  "forcep": "Instruments",
  "scaler": "Instruments",
  "impression": "Impression Materials",
  "alginate": "Impression Materials",
  "xray": "Diagnostics",
  "x-ray": "Diagnostics",
  "radiograph": "Diagnostics",
};

function mapCategory(name: string, hsCategory: string): string {
  const combined = (name + " " + hsCategory).toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (combined.includes(key)) return val;
  }
  return "Consumables";
}

// Henry Schein category URLs that are publicly browsable
const HS_CATEGORIES = [
  { url: "https://www.henryschein.co.uk/dental/Products/Gloves/c/DEN_GLOVES", name: "Gloves" },
  { url: "https://www.henryschein.co.uk/dental/Products/Masks-and-Respirators/c/DEN_MASKS", name: "Masks" },
  { url: "https://www.henryschein.co.uk/dental/Products/Infection-Control/c/DEN_INFEC", name: "Infection Control" },
  { url: "https://www.henryschein.co.uk/dental/Products/Anaesthetics/c/DEN_ANAES", name: "Anaesthetics" },
  { url: "https://www.henryschein.co.uk/dental/Products/Composites-and-Restoratives/c/DEN_COMP", name: "Composites" },
  { url: "https://www.henryschein.co.uk/dental/Products/Endodontics/c/DEN_ENDO", name: "Endodontics" },
  { url: "https://www.henryschein.co.uk/dental/Products/Implants/c/DEN_IMPL", name: "Implants" },
  { url: "https://www.henryschein.co.uk/dental/Products/Impression-Materials/c/DEN_IMPR", name: "Impression Materials" },
  { url: "https://www.henryschein.co.uk/dental/Products/Hand-Instruments/c/DEN_INSTR", name: "Instruments" },
  { url: "https://www.henryschein.co.uk/dental/Products/Orthodontics/c/DEN_ORTHO", name: "Orthodontics" },
  { url: "https://www.henryschein.co.uk/dental/Products/Preventive/c/DEN_PREV", name: "Preventive" },
  { url: "https://www.henryschein.co.uk/dental/Products/Diagnostics/c/DEN_DIAG", name: "Diagnostics" },
];

interface ScrapedProduct {
  name: string;
  brand: string;
  sku: string;
  image: string;
  category: string;
  packSize: string;
  url: string;
}

async function scrapeCategory(page: Page, catUrl: string, catName: string): Promise<ScrapedProduct[]> {
  const products: ScrapedProduct[] = [];
  let pageNum = 1;
  const MAX_PAGES = 5; // up to 5 pages per category

  while (pageNum <= MAX_PAGES && products.length < 100) {
    const url = pageNum === 1 ? catUrl : `${catUrl}?page=${pageNum}`;
    console.log(`  Page ${pageNum}: ${url}`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(5000);

      // Try to find products in the rendered HTML
      const scraped = await page.evaluate((category: string) => {
        const results: ScrapedProduct[] = [];

        // Look for product tiles/cards - HS uses various class patterns
        const selectors = [
          "[class*='product-tile']",
          "[class*='product-card']",
          "[class*='product-item']",
          "[data-product-id]",
          "[class*='ProductTile']",
          "app-product-tile",
          "app-product-card",
        ];

        for (const sel of selectors) {
          const tiles = document.querySelectorAll(sel);
          if (tiles.length > 0) {
            tiles.forEach((tile) => {
              const nameEl = tile.querySelector("[class*='name'], [class*='title'], h2, h3, h4");
              const brandEl = tile.querySelector("[class*='brand'], [class*='manufacturer']");
              const skuEl = tile.querySelector("[class*='sku'], [data-sku], [class*='item-number']");
              const imgEl = tile.querySelector("img");

              const name = nameEl?.textContent?.trim() ?? "";
              const brand = brandEl?.textContent?.trim() ?? "";
              const sku = skuEl?.textContent?.trim() ?? skuEl?.getAttribute("data-sku") ?? "";
              const image = imgEl?.getAttribute("src") ?? imgEl?.getAttribute("data-src") ?? "";

              if (name.length > 5 && image.includes("http")) {
                results.push({ name, brand, sku, image, category, packSize: "", url: window.location.href });
              }
            });
            if (results.length > 0) break;
          }
        }

        // Fallback: extract from JSON-LD or structured data
        if (results.length === 0) {
          document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
            try {
              const data = JSON.parse(el.textContent ?? "");
              const items = data["@graph"] ?? (Array.isArray(data) ? data : [data]);
              items.forEach((item: any) => {
                if (item["@type"] === "Product" || item.offers) {
                  results.push({
                    name: item.name ?? "",
                    brand: item.brand?.name ?? item.manufacturer ?? "",
                    sku: item.sku ?? item.mpn ?? "",
                    image: item.image ?? (Array.isArray(item.image) ? item.image[0] : ""),
                    category,
                    packSize: "",
                    url: window.location.href,
                  });
                }
              });
            } catch {}
          });
        }

        return results;
      }, catName);

      if (scraped.length === 0) {
        console.log(`    No products found on page ${pageNum} — stopping category`);
        break;
      }

      console.log(`    Found ${scraped.length} products`);
      products.push(...scraped);
      pageNum++;
      await delay(1500);
    } catch (e: any) {
      console.log(`    Error on page ${pageNum}: ${e.message}`);
      break;
    }
  }

  return products;
}

async function main() {
  // Load progress
  let allProducts: ScrapedProduct[] = [];
  if (fs.existsSync(PROGRESS_PATH)) {
    allProducts = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
    console.log(`📋 Resuming — ${allProducts.length} products already scraped`);
  }

  const { data: existingProducts } = await supabase
    .from("dentago_products")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);

  let nextId = (existingProducts?.[0]?.id ?? 100) + 1;
  console.log(`🆔 Starting product ID: ${nextId}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Set realistic headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  });

  for (const cat of HS_CATEGORIES) {
    const alreadyDone = allProducts.filter(p => p.category === cat.name).length;
    if (alreadyDone >= 50) {
      console.log(`\n⏭  Skipping ${cat.name} (already have ${alreadyDone})`);
      continue;
    }

    console.log(`\n📦 Scraping: ${cat.name}`);
    const products = await scrapeCategory(page, cat.url, cat.name);
    allProducts.push(...products);
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(allProducts, null, 2));
    console.log(`  Total so far: ${allProducts.length}`);
    await delay(2000);
  }

  await browser.close();

  // Deduplicate by name
  const seen = new Set<string>();
  const unique = allProducts.filter(p => {
    const key = p.name.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return p.name.length > 5 && p.image.length > 10;
  });

  console.log(`\n✅ ${unique.length} unique products scraped. Seeding to database...`);

  // Get supplier IDs
  const { data: suppliers } = await supabase.from("dentago_suppliers").select("id, name");
  const hsId = suppliers?.find(s => s.name.toLowerCase().includes("henry"))?.id;
  if (!hsId) { console.error("Henry Schein supplier not found in DB"); process.exit(1); }

  let seeded = 0;
  for (const p of unique.slice(0, 1000)) {
    const dentaCategory = mapCategory(p.name, p.category);

    const { error } = await supabase.from("dentago_products").upsert({
      id: nextId,
      name: p.name,
      brand: p.brand || "Henry Schein",
      category: dentaCategory,
      image: p.image,
      pack_size: p.packSize || "1 unit",
      description: `${p.name} — sourced from Henry Schein UK dental catalogue.`,
      specs: JSON.stringify([
        { label: "SKU", value: p.sku || `HS-${nextId}` },
        { label: "Supplier", value: "Henry Schein" },
        { label: "Category", value: dentaCategory },
      ]),
      similars: JSON.stringify([]),
    }, { onConflict: "id" });

    if (!error) {
      // Add supplier pricing row
      await supabase.from("dentago_supplier_products").upsert({
        product_id: nextId,
        supplier_id: hsId,
        price: 0, // price requires login — placeholder
        stock: true,
        delivery: "1-2 working days",
        sku: p.sku || `HS-${nextId}`,
        pack_size: p.packSize || "1 unit",
      }, { onConflict: "product_id,supplier_id" });

      console.log(`  ✅ [${nextId}] ${p.name.slice(0, 60)}`);
      seeded++;
      nextId++;
    } else {
      console.error(`  ❌ [${nextId}] ${error.message}`);
    }
  }

  console.log(`\n🎉 Done — ${seeded} products seeded to database`);
}

main().catch(console.error);
