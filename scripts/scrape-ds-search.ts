/**
 * Scrapes Dental Sky product catalog via their search pages (200 OK, no auth required).
 * Uses many dental product search terms to get wide variety.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const PROGRESS = path.join(process.env.HOME!, "Downloads", "ds-search-products.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Product {
  name: string; brand: string; sku: string; image: string;
  description: string; packSize: string; price: number;
}

// Comprehensive dental product search terms
const SEARCH_TERMS = [
  // Gloves
  "nitrile gloves", "latex gloves", "vinyl gloves", "examination gloves", "surgical gloves",
  "powder free gloves", "medibase gloves", "aurelia gloves", "sempermed gloves",
  // Masks
  "face mask", "type IIR mask", "ffp2 mask", "respirator mask", "surgical mask",
  // Infection control
  "surface disinfectant", "instrument wipes", "hand sanitiser", "autoclave pouches",
  "sterilisation pouches", "cold sterile solution", "ultrasonic cleaner", "dental dam",
  "suction tips", "high volume evacuator", "saliva ejector", "aspirator tips",
  // Anaesthetics
  "articaine cartridge", "lidocaine cartridge", "prilocaine", "mepivacaine",
  "dental needle", "topical anaesthetic", "citanest", "scandonest",
  // Composites & restoratives
  "composite resin", "dental bonding", "dental cement", "glass ionomer", "resin cement",
  "flowable composite", "bulk fill composite", "self-etch adhesive", "cavity liner",
  "temporary filling", "dentin adhesive",
  // Endodontics
  "rotary file", "k file", "h file", "gutta percha", "endodontic sealer",
  "apex locator", "rubber dam", "endodontic irrigant", "sodium hypochlorite",
  // Impression
  "alginate impression", "vinyl polysiloxane", "addition silicone", "impression putty",
  "bite registration", "impression trays", "retraction cord",
  // Instruments
  "dental probe", "dental mirror", "extraction forceps", "dental scaler", "curette",
  "college tweezers", "mixing spatula", "articulating paper", "matrix band", "cotton rolls",
  // Orthodontics
  "orthodontic brackets", "archwire", "molar bands", "elastic ligatures", "retainer",
  // Preventive
  "prophy paste", "fluoride varnish", "fluoride gel", "fissure sealant", "disclosing tablets",
  "interdental brush", "dental floss", "whitening trays",
  // Diagnostics / radiography
  "x-ray film", "phosphor plate", "sensor holder", "film holder", "developer fixer",
  // Consumables
  "disposable cup", "patient bib", "bur", "diamond bur", "polishing disc",
  "mixing tips", "dispensing tips", "light cure tip", "cotton pellets",
];

const CATEGORY_MAP: Record<string, string> = {
  "glove": "PPE", "mask": "PPE", "respirator": "PPE", "apron": "PPE", "gown": "PPE",
  "infection": "Infection Control", "disinfect": "Infection Control", "steril": "Infection Control",
  "wipe": "Infection Control", "autoclave": "Infection Control", "pouch": "Infection Control",
  "aspira": "Infection Control", "suction": "Infection Control",
  "anaesth": "Anaesthetics", "cartridge": "Anaesthetics", "needle": "Anaesthetics",
  "articaine": "Anaesthetics", "lidocaine": "Anaesthetics", "prilocaine": "Anaesthetics",
  "mepivacaine": "Anaesthetics", "topical": "Anaesthetics",
  "composite": "Composites", "bond": "Composites", "resin": "Composites",
  "cement": "Composites", "ionomer": "Composites", "adhesive": "Composites", "liner": "Composites",
  "endo": "Endodontics", "k file": "Endodontics", "h file": "Endodontics",
  "rotary": "Endodontics", "gutta": "Endodontics", "sealer": "Endodontics",
  "implant": "Implants",
  "impression": "Impression Materials", "alginate": "Impression Materials",
  "silicone": "Impression Materials", "putty": "Impression Materials", "tray": "Impression Materials",
  "instrument": "Instruments", "forcep": "Instruments", "probe": "Instruments",
  "mirror": "Instruments", "scaler": "Instruments", "curette": "Instruments",
  "tweezers": "Instruments", "spatula": "Instruments", "bur": "Instruments",
  "orthodont": "Orthodontics", "bracket": "Orthodontics", "archwire": "Orthodontics",
  "x-ray": "Diagnostics", "xray": "Diagnostics", "phosphor": "Diagnostics",
  "fluoride": "Consumables", "whitening": "Consumables", "polish": "Consumables",
  "prophyl": "Consumables", "prophy": "Consumables", "fissure": "Consumables",
  "floss": "Consumables", "cotton": "Consumables", "bib": "Consumables",
};

function mapCat(name: string): string {
  const lower = name.toLowerCase();
  for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(kw)) return cat;
  }
  return "Consumables";
}

async function scrapeSearchPage(page: any, term: string): Promise<Product[]> {
  const products: Product[] = [];
  const url = `https://www.dentalsky.com/catalogsearch/result/?q=${encodeURIComponent(term)}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await delay(4000);

    const extracted = await page.evaluate(() => {
      const results: any[] = [];

      // Method 1: LD+JSON product list
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s: any) => {
        try {
          const d = JSON.parse(s.textContent ?? "");
          // ItemList with products
          if (d.itemListElement) {
            d.itemListElement.forEach((item: any) => {
              const p = item.item || item;
              if (p["@type"] === "Product" && p.name) {
                const img = Array.isArray(p.image) ? p.image[0] : p.image;
                results.push({
                  name: p.name, image: img || "", sku: p.sku || "", brand: p.brand?.name || "",
                  desc: p.description || "", price: parseFloat(p.offers?.price || 0) || 0,
                });
              }
            });
          }
          if (d["@type"] === "Product" && d.name) {
            const img = Array.isArray(d.image) ? d.image[0] : d.image;
            results.push({ name: d.name, image: img || "", sku: d.sku || "", brand: d.brand?.name || "", desc: d.description || "", price: 0 });
          }
          if (Array.isArray(d["@graph"])) {
            d["@graph"].forEach((p: any) => {
              if (p["@type"] === "Product" && p.name) {
                const img = Array.isArray(p.image) ? p.image[0] : p.image;
                results.push({ name: p.name, image: img || "", sku: p.sku || "", brand: p.brand?.name || "", desc: p.description || "", price: parseFloat(p.offers?.price || 0) || 0 });
              }
            });
          }
        } catch {}
      });

      // Method 2: Magento product listing DOM elements
      if (results.length === 0) {
        document.querySelectorAll(".product-item, li.item.product").forEach((el: any) => {
          const nameEl = el.querySelector(".product-item-name a, .product-item-link, .product-name a");
          const imgEl = el.querySelector("img.product-image-photo");
          const priceEl = el.querySelector(".price");
          const name = nameEl?.textContent?.trim() ?? "";
          let image = imgEl?.src || imgEl?.getAttribute("data-src") || "";
          if (image.includes("placeholder") || !image.includes("http")) image = "";
          const price = parseFloat((priceEl?.textContent ?? "").replace(/[^0-9.]/g, "")) || 0;
          if (name.length > 3 && image) {
            results.push({ name, image, sku: "", brand: "", desc: "", price });
          }
        });
      }

      return results;
    });

    for (const p of extracted) {
      if (!p.name || p.name.length < 3) continue;
      products.push({
        name: p.name, brand: p.brand || "Dental Sky",
        sku: p.sku, image: p.image,
        description: p.desc?.slice(0, 400) || `${p.name} — from Dental Sky.`,
        packSize: "1 unit", price: p.price,
      });
    }
    if (products.length > 0) console.log(`  "${term}" → ${products.length} products`);
  } catch (e: any) {
    console.log(`  "${term}" error: ${e.message?.slice(0, 40)}`);
  }
  return products;
}

async function main() {
  let existing: Product[] = [];
  if (fs.existsSync(PROGRESS)) {
    existing = JSON.parse(fs.readFileSync(PROGRESS, "utf-8"));
    console.log(`Resuming: ${existing.length} already in file`);
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

  for (const term of SEARCH_TERMS) {
    if (allProducts.length >= 800) break;
    const items = await scrapeSearchPage(page, term);
    let added = 0;
    for (const item of items) {
      const key = item.name.toLowerCase().slice(0, 40);
      if (seen.has(key) || !item.image) continue;
      seen.add(key);
      allProducts.push(item);
      added++;
    }
    if (added > 0) {
      fs.writeFileSync(PROGRESS, JSON.stringify(allProducts, null, 2));
    }
    await delay(1200);
  }

  await browser.close();
  fs.writeFileSync(PROGRESS, JSON.stringify(allProducts, null, 2));

  const valid = allProducts.filter(p => p.name.length > 3 && p.image?.startsWith("http") && !p.image.includes("placeholder"));
  console.log(`\n📦 ${valid.length} valid products. Seeding to Supabase...`);

  let seeded = 0;
  for (const p of valid) {
    const category = mapCat(p.name);
    const { error } = await supabase.from("dentago_products").upsert({
      id: nextId,
      name: p.name, brand: p.brand || "Dental Sky",
      category, image: p.image,
      pack_size: p.packSize || "1 unit",
      description: p.description,
      specs: [
        { label: "SKU", value: p.sku || `DS-${nextId}` },
        { label: "Supplier", value: p.brand || "Dental Sky" },
        { label: "Category", value: category },
      ],
      similars: [],
    }, { onConflict: "id" });

    if (!error) {
      if (hsId) {
        await supabase.from("dentago_supplier_products").upsert({
          product_id: nextId, supplier_id: hsId,
          price: p.price || 0, stock: true,
          delivery: "1-2 working days",
          sku: p.sku || `DS-${nextId}`,
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
  console.log(`\n🎉 ${seeded} products seeded (total DB now ~${nextId - 1})`);
}

main().catch(console.error);
