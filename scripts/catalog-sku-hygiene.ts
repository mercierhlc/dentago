import "dotenv/config";
/**
 * Catalogue hygiene for supplier SKUs and UK colour spelling.
 *
 * 1) Normalise colour spellings on dentago_products.name (grey/color/fibre…).
 * 2) Delete dentago_supplier_products rows with missing/blank SKU (cannot fulfil orders).
 * 3) For each (supplier_id, normalised SKU) with multiple rows, keep one on the best
 *    canonical product (most supplier rows + image) and merge minimum price.
 * 4) Optional: delete dentago_products with zero supplier rows (--delete-orphan-products).
 *
 * Usage:
 *   npx tsx scripts/catalog-sku-hygiene.ts --dry-run
 *   npx tsx scripts/catalog-sku-hygiene.ts --write
 *   npx tsx scripts/catalog-sku-hygiene.ts --write --delete-orphan-products
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import {
  applyUkColourSpellingToProductNames,
  consolidateDuplicateSkuRowsForSupplier,
  deleteProductsWithNoSupplierRows,
  deleteSupplierRowsWithEmptySku,
  normaliseSkuKey,
  type ProductMeta,
  type SupplierProductRow,
} from "../lib/catalog-sku-hygiene";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const dryRun = !process.argv.includes("--write");
  const skipColour = process.argv.includes("--skip-colour");
  const skipDedupe = process.argv.includes("--skip-dedupe-skus");
  const skipEmptySku = process.argv.includes("--skip-remove-empty-sku");
  const deleteOrphans = process.argv.includes("--delete-orphan-products");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key);
  const stats = {
    colour_name_rows: 0,
    empty_sku_rows_removed: 0,
    duplicate_sku_buckets: 0,
    duplicate_sku_skipped: 0,
    rows_deleted: 0,
    rows_updated: 0,
    orphan_products: 0,
  };

  if (!skipColour) {
    stats.colour_name_rows = await applyUkColourSpellingToProductNames(sb, dryRun);
    console.log(`Colour spelling normalisation (product names): ${stats.colour_name_rows} rows ${dryRun ? "would change" : "updated"}`);
  }

  if (!skipEmptySku) {
    stats.empty_sku_rows_removed = await deleteSupplierRowsWithEmptySku(sb, dryRun);
    console.log(`Supplier rows without SKU removed: ${stats.empty_sku_rows_removed}`);
  }

  if (!skipDedupe) {
    const { data: sps, error } = await sb
      .from("dentago_supplier_products")
      .select("id, product_id, supplier_id, sku, price");
    if (error) throw error;

    const rows = (sps ?? []) as SupplierProductRow[];
    const countByProduct = new Map<number, number>();
    for (const r of rows) {
      countByProduct.set(r.product_id, (countByProduct.get(r.product_id) ?? 0) + 1);
    }

    const { data: prods, error: pe } = await sb.from("dentago_products").select("id, name, image");
    if (pe) throw pe;
    const productMetaById = new Map<number, ProductMeta>();
    for (const p of prods ?? []) {
      const id = p.id as number;
      productMetaById.set(id, {
        id,
        image: (p.image as string) ?? null,
        name: (p.name as string) ?? "",
        supplier_row_count: countByProduct.get(id) ?? 0,
      });
    }

    const buckets = new Map<string, SupplierProductRow[]>();
    for (const r of rows) {
      const k = normaliseSkuKey(r.sku);
      if (!k) continue;
      const keyStr = `${r.supplier_id}::${k}`;
      const list = buckets.get(keyStr);
      if (list) list.push(r);
      else buckets.set(keyStr, [r]);
    }

    for (const [, group] of buckets) {
      if (group.length < 2) continue;
      stats.duplicate_sku_buckets++;
      if (dryRun) {
        stats.rows_deleted += group.length - 1;
        stats.rows_updated += 1;
        continue;
      }
      const res = await consolidateDuplicateSkuRowsForSupplier(sb, group, productMetaById);
      if (res.skipped) stats.duplicate_sku_skipped++;
      else {
        stats.rows_deleted += res.deleted;
        stats.rows_updated += res.updated;
      }
    }
    console.log(
      `Duplicate SKU buckets: ${stats.duplicate_sku_buckets} (${stats.duplicate_sku_skipped} skipped clashes), deleted ${stats.rows_deleted} rows, updates ${stats.rows_updated}`,
    );
  }

  if (deleteOrphans) {
    stats.orphan_products = await deleteProductsWithNoSupplierRows(sb, dryRun);
    console.log(`Products with no supplier rows ${dryRun ? "would delete" : "deleted"}: ${stats.orphan_products}`);
  }

  console.log(JSON.stringify({ dryRun, ...stats }, null, 2));

  if (!dryRun) {
    const { logEvent } = await import("../lib/events");
    await logEvent({
      event_type: "catalog_sku_hygiene_run",
      entity_type: "catalog",
      payload: stats,
      source: "catalog_sku_hygiene_script",
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
