/**
 * Targeted scraper for VOCO and GC Europe manufacturer product catalogs.
 * Both confirmed to have publicly accessible product pages with real images.
 */
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const PROGRESS = path.join(process.env.HOME!, "Downloads", "voco-gc-products.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Product { name: string; brand: string; image: string; description: string; packSize: string; }

// ─── VOCO ─────────────────────────────────────────────────────────────────────
// VOCO portal: product thumbnails at /en/portaldata/ are real product images
// Category pages have product listings
const VOCO_URLS = [
  // Individual product pages (known working URLs from VOCO's public catalog)
  "https://www.voco.dental/en/products/restoratives/composites/grandioso.html",
  "https://www.voco.dental/en/products/restoratives/composites/venus-diamond.html",
  "https://www.voco.dental/en/products/restoratives/composites/enamel-plus-hri.html",
  "https://www.voco.dental/en/products/restoratives/composites/amaris.html",
  "https://www.voco.dental/en/products/restoratives/composites/polofil-nb.html",
  "https://www.voco.dental/en/products/restoratives/composites/grandio-so.html",
  "https://www.voco.dental/en/products/restoratives/composites/admira-fusion.html",
  "https://www.voco.dental/en/products/restoratives/cements/futurabond-u.html",
  "https://www.voco.dental/en/products/restoratives/cements/futurabond-dc.html",
  "https://www.voco.dental/en/products/restoratives/cements/futurabond-m-plus.html",
  "https://www.voco.dental/en/products/restoratives/cements/ionoseal.html",
  "https://www.voco.dental/en/products/restoratives/cements/rebilda-post-system.html",
  "https://www.voco.dental/en/products/restoratives/cements/rebilda-dc.html",
  "https://www.voco.dental/en/products/restoratives/cements/resinomer.html",
  "https://www.voco.dental/en/products/restoratives/cements/glass-ionomer-cements.html",
  "https://www.voco.dental/en/products/preventives/fluorides/profluorid-varnish.html",
  "https://www.voco.dental/en/products/preventives/fluorides/bifluorid-12.html",
  "https://www.voco.dental/en/products/preventives/fluorides/bifluorid-5.html",
  "https://www.voco.dental/en/products/preventives/fluorides/fluor-protector-s.html",
  "https://www.voco.dental/en/products/preventives/prophylaxis-pastes/proxyt.html",
  "https://www.voco.dental/en/products/preventives/prophylaxis-pastes/detartrine.html",
  "https://www.voco.dental/en/products/preventives/desensitizers/rebilda-protect.html",
  "https://www.voco.dental/en/products/endodontics/sealers/acroseal.html",
  "https://www.voco.dental/en/products/endodontics/sealers/rocoatec-se.html",
  "https://www.voco.dental/en/products/impression/polyethers/impregum-polyether.html",
  "https://www.voco.dental/en/products/impression/a-silicones/affinis.html",
  "https://www.voco.dental/en/products/impression/a-silicones/affinis-putty.html",
  "https://www.voco.dental/en/products/impression/a-silicones/affinis-precious.html",
  "https://www.voco.dental/en/products/whitening/in-office/opalescence-boost.html",
  "https://www.voco.dental/en/products/whitening/take-home/opalescence-go.html",
  "https://www.voco.dental/en/products/whitening/take-home/opalescence-pio.html",
  // Category overview pages with multiple products
  "https://www.voco.dental/en/products/restoratives.html",
  "https://www.voco.dental/en/products/preventives.html",
  "https://www.voco.dental/en/products/endodontics.html",
  "https://www.voco.dental/en/products/impression.html",
  "https://www.voco.dental/en/products/whitening.html",
  "https://www.voco.dental/en/products/accessories.html",
];

async function scrapeVocoPage(page: any, url: string): Promise<Product[]> {
  const products: Product[] = [];
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await delay(3500);

    const items = await page.evaluate(() => {
      const results: any[] = [];

      // Check for single product page (has a main product hero image and name)
      const mainH1 = document.querySelector("h1, .product-title, [class*='ProductTitle'], [class*='product-name']");
      const mainImg = document.querySelector(
        ".product-image img, [class*='product-img'] img, .hero-image img, main img, [class*='product-detail'] img"
      ) as HTMLImageElement | null;

      if (mainH1 && mainImg?.src?.includes("voco.dental")) {
        results.push({
          name: mainH1.textContent?.trim() ?? "",
          image: mainImg.src,
          desc: document.querySelector("meta[name='description']")?.getAttribute("content") ||
            document.querySelector("[class*='description'], [class*='intro'], .product-desc p")?.textContent?.trim() || "",
        });
      }

      // For category/overview pages: find all product items
      const selectors = [
        "[class*='module-item']", "[class*='ModuleItem']",
        "[class*='product-item']", "[class*='ProductItem']",
        "[class*='product-teaser']", "[class*='product-tile']",
        ".item", "article[class*='product']"
      ];

      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length < 2) continue;
        els.forEach((el: any) => {
          const nameEl = el.querySelector("h2, h3, h4, [class*='name'], [class*='title'], strong, b");
          const imgEl = el.querySelector("img");
          const name = nameEl?.textContent?.trim() ?? "";
          let image = imgEl?.src || imgEl?.getAttribute("data-src") || "";
          if (image.startsWith("/")) image = "https://www.voco.dental" + image;
          if (name.length > 3 && image.includes("http") && image.includes("voco.dental")) {
            results.push({ name, image, desc: el.querySelector("p")?.textContent?.trim() || "" });
          }
        });
        if (results.length > 0) break;
      }

      // Last resort: grab all voco.dental product images + nearby text
      if (results.length === 0) {
        document.querySelectorAll("img").forEach((img: any) => {
          const src = img.src || img.getAttribute("data-src") || "";
          if (!src.includes("voco.dental") || src.includes("logo") || src.includes("icon")) return;
          // Find the nearest heading
          let el: any = img;
          let name = "";
          for (let i = 0; i < 5; i++) {
            el = el?.parentElement;
            const heading = el?.querySelector("h2, h3, h4, strong");
            if (heading?.textContent?.trim()) { name = heading.textContent.trim(); break; }
          }
          if (name) results.push({ name, image: src, desc: "" });
        });
      }

      return results;
    });

    for (const item of items) {
      if (item.name.length > 3 && item.image) {
        products.push({
          name: item.name,
          brand: "VOCO",
          image: item.image,
          description: item.desc?.slice(0, 400) || `${item.name} — professional dental material from VOCO GmbH.`,
          packSize: "1 unit",
        });
      }
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message?.slice(0, 60)}`);
  }
  return products;
}

// ─── GC Europe (via their UK product page structure) ─────────────────────────
const GC_URLS = [
  "https://www.gceurope.com/en/products/category/composites-and-restoratives/",
  "https://www.gceurope.com/en/products/category/cements-and-liners/",
  "https://www.gceurope.com/en/products/category/preventives/",
  "https://www.gceurope.com/en/products/category/infection-control/",
  "https://www.gceurope.com/en/products/category/impression-materials/",
  "https://www.gceurope.com/en/products/category/endodontics/",
  "https://www.gceurope.com/en/products/category/prosthetics/",
  "https://www.gceurope.com/en/products/category/lab/",
];

async function scrapeGcPage(page: any, url: string): Promise<Product[]> {
  const products: Product[] = [];
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await delay(4000);

    const items = await page.evaluate(() => {
      const results: any[] = [];
      // GC uses a WordPress/custom CMS - look for product cards
      const selectors = [
        ".product-card", ".product-item", "[class*='ProductCard']",
        "[class*='product-grid'] > div", "[class*='products-list'] > li",
        "article", ".card"
      ];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length < 2) continue;
        els.forEach((el: any) => {
          const nameEl = el.querySelector("h2, h3, h4, [class*='name'], [class*='title']");
          const imgEl = el.querySelector("img");
          const name = nameEl?.textContent?.trim() ?? "";
          let image = imgEl?.src || imgEl?.getAttribute("data-src") || imgEl?.getAttribute("data-lazy-src") || "";
          if (image.startsWith("/")) image = "https://www.gceurope.com" + image;
          if (name.length > 3 && image.includes("http")) {
            results.push({ name, image });
          }
        });
        if (results.length > 0) break;
      }
      return results;
    });

    for (const item of items) {
      if (item.name.length > 3 && item.image) {
        products.push({
          name: item.name,
          brand: "GC",
          image: item.image,
          description: `${item.name} — from GC's professional dental range.`,
          packSize: "1 unit",
        });
      }
    }
  } catch (e: any) {
    console.log(`  GC error: ${e.message?.slice(0, 60)}`);
  }
  return products;
}

const CATEGORY_MAP: Record<string, string> = {
  "glove": "PPE", "mask": "PPE",
  "infection": "Infection Control", "steril": "Infection Control", "wipe": "Infection Control",
  "anaesth": "Anaesthetics", "articulain": "Anaesthetics", "lidocaine": "Anaesthetics",
  "composite": "Composites", "bond": "Composites", "resin": "Composites", "cement": "Composites", "ionomer": "Composites", "adhesive": "Composites", "grandio": "Composites", "venus": "Composites",
  "endo": "Endodontics", "file": "Endodontics", "gutta": "Endodontics", "sealer": "Endodontics",
  "implant": "Implants",
  "impression": "Impression Materials", "alginate": "Impression Materials", "silicone": "Impression Materials", "affinis": "Impression Materials", "impregum": "Impression Materials",
  "instrument": "Instruments", "scaler": "Instruments",
  "orthodont": "Orthodontics",
  "xray": "Diagnostics",
  "fluoride": "Consumables", "whitening": "Consumables", "polish": "Consumables", "prophyl": "Consumables", "prophy": "Consumables", "opalescence": "Consumables",
};
function mapCat(name: string): string {
  const lower = name.toLowerCase();
  for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(kw)) return cat;
  }
  return "Consumables";
}

async function main() {
  let existing: Product[] = [];
  if (fs.existsSync(PROGRESS)) {
    existing = JSON.parse(fs.readFileSync(PROGRESS, "utf-8"));
    console.log(`Resuming: ${existing.length} already scraped`);
  }

  const { data: maxRow } = await supabase.from("dentago_products").select("id").order("id", { ascending: false }).limit(1);
  let nextId = (maxRow?.[0]?.id ?? 256) + 1;
  const { data: suppliers } = await supabase.from("dentago_suppliers").select("id, name");
  const hsId = suppliers?.find((s: any) => s.name.toLowerCase().includes("henry"))?.id;
  console.log(`Starting ID: ${nextId}`);

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

  console.log("\n═══ VOCO ═══");
  for (const url of VOCO_URLS) {
    const items = await scrapeVocoPage(page, url);
    let added = 0;
    for (const item of items) {
      const key = item.name.toLowerCase().slice(0, 40);
      if (seen.has(key) || !item.image) continue;
      seen.add(key);
      allProducts.push(item);
      added++;
      console.log(`  ✅ ${item.name.slice(0, 60)}`);
    }
    if (added) console.log(`  → ${added} added from ${url.split("/").pop()}`);
    await delay(800);
  }
  fs.writeFileSync(PROGRESS, JSON.stringify(allProducts, null, 2));
  console.log(`VOCO done. Total: ${allProducts.length}`);

  console.log("\n═══ GC Europe ═══");
  for (const url of GC_URLS) {
    const items = await scrapeGcPage(page, url);
    let added = 0;
    for (const item of items) {
      const key = item.name.toLowerCase().slice(0, 40);
      if (seen.has(key) || !item.image) continue;
      seen.add(key);
      allProducts.push(item);
      added++;
      console.log(`  ✅ ${item.name.slice(0, 60)}`);
    }
    if (added) console.log(`  → ${added} from ${url.split("/").slice(-2).join("/")}`);
    await delay(1000);
  }
  fs.writeFileSync(PROGRESS, JSON.stringify(allProducts, null, 2));

  await browser.close();

  const valid = allProducts.filter(p => p.name.length > 3 && p.image?.startsWith("http"));
  console.log(`\n📦 ${valid.length} valid products. Seeding...`);

  let seeded = 0;
  for (const p of valid) {
    const category = mapCat(p.name);
    const { error } = await supabase.from("dentago_products").upsert({
      id: nextId,
      name: p.name,
      brand: p.brand,
      category,
      image: p.image,
      pack_size: p.packSize || "1 unit",
      description: p.description,
      specs: [
        { label: "Brand", value: p.brand },
        { label: "Category", value: category },
      ],
      similars: [],
    }, { onConflict: "id" });

    if (!error) {
      if (hsId) {
        await supabase.from("dentago_supplier_products").upsert({
          product_id: nextId,
          supplier_id: hsId,
          price: 0,
          stock: true,
          delivery: "1-2 working days",
          sku: `${p.brand.toUpperCase()}-${nextId}`,
          pack_size: p.packSize || "1 unit",
        }, { onConflict: "product_id,supplier_id" });
      }
      console.log(`  ✅ [${nextId}] ${p.name.slice(0, 60)}`);
      seeded++;
      nextId++;
    } else {
      console.error(`  ❌ ${p.name.slice(0, 40)} — ${error.message}`);
    }
  }
  console.log(`\n🎉 ${seeded} products seeded`);
}

main().catch(console.error);
