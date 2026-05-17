/**
 * scrape-ds-full.ts
 *
 * Comprehensive Dental Sky catalog scraper using category-based GraphQL pagination.
 * Targets all 16k+ products by iterating through DS category IDs.
 * Inserts new products + supplier_products; refreshes prices on existing ones.
 *
 * Target: 2,000+ real-priced SKUs in dentago_supplier_products for Dental Sky.
 *
 * Run: npx tsx scripts/scrape-ds-full.ts
 * Or resume: npx tsx scripts/scrape-ds-full.ts --from-checkpoint
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as https from "https";
import { dentalSkyStoredExVatPromoFromGraphqlProduct } from "../lib/dental-sky-graphql-price";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.",
  );
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

const CHECKPOINT = "/tmp/ds-full-products.json";
const FROM_CHECKPOINT = process.argv.includes("--from-checkpoint");
const PAGE_SIZE = 100;
const MAX_PAGES_PER_CAT = 20; // 2,000 per category max
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// All Dental Sky leaf category IDs with approximate product counts
const CATEGORIES: Array<{ id: string; name: string; label: string }> = [
  { id: "1066", name: "Anaesthetics & Pharmaceuticals", label: "Anaesthetics" },
  { id: "1033", name: "Burs & Abrasives", label: "Burs & Instruments" },
  { id: "1076", name: "Cements & Liners", label: "Cements & Liners" },
  { id: "1029", name: "Clinical Workwear", label: "PPE & Infection Control" },
  { id: "1078", name: "Crowns & Bridges", label: "Crown & Bridge" },
  { id: "1051", name: "Disposables", label: "Consumables" },
  { id: "1049", name: "Endodontics", label: "Endodontics" },
  { id: "1069", name: "Dental Hand Instruments", label: "Instruments" },
  { id: "1053", name: "Handpieces & Equipment", label: "Equipment" },
  { id: "1037", name: "Impression Materials", label: "Impression Materials" },
  { id: "1058", name: "Infection Control", label: "PPE & Infection Control" },
  { id: "1031", name: "Oral Hygiene", label: "Patient Products" },
  { id: "1035", name: "Restoratives", label: "Composites & Restoratives" },
  { id: "1040", name: "Orthodontics", label: "Orthodontics" },
  { id: "1071", name: "Surgery & Implantology", label: "Surgery & Implants" },
  { id: "1218", name: "Whitening", label: "Teeth Whitening" },
  { id: "1047", name: "X-Ray Materials", label: "Imaging & X-Ray" },
];

function gqlPost(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request(
      {
        hostname: "www.dentalsky.com",
        path: "/graphql",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.write(body);
    req.end();
  });
}

async function fetchCategoryPage(
  categoryId: string,
  page: number
): Promise<{ items: any[]; totalCount: number }> {
  const query = `{
    products(
      filter:{category_id:{eq:"${categoryId}"}}
      pageSize:${PAGE_SIZE}
      currentPage:${page}
    ){
      total_count
      items{
        name sku __typename
        stock_status
        price{ regularPrice{ amount{ value }}}
        price_range{ minimum_price{ regular_price{ value } final_price{ value }}}
        small_image{ url } image{ url }
        categories{ name url_key }
      }
    }
  }`;
  const res = await gqlPost(query);
  const products = res?.data?.products;
  if (!products) throw new Error("no products: " + JSON.stringify(res).slice(0, 200));
  return { items: products.items ?? [], totalCount: products.total_count ?? 0 };
}

function inferCategory(catLabel: string, productName: string): string {
  const n = productName.toLowerCase();
  if (n.includes("glove") || n.includes("mask") || n.includes("apron")) return "PPE & Infection Control";
  if (n.includes("anaesth") || n.includes("articaine") || n.includes("lidocaine")) return "Anaesthetics";
  return catLabel;
}

async function loadAllPaged<T = any>(
  table: string,
  cols: string,
  filter?: (q: any) => any
): Promise<T[]> {
  const out: any[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    let q = sb
      .from(table)
      .select(cols)
      .range(offset, offset + PAGE - 1)
      .order("id" as any);
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

async function main() {
  console.log("=== Dental Sky Full Catalog Scrape ===\n");

  // ── 1. Fetch or load from checkpoint ──────────────────────────────────
  let allProducts: Map<string, any>;

  if (FROM_CHECKPOINT && fs.existsSync(CHECKPOINT)) {
    console.log("Loading from checkpoint...");
    const raw = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
    allProducts = new Map(raw);
    console.log(`  ${allProducts.size} products loaded from checkpoint\n`);
  } else {
    allProducts = new Map();

    for (const { id: catId, name: catName, label } of CATEGORIES) {
      console.log(`\nFetching category: ${catName} (id=${catId})`);
      let catAdded = 0;
      let retries = 0;

      try {
        const first = await fetchCategoryPage(catId, 1);
        const totalPages = Math.min(
          Math.ceil(first.totalCount / PAGE_SIZE),
          MAX_PAGES_PER_CAT
        );
        console.log(`  total: ${first.totalCount}, pages: ${totalPages}`);

        for (const p of first.items) {
          if (p.sku) {
            allProducts.set(p.sku, { ...p, _label: label });
            catAdded++;
          }
        }

        for (let pg = 2; pg <= totalPages; pg++) {
          await delay(300);
          try {
            const more = await fetchCategoryPage(catId, pg);
            for (const p of more.items) {
              if (p.sku && !allProducts.has(p.sku)) {
                allProducts.set(p.sku, { ...p, _label: label });
                catAdded++;
              }
            }
            process.stdout.write(
              `  page ${pg}/${totalPages} (unique total: ${allProducts.size})\r`
            );
          } catch (e: any) {
            retries++;
            console.log(`  page ${pg} error: ${e.message} — skipping`);
            await delay(1000);
          }
        }
      } catch (e: any) {
        console.log(`  Error fetching category ${catId}: ${e.message}`);
      }

      console.log(
        `  ${catName}: ${catAdded} new, total unique: ${allProducts.size}`
      );
      await delay(400);
    }

    // Save checkpoint
    fs.writeFileSync(CHECKPOINT, JSON.stringify([...allProducts.entries()]));
    console.log(`\nCheckpoint saved: ${allProducts.size} unique products\n`);
  }

  // ── 2. Get Dental Sky supplier ID ─────────────────────────────────────
  const { data: dsRow } = await sb
    .from("dentago_suppliers")
    .select("id")
    .eq("name", "Dental Sky")
    .single();
  if (!dsRow) throw new Error("Dental Sky supplier not found");
  const dsId = dsRow.id;
  console.log(`Dental Sky supplier_id: ${dsId}`);

  // ── 3. Load existing DS SKUs ───────────────────────────────────────────
  console.log("Loading existing DS SKUs...");
  const existing = await loadAllPaged<any>(
    "dentago_supplier_products",
    "id, product_id, sku, price",
    (q) => q.eq("supplier_id", dsId)
  );
  const skuToProductId = new Map<string, number>();
  for (const r of existing) if (r.sku) skuToProductId.set(r.sku, r.product_id);
  console.log(`  ${skuToProductId.size} existing DS SKUs\n`);

  // ── 4. Partition: refresh vs new ──────────────────────────────────────
  const toRefresh: { sku: string; price: number }[] = [];
  const toInsert: {
    sku: string;
    price: number;
    name: string;
    image: string;
    category: string;
  }[] = [];

  let zeroPriceCount = 0;
  for (const [sku, p] of allProducts) {
    const price = dentalSkyStoredExVatPromoFromGraphqlProduct(p);
    if (!price || price <= 0) { zeroPriceCount++; continue; }
    const name = (p.name || "").trim();
    if (!name) continue;

    if (skuToProductId.has(sku)) {
      toRefresh.push({ sku, price });
    } else {
      const image = p.small_image?.url || p.image?.url || "";
      const category = inferCategory(p._label ?? "Sundries", name);
      toInsert.push({ sku, price, name, image, category });
    }
  }

  console.log(`Products with no price (skipped): ${zeroPriceCount}`);
  console.log(
    `Plan: ${toRefresh.length} to refresh, ${toInsert.length} new to add`
  );

  // ── 5. Refresh existing prices ────────────────────────────────────────
  if (toRefresh.length > 0) {
    console.log("\nRefreshing existing prices...");
    const BATCH = 50;
    let refreshed = 0;
    for (let i = 0; i < toRefresh.length; i += BATCH) {
      const batch = toRefresh.slice(i, i + BATCH);
      await Promise.all(
        batch.map(({ sku, price }) =>
          sb
            .from("dentago_supplier_products")
            .update({ price, updated_at: new Date().toISOString() })
            .eq("supplier_id", dsId)
            .eq("sku", sku)
        )
      );
      refreshed += batch.length;
      process.stdout.write(`  ${refreshed}/${toRefresh.length}\r`);
    }
    console.log(`\n  ${refreshed} prices refreshed`);
  }

  // ── 6. Insert new products + supplier_products ────────────────────────
  if (toInsert.length > 0) {
    console.log("\nLooking up max product id...");
    const { data: maxRow } = await sb
      .from("dentago_products")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);
    let nextId = (maxRow?.[0]?.id ?? 0) + 1;
    console.log(`  starting at id ${nextId}`);

    // Build product rows
    const productRows = toInsert.map((r, i) => ({
      id: nextId + i,
      name: r.name,
      brand: "",
      category: r.category,
      image: r.image,
      pack_size: "",
      description: r.name,
      specs: [],
      similars: [],
    }));

    // Bulk insert products in 500-row chunks
    console.log(`\nInserting ${productRows.length} new products...`);
    const successIds: number[] = [];
    const CHUNK = 500;
    for (let i = 0; i < productRows.length; i += CHUNK) {
      const chunk = productRows.slice(i, i + CHUNK);
      const { data, error } = await sb
        .from("dentago_products")
        .insert(chunk)
        .select("id");
      if (error) {
        // Row-by-row fallback
        console.error(`\n  bulk insert error at offset ${i}: ${error.message}`);
        for (const row of chunk) {
          const { error: e2 } = await sb.from("dentago_products").insert(row);
          if (!e2) successIds.push(row.id);
        }
      } else {
        for (const d of data ?? []) successIds.push(d.id);
      }
      process.stdout.write(
        `  products: ${Math.min(i + CHUNK, productRows.length)}/${productRows.length}\r`
      );
    }
    console.log(`\n  ${successIds.length} products inserted`);

    // Build supplier_product rows only for successfully-inserted products
    const successIdSet = new Set(successIds);
    const spRows = toInsert
      .map((r, i) => {
        const id = nextId + i;
        if (!successIdSet.has(id)) return null;
        return {
          product_id: id,
          supplier_id: dsId,
          price: r.price,
          stock: true,
          delivery: "1-3 working days",
          sku: r.sku,
          pack_size: "",
        };
      })
      .filter(Boolean) as any[];

    console.log(`Inserting ${spRows.length} supplier_products...`);
    let spInserted = 0;
    for (let i = 0; i < spRows.length; i += CHUNK) {
      const chunk = spRows.slice(i, i + CHUNK);
      const { data, error } = await sb
        .from("dentago_supplier_products")
        .insert(chunk)
        .select("id");
      if (error) {
        console.error(`\n  sp bulk insert error at offset ${i}: ${error.message}`);
        for (const row of chunk) {
          const { error: e2 } = await sb
            .from("dentago_supplier_products")
            .insert(row);
          if (!e2) spInserted++;
        }
      } else {
        spInserted += data?.length ?? chunk.length;
      }
      process.stdout.write(`  sp: ${Math.min(i + CHUNK, spRows.length)}/${spRows.length}\r`);
    }
    console.log(`\n  ${spInserted} supplier_products inserted`);
  }

  // ── 7. Final counts ───────────────────────────────────────────────────
  console.log("\n=== Final Counts ===");
  const { count: totProducts } = await sb
    .from("dentago_products")
    .select("*", { count: "exact", head: true });
  const { count: totSP } = await sb
    .from("dentago_supplier_products")
    .select("*", { count: "exact", head: true });
  const { count: dsCount } = await sb
    .from("dentago_supplier_products")
    .select("*", { count: "exact", head: true })
    .eq("supplier_id", dsId)
    .gt("price", 0);

  const { data: uniqueCheck } = await sb
    .from("dentago_supplier_products")
    .select("product_id")
    .eq("supplier_id", dsId)
    .gt("price", 0);
  const uniqueProds = new Set(uniqueCheck?.map((r) => r.product_id)).size;

  console.log(`  Total products:           ${totProducts}`);
  console.log(`  Total supplier_products:  ${totSP}`);
  console.log(`  DS priced entries:        ${dsCount}`);
  console.log(`  DS unique products:       ${uniqueProds}`);
  console.log(uniqueProds >= 2000 ? "\n✅ Goal achieved: 2,000+ real-priced DS products!" : `\n⚠ Need ${2000 - uniqueProds} more products`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
