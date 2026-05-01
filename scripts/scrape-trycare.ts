/**
 * scrape-trycare.ts
 *
 * Scrapes Trycare (trycare.co.uk) — a UK dental supplier.
 * Products are server-rendered with JSON-LD structured data.
 * SKU is derived from the product image filename.
 * Prices are hidden behind login so are stored as null.
 *
 * Strategy:
 *  1. Fetch category listing pages to get product page URLs
 *  2. For each product page, parse JSON-LD for name, brand, image
 *  3. Derive SKU from image URL (e.g. UANST50.jpg → UANST50)
 *  4. Upsert to Supabase
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const SUPPLIER_ID = 5; // Trycare
const PROGRESS_FILE = `${process.env.HOME}/Downloads/trycare-progress.json`;
const BASE = "https://www.trycare.co.uk";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "en-GB,en;q=0.9",
};

// Top-level dental categories on Trycare
const ROOT_CATEGORIES = [
  "/dental/categories/anaesthetics-pharmaceuticals",
  "/dental/categories/burs",
  "/dental/categories/cadcam-blocks",
  "/dental/categories/cements-liners",
  "/dental/categories/disposables",
  "/dental/categories/endodontics",
  "/dental/categories/equipment",
  "/dental/categories/finishing-polishing",
  "/dental/categories/hand-instruments",
  "/dental/categories/implant-systems",
  "/dental/categories/impression-materials",
  "/dental/categories/infection-control",
  "/dental/categories/laboratory",
  "/dental/categories/orthodontics",
  "/dental/categories/pins-and-posts",
  "/dental/categories/prevention-oral-hygiene",
  "/dental/categories/restoratives",
  "/dental/categories/surgical",
  "/dental/categories/temporarypermanent-crowns-materials",
  "/dental/categories/whitening",
  "/dental/categories/x-ray",
];

interface Progress {
  visitedUrls: string[];
  processedProducts: string[];
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { visitedUrls: [], processedProducts: [] };
}

function saveProgress(p: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractLinks(html: string, basePattern: string): string[] {
  const matches = html.matchAll(/href="(\/dental\/[^"]+)"/g);
  const links: string[] = [];
  for (const m of matches) {
    const href = m[1];
    if (href.startsWith(basePattern) && href !== basePattern) {
      links.push(href);
    }
  }
  return [...new Set(links)];
}

interface ProductData {
  name: string;
  sku: string;
  brand: string;
  image: string;
  description: string;
  url: string;
}

function parseJsonLd(html: string): ProductData | null {
  const match = html.match(/application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    if (data["@type"] !== "Product" || !data.name) return null;

    const imageUrl: string = data.image ?? "";
    // Extract SKU from image filename: /images/ww/product/UANST50.jpg → UANST50
    const skuMatch = imageUrl.match(/\/([A-Z0-9\-]+)\.[a-z]+$/i);
    const sku = skuMatch ? skuMatch[1].toUpperCase() : "";

    return {
      name: data.name.trim(),
      sku,
      brand: data.brand?.name ?? "",
      image: imageUrl,
      description: data.description ?? "",
      url: data.url ?? "",
    };
  } catch {
    return null;
  }
}

async function upsertProduct(prod: ProductData): Promise<boolean> {
  try {
    // Check if product already exists
    const { data: existing } = await sb
      .from("dentago_products")
      .select("id")
      .ilike("name", prod.name)
      .limit(1);

    let productId: number;

    if (existing && existing.length > 0) {
      productId = existing[0].id;
    } else {
      const { data: newProd, error } = await sb
        .from("dentago_products")
        .insert({
          name: prod.name,
          brand: prod.brand || null,
          image: prod.image || null,
          description: prod.description || null,
        })
        .select("id")
        .single();
      if (error || !newProd) return false;
      productId = newProd.id;
    }

    // Check if this supplier entry already exists
    const { data: existingSP } = await sb
      .from("dentago_supplier_products")
      .select("id")
      .eq("product_id", productId)
      .eq("supplier_id", SUPPLIER_ID)
      .limit(1);

    if (!existingSP || existingSP.length === 0) {
      await sb.from("dentago_supplier_products").insert({
        product_id: productId,
        supplier_id: SUPPLIER_ID,
        sku: prod.sku || null,
        price: null, // Trycare prices require login
        stock: "in_stock",
        delivery: "1-3 days",
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== Trycare Scraper ===\n");

  const progress = loadProgress();
  const visited = new Set(progress.visitedUrls);
  const processed = new Set(progress.processedProducts);

  let totalProducts = 0;
  const productQueue: string[] = [];

  // Phase 1: discover all product page URLs from category pages
  console.log("Phase 1: Discovering product pages...");
  const categoryQueue = [...ROOT_CATEGORIES];
  const visitedCategories = new Set<string>();

  while (categoryQueue.length > 0) {
    const catPath = categoryQueue.shift()!;
    if (visitedCategories.has(catPath)) continue;
    visitedCategories.add(catPath);

    try {
      const html = await fetchHtml(BASE + catPath);
      // Sub-categories and product pages all share the /dental/categories/ prefix
      const links = extractLinks(html, catPath);
      for (const link of links) {
        // Heuristic: product pages have more path segments
        const depth = link.split("/").length;
        const catDepth = catPath.split("/").length;
        if (depth > catDepth) {
          // Could be sub-category or product — we'll try to parse as product
          if (!visited.has(link)) {
            productQueue.push(link);
          }
        }
      }
      console.log(`  ${catPath} → ${links.length} links found`);
      await delay(300);
    } catch (e: any) {
      console.log(`  Error: ${catPath} — ${e.message}`);
    }
  }

  console.log(`\nTotal product/sub-category URLs: ${productQueue.length}`);

  // Phase 2: process each URL as a product page
  console.log("\nPhase 2: Scraping product pages...");

  let done = 0;
  for (const path of productQueue) {
    if (processed.has(path)) continue;

    try {
      const html = await fetchHtml(BASE + path);
      const prod = parseJsonLd(html);

      if (prod) {
        const ok = await upsertProduct(prod);
        if (ok) {
          totalProducts++;
          if (totalProducts % 50 === 0) {
            console.log(`  ${totalProducts} products saved...`);
          }
        }
      } else {
        // Might be a sub-category — extract more links
        const subLinks = extractLinks(html, path);
        for (const sub of subLinks) {
          if (!processed.has(sub) && !productQueue.includes(sub)) {
            productQueue.push(sub);
          }
        }
      }
    } catch {}

    processed.add(path);
    done++;

    if (done % 100 === 0) {
      progress.visitedUrls = [...visited];
      progress.processedProducts = [...processed];
      saveProgress(progress);
      await delay(500);
    } else {
      await delay(100 + Math.random() * 200);
    }
  }

  progress.processedProducts = [...processed];
  saveProgress(progress);

  console.log(`\n=== Done ===`);
  console.log(`Products saved: ${totalProducts}`);
}

main().catch(console.error);
