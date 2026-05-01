/**
 * scrape-kent-express.ts
 *
 * Scrapes Kent Express using Playwright.
 * The site is a Sitecore JSS Angular SPA. The homepage loads correctly;
 * other routes return 404 in headless mode.
 *
 * Strategy:
 * 1. Load homepage (works fine)
 * 2. Remove cookie consent overlay via JS
 * 3. Use Angular router programmatically to navigate to dental categories
 * 4. Intercept all product API responses
 */

import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const KX_SUPPLIER_ID = 2;
const PROGRESS_FILE = `${process.env.HOME}/Downloads/kx-v5.json`;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

let totalInserted = 0;
let totalMatched = 0;
const seenSkus = new Set<string>();

function loadProgress(): Set<string> {
  try {
    const d = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    return new Set(d.done ?? []);
  } catch {
    return new Set();
  }
}

function saveProgress(done: Set<string>) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ done: [...done], totalInserted, totalMatched }, null, 2));
}

function parseProducts(json: any, category: string): any[] {
  const lists = [
    json?.products, json?.searchResults?.products,
    json?.catalogProductList?.catalogProductData, json?.data?.products,
  ].filter(Array.isArray);

  const results: any[] = [];
  for (const list of lists) {
    for (const item of list) {
      const sku = String(item.productCode ?? item.code ?? item.sku ?? "").trim();
      const name = String(item.description ?? item.name ?? item.productName ?? "").trim();
      if (!name || seenSkus.has(sku || name)) continue;
      seenSkus.add(sku || name);

      let image = String(item.mediaURL ?? item.imageUrl ?? item.image ?? "").trim();
      if (image && !image.startsWith("http")) {
        image = `https://assets.kentexpress.co.uk${image}`;
      }
      results.push({
        sku, name,
        brand: String(item.manufacturerName ?? item.brand ?? "").trim(),
        category: category || String(item.categories?.[0]?.category?.[0]?.name ?? "").trim(),
        price: parseFloat(item.price ?? item.basePrice?.value ?? 0) || null,
        image: image || null,
        packSize: String(item.uom ?? item.packSize ?? "1 unit").trim(),
      });
    }
    if (results.length > 0) break;
  }
  return results;
}

async function upsertProducts(products: any[]): Promise<void> {
  for (const p of products) {
    if (!p.name) continue;
    try {
      const { data: existing } = await sb.from("dentago_products").select("id").ilike("name", p.name).limit(1);
      let productId: number;
      if (existing?.length) {
        productId = existing[0].id;
        totalMatched++;
      } else {
        const { data: np } = await sb.from("dentago_products")
          .insert({ name: p.name, brand: p.brand || null, category: p.category || null, image: p.image, pack_size: p.packSize || null })
          .select("id").single();
        if (!np) continue;
        productId = np.id;
        totalInserted++;
      }
      const { data: existingSP } = await sb.from("dentago_supplier_products").select("id")
        .eq("product_id", productId).eq("supplier_id", KX_SUPPLIER_ID).limit(1);
      if (!existingSP?.length) {
        await sb.from("dentago_supplier_products").insert({
          product_id: productId, supplier_id: KX_SUPPLIER_ID,
          sku: p.sku || null, price: p.price, stock: "in_stock", delivery: "1-3 days",
        });
      }
    } catch {}
  }
}

const DENTAL_SEARCH_PATHS = [
  // Use the searchcontent API path we found in the bundle
  // Format: /dental/[category]
  "/dental", "/dental/dental-anaesthetics", "/dental/composites-and-adhesives",
  "/dental/cements", "/dental/impression-materials", "/dental/burs",
  "/dental/hand-instruments", "/dental/endodontics", "/dental/orthodontics",
  "/dental/whitening", "/dental/infection-control", "/dental/sterilisation",
  "/dental/rotary-instruments", "/dental/preventive", "/dental/x-ray",
  "/dental/surgery", "/dental/gloves", "/dental/needles-and-syringes",
];

async function main() {
  console.log("=== Kent Express Scraper v5 (Angular Router) ===\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox",
           "--disable-web-security", "--disable-features=VizDisplayCompositor"],
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { "Accept-Language": "en-GB,en;q=0.9" },
  });

  const page = await context.newPage();
  const allProducts: any[] = [];

  // Intercept ALL JSON API responses from KX
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("api.kentexpress") && !url.includes("cd.kentexpress")) return;
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    try {
      const json = await res.json();
      const products = parseProducts(json, "");
      if (products.length > 0) {
        console.log(`  🎯 ${products.length} products from: ...${url.slice(-60)}`);
        allProducts.push(...products);
      }
    } catch {}
  });

  // Load the homepage (this is the only URL that works reliably)
  console.log("Loading homepage...");
  await page.goto("https://www.kentexpress.co.uk/", { waitUntil: "networkidle", timeout: 40000 }).catch(() => {});
  await delay(3000);

  // Remove cookie consent overlay completely
  await page.evaluate(() => {
    const el = document.getElementById("usercentrics-root");
    if (el) el.style.display = "none";
    // Also try removing via shadow DOM
    const overlay = document.querySelector("div[class*='consent'], div[id*='consent'], div[id*='cookie']");
    if (overlay) (overlay as HTMLElement).style.display = "none";
  });
  await delay(500);

  console.log(`After homepage: ${allProducts.length} products captured`);

  const done = loadProgress();

  // Try navigating via Angular router injection
  // Angular exposes its router via ng.getComponent on the root element
  for (const path of DENTAL_SEARCH_PATHS) {
    if (done.has(path)) continue;

    console.log(`\nNavigating to: ${path}`);
    const beforeCount = allProducts.length;

    try {
      // Try using Angular's router if available
      const navigated = await page.evaluate((navPath) => {
        try {
          const appElement = document.querySelector("app-root, [ng-version]");
          if (!appElement) return false;
          const ngModule = (window as any).ng;
          if (ngModule) {
            const injector = ngModule.getInjector ? ngModule.getInjector(appElement) : null;
            if (injector) {
              const Router = injector.get ? injector.get((window as any)['Router']) : null;
              if (Router?.navigate) {
                Router.navigate([navPath]);
                return true;
              }
            }
          }
          return false;
        } catch {
          return false;
        }
      }, path);

      if (!navigated) {
        // Fallback: use history.pushState and trigger popstate
        await page.evaluate((navPath) => {
          window.history.pushState({}, "", navPath);
          window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
        }, path);
      }

      await delay(4000);
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }

    const newProducts = allProducts.length - beforeCount;
    console.log(`  Captured: ${newProducts} products`);

    done.add(path);
    saveProgress(done);
    await delay(1000);
  }

  await browser.close();

  // Save all products to DB
  if (allProducts.length > 0) {
    console.log(`\nUpserting ${allProducts.length} products to DB...`);
    await upsertProducts(allProducts);
  }

  console.log(`\n=== Done ===`);
  console.log(`Total captured: ${allProducts.length} | New: ${totalInserted} | Matched: ${totalMatched}`);
}

main().catch(console.error);
