/**
 * DD Group scraper v3 — extracts product JSON embedded in page HTML.
 * All data (name, price, brand, image, SKU) is in server-rendered JSON.
 * One request per listing page (24 products), no individual page visits needed.
 */
import { createClient } from "@supabase/supabase-js";
import * as https from "https";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const BASE = "https://www.ddgroup.com";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith("http") ? res.headers.location : BASE + res.headers.location;
        fetchHtml(loc).then(resolve).catch(reject); return;
      }
      if (res.statusCode && res.statusCode >= 400) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

// Top-level categories — verified working (Next.js + Algolia embedded JSON)
const CATEGORIES: { path: string; category: string }[] = [
  { path: "/anaesthetics--pharmaceuticals/", category: "Anaesthetics" },
  { path: "/infection-control/", category: "PPE & Infection Control" },
  { path: "/endodontics/", category: "Endodontics" },
  { path: "/restoratives/", category: "Composites & Restoratives" },
  { path: "/burs/", category: "Burs & Instruments" },
  { path: "/hand-instruments/", category: "Instruments" },
  { path: "/impression-materials/", category: "Impression Materials" },
  { path: "/orthodontics/", category: "Orthodontics" },
  { path: "/surgical--implantology/", category: "Instruments" },
  { path: "/x-ray/", category: "Imaging & X-Ray" },
  { path: "/handpieces/", category: "Burs & Instruments" },
  { path: "/consumables/", category: "PPE & Infection Control" },
  { path: "/equipment/", category: "Equipment" },
  { path: "/whitening/", category: "Patient Products" },
];

type Product = {
  name: string;
  sku: string;
  brand: string;
  price: number;
  packSize: string;
  image: string;
  inStock: boolean;
  category: string;
};

// Extract products from Algolia hits JSON array embedded in page HTML
function extractProductsFromJson(html: string, defaultCategory: string): Product[] {
  const products: Product[] = [];

  // Find the Algolia hits array — format: "hits":[{"name":"SKU : Product Name",...}]
  const hitsIdx = html.indexOf('"hits":[{"name"');
  if (hitsIdx === -1) return products;

  const arrayStart = html.indexOf('[', hitsIdx);
  if (arrayStart === -1) return products;

  // Extract the array by counting brackets
  let depth = 0, i = arrayStart, end = -1;
  while (i < html.length && i < arrayStart + 600000) {
    const c = html[i];
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
    i++;
  }
  if (end === -1) return products;

  let hits: any[];
  try {
    hits = JSON.parse(html.substring(arrayStart, end + 1));
  } catch {
    return products;
  }

  for (const h of hits) {
    const sku: string = (h.code || "").toString().toUpperCase().trim();
    if (!sku) continue;

    const price = parseFloat(h.catalogPrice ?? 0);
    if (!price || price <= 0 || price > 5000) continue;

    // Name: "SKU : Product Name" → strip leading SKU prefix
    const rawName: string = h.description || h.displayName || h.name || "";
    const name = rawName.replace(/^\s*[A-Z0-9]{4,10}\s*:\s*/, "").trim();
    if (!name) continue;

    const brand: string = h.brand || "";
    const image: string = h.mainImage || "";
    const inStock: boolean = h.stockStatus !== "oos" && h.stocked !== false;

    // Pack size from unitOfMeasure or name parenthetical
    const packSizeMatch = rawName.match(/\(([^)]{3,40})\)/) || (h.unitOfMeasure ? [null, h.unitOfMeasure] : null);
    const packSize: string = packSizeMatch ? packSizeMatch[1].trim() : "";

    products.push({ name, sku, brand, price, packSize, image, inStock, category: defaultCategory });
  }

  return products;
}

async function scrapeCategoryPages(catPath: string, category: string): Promise<Product[]> {
  const allProducts: Map<string, Product> = new Map();

  try {
    const firstHtml = await fetchHtml(BASE + catPath);
    const firstProducts = extractProductsFromJson(firstHtml, category);
    firstProducts.forEach(p => allProducts.set(p.sku, p));

    // Algolia pagination: "nbPages":N embedded in page HTML (0-based pages)
    const nbPagesMatch = firstHtml.match(/"nbPages"\s*:\s*(\d+)/);
    const nbPages = nbPagesMatch ? parseInt(nbPagesMatch[1]) : 1;
    const nbHitsMatch = firstHtml.match(/"nbHits"\s*:\s*(\d+)/);
    const total = nbHitsMatch ? parseInt(nbHitsMatch[1]) : firstProducts.length;

    process.stdout.write(`  ${catPath}: ${total} products, ${nbPages} pages → got ${firstProducts.length} from p1\n`);

    // Pages are 0-indexed in Algolia; ?page=1 = second page
    for (let pg = 1; pg < Math.min(nbPages, 20); pg++) {
      await delay(400);
      try {
        const pageHtml = await fetchHtml(BASE + catPath + `?page=${pg}`);
        const pageProducts = extractProductsFromJson(pageHtml, category);
        pageProducts.forEach(p => allProducts.set(p.sku, p));
      } catch (e: any) {
        process.stdout.write(`    page ${pg} error: ${e.message}\n`);
      }
    }
  } catch (e: any) {
    process.stdout.write(`  ${catPath}: error — ${e.message}\n`);
  }

  return [...allProducts.values()];
}

async function main() {
  console.log("=== DD Group Scraper v3 (embedded JSON) ===\n");

  let { data: ddSupplier } = await sb.from("dentago_suppliers").select("id").eq("name", "DD Group").single();
  if (!ddSupplier) {
    const { data: inserted } = await sb.from("dentago_suppliers")
      .insert({ name: "DD Group" }).select("id").single();
    ddSupplier = inserted;
  }
  const ddId = ddSupplier?.id;
  if (!ddId) { console.error("Could not get DD Group supplier ID"); process.exit(1); }
  console.log(`DD Group supplier ID: ${ddId}`);

  const { data: existingSP } = await sb.from("dentago_supplier_products")
    .select("sku, product_id").eq("supplier_id", ddId);
  const existingSkus = new Set((existingSP ?? []).map((r: any) => r.sku));
  console.log(`Existing DD products: ${existingSkus.size}\n`);

  const allProducts: Map<string, Product> = new Map();

  for (const { path, category } of CATEGORIES) {
    const products = await scrapeCategoryPages(path, category);
    products.forEach(p => { if (!allProducts.has(p.sku)) allProducts.set(p.sku, p); });
    await delay(500);
  }

  console.log(`\n=== Collected ${allProducts.size} unique products. Syncing to DB... ===\n`);

  // Get current max product id
  const { data: maxRow } = await sb.from("dentago_products").select("id").order("id", { ascending: false }).limit(1);
  let nextId = (maxRow?.[0]?.id ?? 0) + 1;
  console.log(`Starting product IDs from: ${nextId}`);

  let added = 0, refreshed = 0, failed = 0;

  for (const [sku, p] of allProducts) {
    try {
      if (existingSkus.has(sku)) {
        await sb.from("dentago_supplier_products")
          .update({ price: p.price, updated_at: new Date().toISOString() })
          .eq("supplier_id", ddId).eq("sku", sku);
        refreshed++;
      } else {
        const { data: existing } = await sb.from("dentago_products")
          .select("id, image").eq("name", p.name).maybeSingle();

        let productId: number;
        if (existing?.id) {
          productId = existing.id;
          if (p.image && !existing.image) {
            await sb.from("dentago_products").update({ image: p.image }).eq("id", productId);
          }
        } else {
          const description = `${p.name}${p.brand ? ` by ${p.brand}` : ""}. Available from DD Group.`;
          const { error } = await sb.from("dentago_products")
            .insert({ id: nextId, name: p.name, brand: p.brand, category: p.category, image: p.image, pack_size: p.packSize, description, specs: [], similars: [] });
          if (error) {
            if (failed < 3) process.stdout.write(`    INSERT ERROR: ${JSON.stringify(error)} | ${p.name}\n`);
            failed++; continue;
          }
          productId = nextId;
          nextId++;
        }

        await sb.from("dentago_supplier_products").insert({
          product_id: productId,
          supplier_id: ddId,
          price: p.price,
          stock: p.inStock,
          delivery: "1-3 working days",
          sku,
          pack_size: p.packSize,
        });

        existingSkus.add(sku);
        added++;
      }

      if ((added + refreshed) % 50 === 0 && (added + refreshed) > 0) {
        console.log(`  Progress — Added: ${added} | Refreshed: ${refreshed} | Failed: ${failed}`);
      }
    } catch (e: any) {
      failed++;
    }
    await delay(40);
  }

  console.log(`\n=== Done ===`);
  console.log(`Added new: ${added}`);
  console.log(`Refreshed: ${refreshed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total DD products now: ${(existingSP?.length ?? 0) + added}`);
}

main().catch(console.error);
