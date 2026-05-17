/**
 * Report dentago_supplier_products rows with no usable SKU (both sku and supplier_sku blank),
 * grouped by supplier.
 *
 *   npx tsx scripts/report-missing-offer-skus.ts
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

function isBlank(v: unknown) {
  return v == null || String(v).trim() === "";
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key);

  const bySupplier = new Map<string, number>();
  let totalMissing = 0;
  const pageSize = 1000;
  /** Cap pages so a huge catalogue scan cannot hang a laptop session (~500k rows max). */
  const maxPages = Math.max(1, parseInt(process.env.MISSING_SKU_REPORT_MAX_PAGES ?? "200", 10));
  let off = 0;

  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await sb
      .from("dentago_supplier_products")
      .select("supplier_id, sku, supplier_sku, dentago_suppliers ( name )")
      .order("id", { ascending: true })
      .range(off, off + pageSize - 1);

    if (error) {
      console.error("Query failed:", error.message);
      process.exit(1);
    }
    if (!data?.length) break;

    for (const r of data) {
      if (!isBlank(r.sku) || !isBlank(r.supplier_sku)) continue;
      totalMissing++;
      const name =
        (r as { dentago_suppliers?: { name?: string } | null }).dentago_suppliers?.name ??
        `supplier_${(r as { supplier_id: number }).supplier_id}`;
      bySupplier.set(name, (bySupplier.get(name) ?? 0) + 1);
    }

    if (data.length < pageSize) break;
    off += pageSize;
  }

  console.log(
    `Offer rows with both sku and supplier_sku empty (scanned up to ${maxPages * pageSize} rows): ${totalMissing}`,
  );
  const sorted = [...bySupplier.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, n] of sorted) console.log(`  ${n}\t${name}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
