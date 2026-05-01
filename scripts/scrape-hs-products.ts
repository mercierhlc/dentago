import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const PROGRESS_PATH = path.join(process.env.HOME!, "Downloads", "hs-products.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Category mapping
const CATEGORY_MAP: Record<string, string> = {
  "glove": "PPE", "mask": "PPE", "ppe": "PPE", "apron": "PPE", "gown": "PPE",
  "infection": "Infection Control", "disinfect": "Infection Control", "steril": "Infection Control", "wipe": "Infection Control", "pouch": "Infection Control",
  "anaesth": "Anaesthetics", "cartridge": "Anaesthetics", "needle": "Anaesthetics",
  "composite": "Composites", "bond": "Composites", "resin": "Composites", "cement": "Composites", "glass ionomer": "Composites",
  "endo": "Endodontics", "file": "Endodontics", "gutta": "Endodontics", "obturat": "Endodontics",
  "implant": "Implants", "abutment": "Implants", "fixture": "Implants",
  "impression": "Impression Materials", "alginate": "Impression Materials", "polyvinyl": "Impression Materials",
  "instrument": "Instruments", "forcep": "Instruments", "probe": "Instruments", "mirror": "Instruments", "scaler": "Instruments",
  "orthodont": "Orthodontics", "bracket": "Orthodontics", "archwire": "Orthodontics",
  "xray": "Diagnostics", "x-ray": "Diagnostics", "sensor": "Diagnostics", "phosphor": "Diagnostics",
  "prophyl": "Consumables", "fluoride": "Consumables", "tooth": "Consumables",
};

function mapCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(kw)) return cat;
  }
  return "Consumables";
}

// Google search to find HS product URLs
async function findProductUrls(browser: any, query: string): Promise<string[]> {
  const page = await browser.newPage();
  const urls: string[] = [];
  try {
    await page.goto(`https://www.bing.com/search?q=site:henryschein.co.uk+dental+${encodeURIComponent(query)}+product`, {
      waitUntil: "domcontentloaded", timeout: 15000
    });
    await page.waitForTimeout(2000);

    const links = await page.$$eval("a[href]", (as: HTMLAnchorElement[]) =>
      as.map(a => a.href).filter(h =>
        h.includes("henryschein.co.uk/dental/Products") &&
        !h.includes("/c/") &&
        h.includes("/p/")
      )
    );
    urls.push(...links);
  } catch {}
  await page.close();
  return urls;
}

async function scrapeProductPage(page: any, url: string): Promise<any | null> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(5000);

    // Try structured data first
    const ldJson = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of scripts) {
        try {
          const d = JSON.parse(s.textContent ?? "");
          if (d["@type"] === "Product") return d;
          if (Array.isArray(d["@graph"])) {
            const p = d["@graph"].find((x: any) => x["@type"] === "Product");
            if (p) return p;
          }
        } catch {}
      }
      return null;
    });

    if (ldJson) {
      return {
        name: ldJson.name ?? "",
        brand: ldJson.brand?.name ?? ldJson.manufacturer ?? "",
        sku: ldJson.sku ?? ldJson.mpn ?? "",
        image: Array.isArray(ldJson.image) ? ldJson.image[0] : (ldJson.image ?? ""),
        description: ldJson.description ?? "",
        price: parseFloat(ldJson.offers?.price ?? 0) || 0,
        packSize: ldJson.additionalProperty?.find((p: any) => p.name === "Pack Size")?.value ?? "1 unit",
      };
    }

    // Fallback: meta tags
    const meta = await page.evaluate(() => {
      const get = (s: string) => document.querySelector(s)?.getAttribute("content") ?? "";
      return {
        name: get('meta[property="og:title"]') || document.querySelector("h1")?.textContent?.trim() || "",
        image: get('meta[property="og:image"]'),
        description: get('meta[name="description"]') || get('meta[property="og:description"]'),
      };
    });

    if (meta.name.length > 5) return { ...meta, brand: "", sku: "", price: 0, packSize: "1 unit" };
    return null;
  } catch {
    return null;
  }
}

async function main() {
  let existing: any[] = [];
  if (fs.existsSync(PROGRESS_PATH)) {
    existing = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
    console.log(`Resuming with ${existing.length} already scraped`);
  }

  const { data: existingProds } = await supabase.from("dentago_products").select("id").order("id", { ascending: false }).limit(1);
  let nextId = (existingProds?.[0]?.id ?? 100) + 1;
  console.log(`Starting ID: ${nextId}`);

  const { data: suppliers } = await supabase.from("dentago_suppliers").select("id, name");
  const hsId = suppliers?.find((s: any) => s.name.toLowerCase().includes("henry"))?.id;

  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });

  // Dental product search terms to get variety
  const searchTerms = [
    "nitrile gloves", "latex gloves", "face mask", "ffp2 mask", "surgical mask",
    "surface disinfectant", "hand sanitiser", "autoclave pouches", "instrument wipes",
    "articaine cartridge", "lidocaine cartridge", "dental needle", "topical anaesthetic",
    "composite resin", "dental bonding", "glass ionomer cement", "dental cement",
    "rotary file", "endodontic file", "gutta percha", "root canal sealer",
    "dental implant kit", "impression material", "alginate", "vinyl polysiloxane",
    "dental probe", "dental mirror", "extraction forceps", "dental scaler",
    "orthodontic bracket", "archwire", "dental x-ray film", "phosphor plate",
    "prophy paste", "fluoride varnish", "interdental brush", "dental floss",
    "matrix band", "rubber dam", "dental bur", "diamond bur",
    "suture material", "retraction cord", "temporary filling", "cavity liner",
    "dental wax", "articulating paper", "mixing pad", "dispensing tip",
    "saliva ejector", "high volume evacuator tip", "cotton roll", "gauze",
    "disposable cup", "patient bib", "light cure unit tip", "curing light shield",
  ];

  const allUrls = new Set<string>(existing.map((e: any) => e.url));
  const products: any[] = [...existing];

  // Find product URLs via Bing
  console.log("\n🔍 Finding Henry Schein product URLs via Bing...");
  for (const term of searchTerms.slice(0, 20)) {
    const urls = await findProductUrls(browser, term);
    urls.forEach(u => allUrls.add(u));
    console.log(`  "${term}" → ${urls.length} URLs (total: ${allUrls.size})`);
    await delay(1500);
  }

  console.log(`\n📋 ${allUrls.size} unique HS product URLs found`);

  // Scrape each product page
  const productPage = await browser.newPage();
  let scraped = 0;

  for (const url of Array.from(allUrls)) {
    if (products.find((p: any) => p.url === url)) continue;
    process.stdout.write(`Scraping ${url.slice(-40)}... `);
    const data = await scrapeProductPage(productPage, url);
    if (data && data.name.length > 5) {
      products.push({ ...data, url });
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(products, null, 2));
      scraped++;
      console.log(`✅ ${data.name.slice(0, 50)}`);
    } else {
      console.log("no data");
    }
    if (products.length >= 1000) break;
    await delay(800);
  }

  await browser.close();

  // Seed to database
  console.log(`\n💾 Seeding ${products.length} products to Supabase...`);
  let seeded = 0;
  for (const p of products) {
    if (!p.name || !p.image) continue;
    const category = mapCategory(p.name);
    const { error } = await supabase.from("dentago_products").upsert({
      id: nextId,
      name: p.name,
      brand: p.brand || "Henry Schein",
      category,
      image: p.image,
      pack_size: p.packSize || "1 unit",
      description: p.description || `${p.name} — available from Henry Schein UK.`,
      specs: JSON.stringify([
        { label: "SKU", value: p.sku || `HS-${nextId}` },
        { label: "Supplier", value: "Henry Schein" },
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
        sku: p.sku || `HS-${nextId}`,
        pack_size: p.packSize || "1 unit",
      }, { onConflict: "product_id,supplier_id" });
      console.log(`  ✅ [${nextId}] ${p.name.slice(0, 60)}`);
      seeded++;
      nextId++;
    }
  }

  console.log(`\n🎉 ${seeded} products seeded`);
}

main().catch(console.error);
