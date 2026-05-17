/**
 * Henry Schein — import the widest practical SKU set via authenticated
 * category search + line-level pricing (same surface as the live site).
 *
 * Env (required):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   HS_IMPORT_USERNAME
 *   HS_IMPORT_PASSWORD
 *
 * Env (optional):
 *   HS_IMPORT_MAX_PAGES_PER_QUERY — cap pages per search term (default 5000)
 *   HS_IMPORT_PAGE_SIZE — default 48
 *   HS_IMPORT_PAGE_DELAY_MS — delay between pages (default 280)
 *   HS_IMPORT_TERM_DELAY_MS — delay between search terms (default 400)
 *   HS_IMPORT_PROGRESS_PATH — JSON resume file for captured SKUs
 *   HS_IMPORT_EXTRA_TERMS — extra queries, comma or newline separated
 *   HS_IMPORT_CLINIC_ID — if set, also upserts price_cache for this clinic UUID
 *   HS_IMPORT_PRUNE_UNSEEN=1 — delete HS supplier rows not seen this run (DANGEROUS on partial runs)
 *
 *   npx tsx scripts/hs-import-all-skus.ts
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  buildHenryScheinSearchQueries,
  fetchHenryScheinLineLevelPrices,
  loginHenryScheinCatalogImport,
  loginHenryScheinWithCookies,
  parseHenryScheinCatalogProduct,
  searchHenryScheinDentalGb,
  type HenryScheinAuthContext,
  type HenryScheinCatalogProduct,
} from "../lib/henry-schein-catalog-import";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const username = env("HS_IMPORT_USERNAME");
  const password = env("HS_IMPORT_PASSWORD");

  const maxPagesPerQuery = Math.max(1, parseInt(process.env.HS_IMPORT_MAX_PAGES_PER_QUERY ?? "5000", 10) || 5000);
  const pageSize = Math.max(8, parseInt(process.env.HS_IMPORT_PAGE_SIZE ?? "48", 10) || 48);
  const pageDelay = Math.max(0, parseInt(process.env.HS_IMPORT_PAGE_DELAY_MS ?? "280", 10) || 280);
  const termDelay = Math.max(0, parseInt(process.env.HS_IMPORT_TERM_DELAY_MS ?? "400", 10) || 400);
  const pruneUnseen = process.env.HS_IMPORT_PRUNE_UNSEEN === "1";
  const clinicIdForCache = process.env.HS_IMPORT_CLINIC_ID?.trim() || null;

  const progressPath =
    process.env.HS_IMPORT_PROGRESS_PATH?.trim() ||
    path.join(process.cwd(), "tmp", "hs-catalog-import-progress.json");

  const supabase = createClient(url, key);

  const { data: hsRow, error: hsErr } = await supabase
    .from("dentago_suppliers")
    .select("id, name")
    .eq("name", "Henry Schein")
    .maybeSingle();
  if (hsErr || !hsRow?.id) {
    throw new Error(`Henry Schein row not found (expect name = "Henry Schein" in dentago_suppliers): ${hsErr?.message ?? "no row"}`);
  }
  const hsDentaGoId = Number(hsRow.id);

  const { data: hsSupRow } = await supabase.from("suppliers").select("id").eq("name", "Henry Schein").maybeSingle();
  const hsSupabaseId: string | null = hsSupRow?.id ?? null;

  console.log(`Henry Schein dentago_suppliers.id = ${hsDentaGoId}`);

  const terms = buildHenryScheinSearchQueries(process.env.HS_IMPORT_EXTRA_TERMS);
  console.log(`Search queries: ${terms.length} (alphabet + stems + HS_IMPORT_EXTRA_TERMS)`);
  console.log(`Max pages per query: ${maxPagesPerQuery} | prune unseen: ${pruneUnseen}`);

  const cookiesPath = path.join(process.cwd(), "tmp", "hs-cookies.json");
  let auth: HenryScheinAuthContext;
  try {
    if (fs.existsSync(cookiesPath)) {
      console.log(`Using saved cookies from ${cookiesPath}`);
      auth = await loginHenryScheinWithCookies(cookiesPath);
    } else {
      auth = await loginHenryScheinCatalogImport(username, password);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  const captured = new Map<string, HenryScheinCatalogProduct>();
  if (fs.existsSync(progressPath)) {
    const raw = JSON.parse(fs.readFileSync(progressPath, "utf-8")) as [string, HenryScheinCatalogProduct][];
    for (const [sku, p] of raw) captured.set(sku, p);
    console.log(`Resuming — ${captured.size} SKUs in progress file`);
  }

  let queriesDone = 0;
  for (const term of terms) {
    queriesDone++;
    let pg = 0;
    let totalPages = 1;
    while (pg < totalPages) {
      const { products, totalPages: tp } = await searchHenryScheinDentalGb(term, auth, pg, pageSize, maxPagesPerQuery);
      totalPages = tp;
      if (!products.length) break;

      const ids = products.map((p) => String((p as { code?: string }).code ?? "")).filter(Boolean);
      const priceMap = new Map<string, number>();
      for (let i = 0; i < ids.length; i += 25) {
        const batch = ids.slice(i, i + 25);
        const bPrices = await fetchHenryScheinLineLevelPrices(batch, auth);
        bPrices.forEach((v, k) => priceMap.set(k, v));
        if (i + 25 < ids.length) await delay(150);
      }

      for (const item of products) {
        const parsed = parseHenryScheinCatalogProduct(item as Record<string, unknown>, priceMap);
        if (parsed) captured.set(parsed.sku, parsed);
      }

      if (queriesDone % 5 === 0 && pg === 0) {
        console.log(`[${queriesDone}/${terms.length}] "${term}" … total unique SKUs: ${captured.size}`);
      }

      pg++;
      if (pg < totalPages) await delay(pageDelay);
    }

    fs.mkdirSync(path.dirname(progressPath), { recursive: true });
    fs.writeFileSync(progressPath, JSON.stringify([...captured.entries()], null, 2));
    await delay(termDelay);
  }

  console.log(`\nCrawl finished — ${captured.size} unique SKUs. Writing to database…`);

  const { data: existingHsProds } = await supabase
    .from("dentago_supplier_products")
    .select("id, product_id, sku")
    .eq("supplier_id", hsDentaGoId);

  const skuToProductId = new Map<string, number>();
  const productIdToSupProdId = new Map<number, number>();
  for (const row of existingHsProds ?? []) {
    if (row.sku) skuToProductId.set(String(row.sku).toUpperCase(), row.product_id as number);
    productIdToSupProdId.set(row.product_id as number, row.id as number);
  }

  const foundProductIds = new Set<number>();

  // dentago_products.id has no DB-side default; assign sequential IDs client-side
  const { data: maxIdRow } = await supabase.from("dentago_products").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  let nextProductId = (maxIdRow?.id ?? 0) + 1;
  console.log(`Starting product IDs from ${nextProductId}`);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  let updatedProd = 0;
  let newProd = 0;
  let skipped = 0;
  let priceCacheRows = 0;

  const allEntries = [...captured.entries()];
  const BATCH = 50;

  for (let i = 0; i < allEntries.length; i += BATCH) {
    const chunk = allEntries.slice(i, i + BATCH);

    for (const [sku, product] of chunk) {
      if (!product.price || product.price <= 0) {
        skipped++;
        continue;
      }

      const upperSku = sku.toUpperCase();
      let productId = skuToProductId.get(upperSku);

      if (productId) {
        const { error } = await supabase.from("dentago_supplier_products").upsert(
          {
            product_id: productId,
            supplier_id: hsDentaGoId,
            price: product.price,
            stock: product.stock,
            sku,
            delivery: "1-2 working days",
            pack_size: product.packSize,
          },
          { onConflict: "product_id,supplier_id" },
        );
        if (!error) {
          updatedProd++;
          foundProductIds.add(productId);
        }
      } else {
        const newId = nextProductId++;
        const { data: newProduct, error: insertErr } = await supabase
          .from("dentago_products")
          .insert({
            id: newId,
            canonical_slug: `DG-${String(newId).padStart(10, '0')}`,
            name: product.name,
            brand: product.brand,
            category: product.category || "Consumables",
            image: product.image,
            pack_size: product.packSize,
            description: `${product.name} — available from Henry Schein UK.`,
            specs: [{ label: "SKU", value: sku }],
            similars: [],
          })
          .select("id")
          .single();

        if (!insertErr && newProduct?.id) {
          productId = newProduct.id as number;
          await supabase.from("dentago_supplier_products").insert({
            product_id: productId,
            supplier_id: hsDentaGoId,
            price: product.price,
            stock: product.stock,
            sku,
            delivery: "1-2 working days",
            pack_size: product.packSize,
          });
          skuToProductId.set(upperSku, productId);
          foundProductIds.add(productId);
          newProd++;
        } else skipped++;
      }
    }

    if (clinicIdForCache) {
      const cacheRows = chunk
        .map(([sku, product]) => {
          const pid = skuToProductId.get(sku.toUpperCase());
          if (!pid) return null;
          return {
            clinic_id: clinicIdForCache,
            product_id: String(pid),
            supplier: "Henry Schein",
            price: product.price,
            stock: product.stock,
            authenticated: true,
            fetched_at: now,
            expires_at: expiresAt,
          };
        })
        .filter(Boolean) as Record<string, unknown>[];

      if (cacheRows.length) {
        await supabase.from("price_cache").upsert(cacheRows, { onConflict: "clinic_id,product_id,supplier" });
        priceCacheRows += cacheRows.length;
      }
    }

    if (((i + BATCH) / BATCH) % 20 === 0) {
      console.log(`  DB progress ${Math.min(i + BATCH, allEntries.length)}/${allEntries.length} | new ${newProd} | up ${updatedProd}`);
    }
    await delay(40);
  }

  if (pruneUnseen) {
    const allHsProductIds = (existingHsProds ?? []).map((r) => r.product_id as number);
    const notFoundProductIds = allHsProductIds.filter((pid) => !foundProductIds.has(pid));
    console.log(`\nPrune: removing HS from ${notFoundProductIds.length} products not seen this run…`);
    for (let j = 0; j < notFoundProductIds.length; j += 100) {
      const chunk = notFoundProductIds.slice(j, j + 100);
      await supabase.from("dentago_supplier_products").delete().eq("supplier_id", hsDentaGoId).in("product_id", chunk);
    }
    if (clinicIdForCache && notFoundProductIds.length) {
      const ids = notFoundProductIds.map(String);
      for (let j = 0; j < ids.length; j += 100) {
        const chunk = ids.slice(j, j + 100);
        await supabase
          .from("price_cache")
          .delete()
          .eq("clinic_id", clinicIdForCache)
          .eq("supplier", "Henry Schein")
          .in("product_id", chunk);
      }
    }
  } else {
    console.log("\nPrune skipped (set HS_IMPORT_PRUNE_UNSEEN=1 to remove HS rows not seen this run).");
  }

  if (clinicIdForCache && hsSupabaseId) {
    await supabase
      .from("supplier_credentials")
      .update({ last_synced: now })
      .eq("clinic_id", clinicIdForCache)
      .eq("supplier_id", hsSupabaseId);
  }

  if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);

  console.log(`
Done.
  Unique SKUs crawled: ${captured.size}
  Supplier products updated: ${updatedProd}
  New dentago_products + HS rows: ${newProd}
  Skipped (DB errors / edge): ${skipped}
  price_cache rows (if clinic id set): ${priceCacheRows}
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
