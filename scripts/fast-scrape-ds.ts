/**
 * Fast HTTP-fetch scraper for Dental Sky product pages.
 * Uses Node.js fetch (no Playwright browser needed).
 * Dental Sky pages have LD+JSON Product schema in server-side HTML.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const URLS_FILE = path.join(process.env.HOME!, "Downloads", "ds-product-urls.json");
const PRODUCTS_FILE = path.join(process.env.HOME!, "Downloads", "ds-scraped-products.json");
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Product {
  name: string; brand: string; sku: string; image: string;
  description: string; packSize: string; price: number; url: string;
}

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
  "gutta": "Endodontics", "sealer": "Endodontics", "file": "Endodontics",
  "implant": "Implants",
  "impression": "Impression Materials", "alginate": "Impression Materials",
  "silicone": "Impression Materials", "putty": "Impression Materials", "tray": "Impression Materials",
  "instrument": "Instruments", "forcep": "Instruments", "probe": "Instruments",
  "mirror": "Instruments", "scaler": "Instruments", "curette": "Instruments",
  "bur": "Instruments", "disc": "Instruments",
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

async function fetchProduct(url: string): Promise<Product | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const html = await res.text();
    if (html.length < 5000) return null;

    // Extract LD+JSON blocks
    const ldMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of ldMatches) {
      try {
        const d = JSON.parse(match[1]);
        // Direct Product
        if (d["@type"] === "Product" && d.name) {
          const img = Array.isArray(d.image) ? d.image[0] : d.image;
          return {
            name: d.name,
            brand: d.brand?.name || "",
            sku: d.sku || d.mpn || "",
            image: img || "",
            description: (d.description || "").replace(/<[^>]+>/g, "").slice(0, 400),
            packSize: d.additionalProperty?.find((p: any) => p.name === "Pack Size")?.value || "1 unit",
            price: parseFloat(d.offers?.price || 0) || 0,
            url,
          };
        }
        // @graph with Product
        if (Array.isArray(d["@graph"])) {
          const prod = d["@graph"].find((x: any) => x["@type"] === "Product");
          if (prod?.name) {
            const img = Array.isArray(prod.image) ? prod.image[0] : prod.image;
            return {
              name: prod.name, brand: prod.brand?.name || "", sku: prod.sku || "",
              image: img || "", description: (prod.description || "").replace(/<[^>]+>/g, "").slice(0, 400),
              packSize: "1 unit", price: parseFloat(prod.offers?.price || 0) || 0, url,
            };
          }
        }
      } catch {}
    }

    // Fallback: extract from HTML
    const nameMatch = html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)
      || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const imgMatch = html.match(/media\/catalog\/product[^"']+\.(jpg|png|webp)/i);
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]{10,300})"/i);

    const name = nameMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
    const imgPath = imgMatch ? `https://www.dentalsky.com/${imgMatch[0]}` : "";
    const desc = descMatch?.[1] || "";

    if (name.length > 5 && imgPath) {
      return { name, brand: "", sku: "", image: imgPath, description: desc, packSize: "1 unit", price: 0, url };
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  // Load product URLs
  const urls: string[] = JSON.parse(fs.readFileSync(URLS_FILE, "utf-8"));
  console.log(`Loaded ${urls.length} product URLs`);

  // Load already scraped products
  let existing: Product[] = [];
  if (fs.existsSync(PRODUCTS_FILE)) {
    existing = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
    console.log(`Already scraped: ${existing.length} products`);
  }

  const { data: maxRow } = await supabase.from("dentago_products").select("id").order("id", { ascending: false }).limit(1);
  let nextId = (maxRow?.[0]?.id ?? 256) + 1;
  const { data: suppliers } = await supabase.from("dentago_suppliers").select("id, name");
  const hsId = suppliers?.find((s: any) => s.name.toLowerCase().includes("henry"))?.id;
  console.log(`Starting ID: ${nextId}`);

  const existingUrls = new Set(existing.map((p: Product) => p.url));
  const seenNames = new Set(existing.map((p: Product) => p.name.toLowerCase().slice(0, 40)));
  const allProducts = [...existing];

  let scraped = 0;
  let failed = 0;

  // Process in batches of 5 concurrent requests
  const BATCH_SIZE = 5;
  const pendingUrls = urls.filter(u => !existingUrls.has(u));
  console.log(`\nScraping ${pendingUrls.length} new URLs...\n`);

  for (let i = 0; i < pendingUrls.length && allProducts.length < 900; i += BATCH_SIZE) {
    const batch = pendingUrls.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(url => fetchProduct(url)));

    for (let j = 0; j < batch.length; j++) {
      const data = results[j];
      const url = batch[j];
      const slug = url.replace("https://www.dentalsky.com/", "").slice(0, 45).padEnd(45);

      if (data && data.name.length > 3 && data.image) {
        const key = data.name.toLowerCase().slice(0, 40);
        if (!seenNames.has(key)) {
          seenNames.add(key);
          allProducts.push(data);
          scraped++;
          console.log(`  ✅ ${slug} | ${data.name.slice(0, 45)}`);
        } else {
          console.log(`  -- ${slug} | dup`);
        }
      } else {
        failed++;
        console.log(`  ❌ ${slug}`);
      }
    }

    // Save progress every 50 products
    if (scraped % 50 === 0 && scraped > 0) {
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(allProducts, null, 2));
      console.log(`\n  💾 Saved ${allProducts.length} products\n`);
    }

    // Small delay between batches to avoid rate limiting
    await delay(500);
  }

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(allProducts, null, 2));
  console.log(`\n\n📦 Scraped: ${scraped} new | Failed: ${failed} | Total: ${allProducts.length}`);

  // Seed valid products to Supabase
  const valid = allProducts.filter(p =>
    p.name.length > 3 &&
    p.image?.startsWith("http") &&
    !p.image.includes("placeholder")
  );
  console.log(`\n💾 Seeding ${valid.length} products to Supabase...`);

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
      seeded++;
      nextId++;
      if (seeded % 50 === 0) console.log(`  [${seeded}] ${p.name.slice(0, 50)}`);
    } else {
      console.error(`  ❌ ${error.message}`);
    }
  }

  console.log(`\n🎉 ${seeded} products seeded! Total DB products: ~${nextId - 1}`);
}

main().catch(console.error);
