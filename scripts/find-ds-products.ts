/**
 * Finds Dental Sky individual product page URLs via Google search,
 * then scrapes each product page for LD+JSON data.
 * Individual product pages have server-side LD+JSON Product schemas.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const URLS_FILE = path.join(process.env.HOME!, "Downloads", "ds-product-urls.json");
const PRODUCTS_FILE = path.join(process.env.HOME!, "Downloads", "ds-found-products.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Dental product search terms to use in Google
const SEARCHES = [
  "nitrile gloves", "face mask type iir", "autoclave pouches",
  "articaine cartridge", "lidocaine cartridge", "topical anaesthetic",
  "composite resin kit", "glass ionomer cement", "dental bonding agent",
  "rotary endo file", "k file dental", "gutta percha points", "rubber dam",
  "alginate impression", "polyvinyl siloxane", "impression putty",
  "dental probe instrument", "dental scaler", "extraction forceps",
  "fluoride varnish", "prophy paste", "fissure sealant",
  "dental bur", "diamond bur", "polishing disc",
  "matrix band", "articulating paper", "mixing spatula",
  "disposable cup dental", "patient bib", "cotton rolls",
  "surface disinfectant dental", "instrument wipes", "hand sanitiser",
  "saliva ejector", "high volume suction tip",
  "orthodontic brackets", "archwire orthodontic",
  "xray holder", "phosphor plate dental",
  "temporary filling material", "cavity liner",
  "retraction cord", "bite registration material",
  "zirconia crown", "implant kit dental",
];

const CATEGORY_MAP: Record<string, string> = {
  "glove": "PPE", "mask": "PPE", "respirator": "PPE",
  "infection": "Infection Control", "disinfect": "Infection Control", "steril": "Infection Control",
  "wipe": "Infection Control", "autoclave": "Infection Control", "pouch": "Infection Control",
  "aspira": "Infection Control", "suction": "Infection Control",
  "anaesth": "Anaesthetics", "cartridge": "Anaesthetics", "needle": "Anaesthetics",
  "articaine": "Anaesthetics", "lidocaine": "Anaesthetics", "topical": "Anaesthetics",
  "composite": "Composites", "bond": "Composites", "resin": "Composites",
  "cement": "Composites", "ionomer": "Composites", "adhesive": "Composites", "liner": "Composites",
  "endo": "Endodontics", "k file": "Endodontics", "rotary": "Endodontics",
  "gutta": "Endodontics", "sealer": "Endodontics",
  "implant": "Implants",
  "impression": "Impression Materials", "alginate": "Impression Materials",
  "silicone": "Impression Materials", "putty": "Impression Materials", "tray": "Impression Materials",
  "instrument": "Instruments", "forcep": "Instruments", "probe": "Instruments",
  "mirror": "Instruments", "scaler": "Instruments", "curette": "Instruments",
  "bur": "Instruments", "disc": "Instruments", "polishing": "Instruments",
  "orthodont": "Orthodontics", "bracket": "Orthodontics", "archwire": "Orthodontics",
  "xray": "Diagnostics", "x-ray": "Diagnostics", "phosphor": "Diagnostics",
  "fluoride": "Consumables", "whitening": "Consumables", "polish": "Consumables",
  "prophy": "Consumables", "fissure": "Consumables", "floss": "Consumables",
  "cotton": "Consumables", "bib": "Consumables", "cup": "Consumables", "matrix": "Consumables",
};
function mapCat(name: string): string {
  const lower = name.toLowerCase();
  for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(kw)) return cat;
  }
  return "Consumables";
}

async function findUrlsViaGoogle(page: any, query: string, existingUrls: Set<string>): Promise<string[]> {
  const newUrls: string[] = [];
  try {
    const searchUrl = `https://www.google.com/search?q=site:dentalsky.com+${encodeURIComponent(query)}&num=10`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await delay(2000);
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]"))
        .map((a: any) => a.href)
        .filter((h: string) =>
          h.includes("dentalsky.com") &&
          !h.includes("/c/") && !h.includes("category") &&
          h.includes(".html") &&
          !h.includes("google.com")
        );
    });
    for (const url of links) {
      // Clean Google redirect
      const match = url.match(/https:\/\/www\.dentalsky\.com\/[^&\s]+\.html/);
      if (match && !existingUrls.has(match[0])) {
        newUrls.push(match[0]);
        existingUrls.add(match[0]);
      }
    }
  } catch {}
  return newUrls;
}

async function scrapeProductPage(page: any, url: string): Promise<any | null> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await delay(3000);
    return await page.evaluate(() => {
      // Try LD+JSON Product schema first
      for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
        try {
          const d = JSON.parse((s as any).textContent ?? "");
          if (d["@type"] === "Product" && d.name) {
            const img = Array.isArray(d.image) ? d.image[0] : d.image;
            return {
              name: d.name,
              image: img || "",
              sku: d.sku || d.mpn || "",
              brand: d.brand?.name || "",
              description: d.description || "",
              price: parseFloat(d.offers?.price || 0) || 0,
              packSize: d.additionalProperty?.find((p: any) => p.name === "Pack Size")?.value || "1 unit",
            };
          }
          if (Array.isArray(d["@graph"])) {
            const prod = d["@graph"].find((x: any) => x["@type"] === "Product");
            if (prod?.name) {
              const img = Array.isArray(prod.image) ? prod.image[0] : prod.image;
              return { name: prod.name, image: img || "", sku: prod.sku || "", brand: prod.brand?.name || "", description: prod.description || "", price: 0, packSize: "1 unit" };
            }
          }
        } catch {}
      }
      // Fallback: Open Graph + H1
      const name = document.querySelector("h1.page-title, .page-title span, h1")?.textContent?.trim() || "";
      const image = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
      const desc = document.querySelector('meta[name="description"], meta[property="og:description"]')?.getAttribute("content") || "";
      if (name.length > 3 && image) return { name, image, sku: "", brand: "", description: desc, price: 0, packSize: "1 unit" };
      return null;
    });
  } catch {
    return null;
  }
}

async function main() {
  // Load existing product URLs and products
  let knownUrls: string[] = [];
  if (fs.existsSync(URLS_FILE)) {
    knownUrls = JSON.parse(fs.readFileSync(URLS_FILE, "utf-8"));
    console.log(`Loaded ${knownUrls.length} known URLs`);
  }

  let existingProducts: any[] = [];
  if (fs.existsSync(PRODUCTS_FILE)) {
    existingProducts = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
    console.log(`Loaded ${existingProducts.length} already scraped products`);
  }

  // Also include URLs from previous scrape runs
  const prevProgress = path.join(process.env.HOME!, "Downloads", "ds-voco-products.json");
  if (fs.existsSync(prevProgress)) {
    const prev = JSON.parse(fs.readFileSync(prevProgress, "utf-8"));
    prev.forEach((p: any) => { if (p.url) knownUrls.push(p.url); });
  }

  const urlSet = new Set(knownUrls);
  const seenNames = new Set(existingProducts.map((p: any) => p.name.toLowerCase().slice(0, 40)));

  const { data: maxRow } = await supabase.from("dentago_products").select("id").order("id", { ascending: false }).limit(1);
  let nextId = (maxRow?.[0]?.id ?? 256) + 1;
  const { data: suppliers } = await supabase.from("dentago_suppliers").select("id, name");
  const hsId = suppliers?.find((s: any) => s.name.toLowerCase().includes("henry"))?.id;
  console.log(`Starting ID: ${nextId}`);

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"] });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  // Step 1: Find product URLs via Google
  console.log("\n🔍 Finding product URLs via Google...");
  for (const query of SEARCHES) {
    if (urlSet.size >= 800) break;
    const found = await findUrlsViaGoogle(page, query, urlSet);
    if (found.length) console.log(`  "${query}" → ${found.length} new URLs (total: ${urlSet.size})`);
    await delay(2000);
  }

  const allUrls = Array.from(urlSet);
  fs.writeFileSync(URLS_FILE, JSON.stringify(allUrls, null, 2));
  console.log(`\n📋 ${allUrls.length} total product URLs found`);

  // Step 2: Scrape each product page
  console.log("\n🔄 Scraping product pages...");
  const allProducts = [...existingProducts];
  let scraped = 0;

  for (const url of allUrls) {
    if (allProducts.length >= 900) break;
    // Skip if already scraped
    if (existingProducts.find((p: any) => p.url === url)) continue;

    process.stdout.write(`  ${url.replace("https://www.dentalsky.com/", "").slice(0, 50).padEnd(50)} `);
    const data = await scrapeProductPage(page, url);

    if (data && data.name.length > 3 && data.image) {
      const key = data.name.toLowerCase().slice(0, 40);
      if (!seenNames.has(key)) {
        seenNames.add(key);
        allProducts.push({ ...data, url });
        scraped++;
        console.log(`✅ ${data.name.slice(0, 40)}`);
      } else {
        console.log(`(dup: ${data.name.slice(0, 30)})`);
      }
    } else {
      console.log("no data");
    }

    if (scraped % 20 === 0 && scraped > 0) {
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(allProducts, null, 2));
    }
    await delay(800);
  }

  await browser.close();
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(allProducts, null, 2));

  // Step 3: Seed to Supabase
  const valid = allProducts.filter(p => p.name.length > 3 && p.image?.startsWith("http"));
  console.log(`\n💾 Seeding ${valid.length} products...`);

  let seeded = 0;
  for (const p of valid) {
    const category = mapCat(p.name);
    const { error } = await supabase.from("dentago_products").upsert({
      id: nextId,
      name: p.name, brand: p.brand || "Dental Sky",
      category, image: p.image,
      pack_size: p.packSize || "1 unit",
      description: p.description || `${p.name} — from Dental Sky.`,
      specs: [
        { label: "SKU", value: p.sku || `DS-${nextId}` },
        { label: "Supplier", value: "Dental Sky" },
        { label: "Category", value: category },
      ],
      similars: [],
    }, { onConflict: "id" });
    if (!error) {
      if (hsId) {
        await supabase.from("dentago_supplier_products").upsert({
          product_id: nextId, supplier_id: hsId,
          price: p.price || 0, stock: true, delivery: "1-2 working days",
          sku: p.sku || `DS-${nextId}`, pack_size: p.packSize || "1 unit",
        }, { onConflict: "product_id,supplier_id" });
      }
      console.log(`  ✅ [${nextId}] ${p.name.slice(0, 60)}`);
      seeded++;
      nextId++;
    } else {
      console.error(`  ❌ ${error.message}`);
    }
  }
  console.log(`\n🎉 ${seeded} new products seeded (total DB ID: ${nextId - 1})`);
}

main().catch(console.error);
