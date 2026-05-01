/**
 * Dental Sky scraper via Magento 2 GraphQL API.
 * Gets all products with real prices, images, SKUs — no browser needed.
 */
import { createClient } from "@supabase/supabase-js";
import * as https from "https";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const DS_GRAPHQL = "https://www.dentalsky.com/graphql";
const PAGE_SIZE = 100;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const CATEGORY_MAP: Record<string, string> = {
  "anaesthetics": "Anaesthetics",
  "gloves": "PPE & Infection Control",
  "infection-control": "PPE & Infection Control",
  "ppe": "PPE & Infection Control",
  "composites": "Composites & Restoratives",
  "impression": "Impression Materials",
  "orthodontics": "Orthodontics",
  "rotary": "Rotary Instruments",
  "instruments": "Instruments",
  "whitening": "Teeth Whitening",
  "x-ray": "Imaging & X-Ray",
  "imaging": "Imaging & X-Ray",
  "endodontic": "Endodontics",
  "crown": "Crown & Bridge",
  "burs": "Burs & Instruments",
  "patient": "Patient Products",
  "cement": "Cements & Liners",
  "bonding": "Composites & Restoratives",
  "sterilisation": "PPE & Infection Control",
  "matrices": "Instruments",
  "paper": "Sundries",
  "sundries": "Sundries",
  "needles": "Anaesthetics",
  "syringes": "Anaesthetics",
  "sutures": "Instruments",
};

function inferCategory(name: string, categories: string[]): string {
  const combined = [name, ...categories].join(" ").toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (combined.includes(key)) return val;
  }
  return "Sundries";
}

function gqlPost(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: "www.dentalsky.com",
      path: "/graphql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      }
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body);
    req.end();
  });
}

async function fetchPage(searchTerm: string, currentPage: number): Promise<{ items: any[], totalCount: number }> {
  const query = `{
    products(search: "${searchTerm}", pageSize: ${PAGE_SIZE}, currentPage: ${currentPage}) {
      total_count
      items {
        name
        sku
        url_key
        price {
          regularPrice {
            amount { value }
          }
        }
        small_image { url }
        image { url }
        categories { name url_key }
        description { html }
      }
    }
  }`;

  const res = await gqlPost(query);
  const products = res?.data?.products;
  if (!products) throw new Error("No products in response: " + JSON.stringify(res).slice(0, 200));
  return { items: products.items ?? [], totalCount: products.total_count ?? 0 };
}

// Search terms to cover all product categories
const SEARCH_TERMS = [
  "gloves", "nitrile", "latex", "vinyl",
  "anaesthetic", "articaine", "lidocaine", "septanest",
  "composite", "bonding", "etch",
  "impression", "alginate", "polyether",
  "bur", "diamond", "carbide",
  "needle", "syringe",
  "endodontic", "gutta", "protaper", "file",
  "crown", "bridge", "cement",
  "whitening", "bleach",
  "mask", "apron", "ppe", "infection",
  "orthodontic", "bracket", "wire",
  "matrix", "wedge",
  "x-ray", "sensor", "film",
  "suture", "scalpel",
  "paper", "cotton", "gauze",
  "handpiece", "turbine",
  "scale", "curette", "probe",
  "alginate", "impression",
  "wax", "articulating",
  "sterilisation", "autoclave",
  "disinfectant", "wipe",
];

async function main() {
  console.log("=== Dental Sky GraphQL Scraper ===\n");

  // Get Dental Sky supplier ID
  const { data: dsSupplier } = await sb.from("dentago_suppliers").select("id").eq("name", "Dental Sky").single();
  const dsId = dsSupplier?.id;
  if (!dsId) { console.error("Dental Sky supplier not found"); process.exit(1); }
  console.log(`Dental Sky supplier ID: ${dsId}`);

  // Get existing DS supplier products (sku → product_id mapping)
  const { data: existingSP } = await sb
    .from("dentago_supplier_products")
    .select("product_id, sku, price")
    .eq("supplier_id", dsId);

  const skuToProductId: Record<string, number> = {};
  existingSP?.forEach((r: any) => { if (r.sku) skuToProductId[r.sku] = r.product_id; });
  console.log(`Existing DS products in DB: ${existingSP?.length}`);

  // Collect all unique products across search terms
  const allProducts: Map<string, any> = new Map(); // sku → product

  for (const term of SEARCH_TERMS) {
    try {
      const first = await fetchPage(term, 1);
      if (first.totalCount === 0) { await delay(300); continue; }

      const pages = Math.ceil(first.totalCount / PAGE_SIZE);
      first.items.forEach(p => { if (p.sku) allProducts.set(p.sku, p); });

      for (let pg = 2; pg <= Math.min(pages, 10); pg++) {
        await delay(400);
        const more = await fetchPage(term, pg);
        more.items.forEach(p => { if (p.sku) allProducts.set(p.sku, p); });
      }

      process.stdout.write(`  "${term}": ${first.totalCount} products (total unique: ${allProducts.size})\n`);
    } catch (e: any) {
      process.stdout.write(`  "${term}": error — ${e.message}\n`);
    }
    await delay(500);
  }

  console.log(`\n=== Collected ${allProducts.size} unique products. Syncing to DB... ===\n`);

  let refreshed = 0, added = 0, failed = 0;

  for (const [sku, p] of allProducts) {
    const price = p.price?.regularPrice?.amount?.value ?? 0;
    if (!price) { failed++; continue; }

    const image = p.small_image?.url || p.image?.url || "";
    const name = p.name || "";
    const categoryNames = (p.categories ?? []).map((c: any) => c.url_key ?? c.name ?? "");
    const category = inferCategory(name, categoryNames);

    try {
      if (skuToProductId[sku]) {
        // Refresh existing
        const productId = skuToProductId[sku];
        await sb.from("dentago_supplier_products")
          .update({ price, updated_at: new Date().toISOString() })
          .eq("product_id", productId)
          .eq("supplier_id", dsId);

        if (image) {
          const { data: prod } = await sb.from("dentago_products").select("image").eq("id", productId).single();
          if (!prod?.image || prod.image === "") {
            await sb.from("dentago_products").update({ image }).eq("id", productId);
          }
        }
        refreshed++;
      } else {
        // New product
        const { data: newProduct, error: insertErr } = await sb
          .from("dentago_products")
          .insert({ name, image, category, brand: "", pack_size: "" })
          .select("id")
          .single();

        if (insertErr || !newProduct) { failed++; continue; }

        await sb.from("dentago_supplier_products").insert({
          product_id: newProduct.id,
          supplier_id: dsId,
          price,
          stock: true,
          delivery: "1-3 working days",
          sku,
          pack_size: "",
        });

        skuToProductId[sku] = newProduct.id;
        added++;
      }
    } catch (e: any) {
      failed++;
    }

    if ((refreshed + added + failed) % 50 === 0) {
      console.log(`  Refreshed: ${refreshed} | Added: ${added} | Failed: ${failed}`);
    }

    await delay(50);
  }

  console.log(`\n=== Done ===`);
  console.log(`Refreshed: ${refreshed}`);
  console.log(`Added new: ${added}`);
  console.log(`Failed/skipped: ${failed}`);
  console.log(`Total DS products now: ${(existingSP?.length ?? 0) + added}`);
}

main().catch(console.error);
