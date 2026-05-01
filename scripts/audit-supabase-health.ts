/**
 * Read-only health check: env, core tables, variations integrity.
 * Run: cd dentago && npx tsx scripts/audit-supabase-health.ts
 */

import { config } from "dotenv";
config({ path: ".env.local", override: false });
config({ path: ".env", override: false });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key);

type Ping = { table: string; ok: boolean; count?: number; err?: string };

async function ping(table: string): Promise<Ping> {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
  if (error) return { table, ok: false, err: error.message };
  return { table, ok: true, count: count ?? undefined };
}

const TABLES = [
  "dentago_products",
  "dentago_suppliers",
  "dentago_supplier_products",
  "dentago_orders",
  "dentago_order_items",
  "clinic_accounts",
  "clinic_suppliers",
  "carts",
  "cart_items",
  "supplier_credentials",
  "suppliers",
  "supplier_accounts",
  "price_cache",
  "leads",
  "clinic_profiles",
  "clinic_documents",
  "supplier_connections",
  "activity_logs",
  "documents",
  "dentago_price_history",
];

/** Paginated select (Supabase default max ~1000 rows per request without range). */
async function fetchAllProductVariations(sb: ReturnType<typeof createClient>) {
  const pageSize = 1000;
  let offset = 0;
  const all: { id: number; variations: number[] | null }[] = [];
  while (true) {
    const { data, error } = await sb
      .from("dentago_products")
      .select("id, variations")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...(data as typeof all));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function fetchAllSupplierProductIds(sb: ReturnType<typeof createClient>) {
  const pageSize = 1000;
  let offset = 0;
  const ids = new Set<number>();
  while (true) {
    const { data, error } = await sb
      .from("dentago_supplier_products")
      .select("product_id")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const r of data as { product_id: number }[]) ids.add(r.product_id);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return ids;
}

async function main() {
  const host = new URL(url).hostname;
  console.log("Supabase host:", host);

  const results: Ping[] = [];
  for (const t of TABLES) results.push(await ping(t));

  console.log("\n━━ Table ping (service role) ━━");
  for (const r of results) {
    const n = r.count != null ? String(r.count).padStart(8) : "";
    console.log(r.ok ? "✓" : "✗", r.table.padEnd(28), n, r.err ?? "");
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log("\n⚠ Inaccessible tables (fix schema or migrations):");
    for (const f of failed) console.log("  -", f.table, "→", f.err);
  }

  // variations
  console.log("\n━━ Variations ━━");
  let allVarRows: { id: number; variations: number[] | null }[] = [];
  let ve: Error | null = null;
  try {
    allVarRows = await fetchAllProductVariations(sb);
  } catch (e: unknown) {
    ve = e instanceof Error ? e : new Error(String(e));
  }
  const vrows = allVarRows.filter(
    (r) => Array.isArray(r.variations) && r.variations.length > 0,
  );

  if (ve) {
    console.log("✗ Cannot read variations:", ve.message);
    console.log("  (Run scripts/add-product-variations.sql if missing.)");
  } else {
    const rows = vrows as { id: number; variations: number[] | null }[];
    console.log("Products with non-empty variations:", rows.length, `(of ${allVarRows.length} products scanned)`);
    const refIds = new Set<number>();
    for (const row of rows) {
      for (const x of row.variations ?? []) {
        if (Number.isFinite(x)) refIds.add(x);
      }
    }
    const need = [...refIds];
    if (need.length === 0) {
      console.log("(No variation sibling IDs referenced.)");
    } else {
      const { data: exist, error: e2 } = await sb.from("dentago_products").select("id").in("id", need);
      if (e2) console.log("✗ Sister lookup:", e2.message);
      else {
        const have = new Set((exist ?? []).map((x: { id: number }) => x.id));
        const missing = need.filter((id) => !have.has(id));
        if (missing.length) console.log("✗ Orphan variation IDs (not in dentago_products):", missing.sort((a, b) => a - b));
        else console.log("✓ All variation sibling IDs exist");
      }
    }
  }

  console.log("\n━━ Supplier coverage (full index) ━━");
  let covered: Set<number>;
  try {
    covered = await fetchAllSupplierProductIds(sb);
  } catch (e) {
    console.log("✗ Could not enumerate supplier_products:", e);
    covered = new Set();
  }
  console.log("Distinct products with ≥1 supplier row:", covered.size);

  const { count: totalProducts } = await sb.from("dentago_products").select("*", { count: "exact", head: true });
  const total = totalProducts ?? 0;
  const noOffer = Math.max(0, total - covered.size);
  console.log("Total dentago_products:", total);
  console.log(
    noOffer === 0
      ? "✓ Every product has ≥1 supplier offer"
      : `⚠ About ${noOffer} product row(s) have no dentago_supplier_products (browse/search may omit them until priced)`,
  );

  console.log("\n━━ Summary ━━");
  console.log(failed.length === 0 ? "✓ Every listed table responds." : `✗ ${failed.length} table(s) need attention.`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
