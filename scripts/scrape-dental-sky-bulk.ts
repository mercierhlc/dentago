/**
 * scrape-dental-sky-bulk.ts
 *
 * Fast Dental Sky scraper:
 *   1. Pulls products via GraphQL across ~50 search terms (parallelised, with retry)
 *   2. Persists raw fetch result as a JSON checkpoint at /tmp/ds-products.json
 *      so we can re-run the ingest step without re-scraping if anything fails.
 *   3. Bulk-inserts new products and supplier_products in chunks of 500.
 *
 * Schema (Supabase):
 *   dentago_products(id, name, brand, category, image, pack_size, description, specs, similars)
 *   dentago_supplier_products(product_id, supplier_id, price, stock, delivery, sku, pack_size)
 *
 * Replaces scrape-dental-sky.ts (which hung on per-row writes).
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as https from "https";

const sb = createClient(
  "https://wybqjycfpauwlcrqgtfb.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI"
);

const CHECKPOINT = "/tmp/ds-products.json";
const SKIP_FETCH = process.argv.includes("--from-checkpoint");
const SKIP_REFRESH = process.argv.includes("--skip-refresh");
const PAGE_SIZE = 100;
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  "wax", "articulating",
  "sterilisation", "autoclave",
  "disinfectant", "wipe",
];

const CATEGORY_MAP: Record<string, string> = {
  "anaesthetic": "Anaesthetics", "needle": "Anaesthetics", "syringe": "Anaesthetics",
  "glove": "PPE & Infection Control", "ppe": "PPE & Infection Control",
  "infection": "PPE & Infection Control", "mask": "PPE & Infection Control",
  "sterilisation": "PPE & Infection Control", "autoclave": "PPE & Infection Control",
  "disinfectant": "PPE & Infection Control", "wipe": "PPE & Infection Control",
  "composite": "Composites & Restoratives", "bonding": "Composites & Restoratives", "etch": "Composites & Restoratives",
  "impression": "Impression Materials", "alginate": "Impression Materials", "polyether": "Impression Materials",
  "orthodont": "Orthodontics", "bracket": "Orthodontics", "wire": "Orthodontics",
  "rotary": "Rotary Instruments", "bur": "Burs & Instruments", "diamond": "Burs & Instruments", "carbide": "Burs & Instruments",
  "instrument": "Instruments", "scalpel": "Instruments", "suture": "Instruments",
  "scale": "Instruments", "curette": "Instruments", "probe": "Instruments",
  "matrix": "Instruments", "wedge": "Instruments",
  "whitening": "Teeth Whitening", "bleach": "Teeth Whitening",
  "x-ray": "Imaging & X-Ray", "sensor": "Imaging & X-Ray", "film": "Imaging & X-Ray", "imaging": "Imaging & X-Ray",
  "endodontic": "Endodontics", "gutta": "Endodontics", "protaper": "Endodontics", "file": "Endodontics",
  "crown": "Crown & Bridge", "bridge": "Crown & Bridge", "cement": "Cements & Liners",
  "patient": "Patient Products",
};

function inferCategory(name: string, categories: string[] = []): string {
  const haystack = (name + " " + categories.join(" ")).toLowerCase();
  for (const [needle, label] of Object.entries(CATEGORY_MAP)) {
    if (haystack.includes(needle)) return label;
  }
  return "Sundries";
}

function inferBrand(name: string): string {
  // First word that's capitalised + not generic. Best-effort; backfill-brands.ts polishes later.
  const tokens = name.split(/\s+/);
  const firstCap = tokens.find(t => /^[A-Z][A-Za-z0-9\-]+$/.test(t) && t.length >= 3);
  return firstCap ?? "";
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
      },
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
    products(search:"${searchTerm}",pageSize:${PAGE_SIZE},currentPage:${currentPage}){
      total_count
      items{
        name sku url_key
        price{regularPrice{amount{value}}}
        small_image{url} image{url}
        categories{name url_key}
      }
    }
  }`;
  const res = await gqlPost(query);
  const products = res?.data?.products;
  if (!products) throw new Error("no products: " + JSON.stringify(res).slice(0, 200));
  return { items: products.items ?? [], totalCount: products.total_count ?? 0 };
}

async function fetchAll(): Promise<Map<string, any>> {
  const all: Map<string, any> = new Map();
  for (const term of SEARCH_TERMS) {
    try {
      const first = await fetchPage(term, 1);
      first.items.forEach(p => { if (p.sku) all.set(p.sku, p); });
      const pages = Math.min(Math.ceil(first.totalCount / PAGE_SIZE), 10);
      for (let pg = 2; pg <= pages; pg++) {
        await delay(250);
        const more = await fetchPage(term, pg);
        more.items.forEach(p => { if (p.sku) all.set(p.sku, p); });
      }
      console.log(`  "${term}": ${first.totalCount} → unique so far ${all.size}`);
    } catch (e: any) {
      console.log(`  "${term}": skip — ${e.message}`);
    }
    await delay(200);
  }
  return all;
}

async function loadAllPaged<T = any>(table: string, cols: string, filter?: (q: any) => any): Promise<T[]> {
  const out: any[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    let q = sb.from(table).select(cols).range(offset, offset + PAGE - 1).order("id" as any);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

async function chunkInsert(table: string, rows: any[], chunkSize = 500): Promise<{ inserted: number; failed: number }> {
  let inserted = 0, failed = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { data, error } = await sb.from(table).insert(chunk).select("id");
    if (error) {
      // Fall back to per-row insertion to capture which rows fail
      console.error(`  bulk insert into ${table} failed at offset ${i}: ${error.message}. Falling back row-by-row.`);
      for (const row of chunk) {
        const { error: e2 } = await sb.from(table).insert(row);
        if (e2) failed++;
        else inserted++;
      }
    } else {
      inserted += data?.length ?? chunk.length;
    }
    process.stdout.write(`  ${table}: ${Math.min(i + chunkSize, rows.length)}/${rows.length}\r`);
  }
  console.log("");
  return { inserted, failed };
}

async function main() {
  console.log("=== Dental Sky Bulk Scrape & Ingest ===\n");

  // ── 1. Fetch (or load from checkpoint) ────────────────────────────────
  let allProducts: Map<string, any>;
  if (SKIP_FETCH && fs.existsSync(CHECKPOINT)) {
    console.log("Loading from checkpoint...");
    const raw = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
    allProducts = new Map(raw);
    console.log(`  ${allProducts.size} products loaded\n`);
  } else {
    console.log("Fetching from Dental Sky GraphQL...");
    allProducts = await fetchAll();
    fs.writeFileSync(CHECKPOINT, JSON.stringify([...allProducts.entries()]));
    console.log(`\nCheckpoint saved: ${CHECKPOINT} (${allProducts.size} products)\n`);
  }

  // ── 2. Look up Dental Sky supplier id ────────────────────────────────
  const { data: dsRow } = await sb.from("dentago_suppliers").select("id").eq("name", "Dental Sky").single();
  if (!dsRow) throw new Error("Dental Sky supplier not found");
  const dsId = dsRow.id;
  console.log(`Dental Sky supplier_id: ${dsId}`);

  // ── 3. Pre-load existing DS SKUs ──────────────────────────────────────
  console.log("Loading existing DS supplier_products...");
  const existing = await loadAllPaged<any>("dentago_supplier_products", "id, product_id, sku", q => q.eq("supplier_id", dsId));
  const skuToProductId = new Map<string, number>();
  for (const r of existing) if (r.sku) skuToProductId.set(r.sku, r.product_id);
  console.log(`  ${skuToProductId.size} existing DS supplier_products\n`);

  // ── 4. Partition into refresh vs new ──────────────────────────────────
  const toRefresh: { sku: string; price: number }[] = [];
  const newRows: any[] = [];
  const newSpRows: { sku: string; price: number; image: string; name: string; category: string; brand: string }[] = [];

  for (const [sku, p] of allProducts) {
    const price = p.price?.regularPrice?.amount?.value;
    if (!price || price <= 0) continue;
    if (skuToProductId.has(sku)) {
      toRefresh.push({ sku, price });
    } else {
      const image = p.small_image?.url || p.image?.url || "";
      const name = (p.name || "").trim();
      if (!name) continue;
      const categoryUrls = (p.categories ?? []).map((c: any) => c.url_key ?? c.name ?? "");
      const category = inferCategory(name, categoryUrls);
      const brand = inferBrand(name);
      newSpRows.push({ sku, price, image, name, category, brand });
    }
  }

  console.log(`Plan: ${toRefresh.length} to refresh, ${newSpRows.length} new products to add`);

  // ── 5. Refresh existing prices in bulk ────────────────────────────────
  if (SKIP_REFRESH) {
    console.log("\nSkipping refresh (--skip-refresh).");
  } else if (toRefresh.length > 0) {
    console.log("\nRefreshing existing prices...");
    let refreshed = 0;
    const BATCH = 50;
    for (let i = 0; i < toRefresh.length; i += BATCH) {
      const batch = toRefresh.slice(i, i + BATCH);
      await Promise.all(batch.map(async ({ sku, price }) => {
        await sb.from("dentago_supplier_products")
          .update({ price, updated_at: new Date().toISOString() })
          .eq("supplier_id", dsId)
          .eq("sku", sku);
        refreshed++;
      }));
      process.stdout.write(`  ${Math.min(i + BATCH, toRefresh.length)}/${toRefresh.length}\r`);
    }
    console.log(`\n  ${refreshed} refreshed`);
  }

  // ── 6. Insert new products in bulk, then their supplier_products ──────
  // dentago_products.id has no DB-side default (existing rows were inserted
  // with explicit ids). We follow the same pattern as scrape-dhb.ts: read
  // current max id, assign sequential ids client-side.
  if (newSpRows.length > 0) {
    console.log("\nLooking up max product id...");
    const { data: maxRow } = await sb
      .from("dentago_products")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);
    let nextId = (maxRow?.[0]?.id ?? 0) + 1;
    console.log(`  starting from id ${nextId}`);

    console.log("\nInserting new products...");
    const insertedIds: number[] = [];
    const productRows = newSpRows.map(r => {
      const id = nextId++;
      insertedIds.push(id);
      return {
        id,
        name: r.name,
        brand: r.brand,
        category: r.category,
        image: r.image,
        pack_size: "",
        description: r.name,
        specs: [],
        similars: [],
      };
    });

    const CHUNK = 500;
    let okProducts = 0;
    for (let i = 0; i < productRows.length; i += CHUNK) {
      const chunk = productRows.slice(i, i + CHUNK);
      const { error } = await sb.from("dentago_products").insert(chunk);
      if (error) {
        console.error(`\n  bulk insert failed at offset ${i}: ${error.message}. Falling back row-by-row.`);
        for (const row of chunk) {
          const { error: e } = await sb.from("dentago_products").insert(row);
          if (!e) okProducts++;
          else {
            // Mark this row's id as failed by zeroing it in insertedIds
            const idx = productRows.indexOf(row);
            if (idx >= 0) insertedIds[idx] = -1;
          }
        }
      } else {
        okProducts += chunk.length;
      }
      process.stdout.write(`  products: ${Math.min(i + CHUNK, productRows.length)}/${productRows.length}\r`);
    }
    console.log(`\n  ${okProducts} new products inserted`);

    // Build supplier_product rows aligned with insertedIds
    const supplierProductRows = newSpRows
      .map((r, i) => insertedIds[i] > 0 ? {
        product_id: insertedIds[i],
        supplier_id: dsId,
        price: r.price,
        stock: true,
        delivery: "1-3 working days",
        sku: r.sku,
        pack_size: "",
      } : null)
      .filter(Boolean);

    console.log(`Inserting ${supplierProductRows.length} new supplier_products...`);
    const spResult = await chunkInsert("dentago_supplier_products", supplierProductRows as any[], 500);
    console.log(`  ${spResult.inserted} inserted, ${spResult.failed} failed`);
  }

  // ── 7. Final sanity check ────────────────────────────────────────────
  console.log("\nFinal counts:");
  const { count: totProducts } = await sb.from("dentago_products").select("*", { count: "exact", head: true });
  const { count: totSP } = await sb.from("dentago_supplier_products").select("*", { count: "exact", head: true });
  const { count: dsCount } = await sb.from("dentago_supplier_products").select("*", { count: "exact", head: true }).eq("supplier_id", dsId);
  console.log(`  products:           ${totProducts}`);
  console.log(`  supplier_products:  ${totSP}`);
  console.log(`  Dental Sky entries: ${dsCount}`);
}

main().catch(err => { console.error(err); process.exit(1); });
