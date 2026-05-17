import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminOrOsAuth } from "@/lib/admin-auth";
import { getMainSupplierMeta, mainSupplierSortKey } from "@/lib/main-suppliers";

export const dynamic = "force-dynamic";

type CatalogStatsRow = {
  supplier_id: number;
  sku_rows: number;
  pending_review: number;
  mapping_ok: number;
  mapping_blocked: number;
  missing_price: number;
  stale_rows: number;
  missing_sku?: number;
  missing_product_name?: number;
  last_row_update_at: string | null;
};

type HealthRow = {
  supplier_id: number;
  sync_status: string;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  supplier_product_count: number;
  pending_review_count: number;
  mapping_ok_count: number;
  mapping_blocked_count: number;
  missing_price_count: number;
  stale_row_count: number;
  last_row_update_at: string | null;
  updated_at: string;
};

export async function GET(request: NextRequest) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  const [{ data: suppliers, error: supErr }, { data: stats, error: statsErr }, { data: health, error: healthErr }] =
    await Promise.all([
      // `website` is optional — older DBs (e.g. minimal create-tables) may not have the column.
      supabaseAdmin.from("dentago_suppliers").select("id, name").order("id"),
      supabaseAdmin.from("supplier_ops_catalog_stats").select("*"),
      supabaseAdmin.from("supplier_catalog_health").select("*"),
    ]);

  if (supErr) return NextResponse.json({ error: supErr.message }, { status: 500 });
  if (statsErr) return NextResponse.json({ error: statsErr.message }, { status: 500 });
  if (healthErr) return NextResponse.json({ error: healthErr.message }, { status: 500 });

  const statsById = new Map<number, CatalogStatsRow>();
  for (const row of (stats ?? []) as CatalogStatsRow[]) {
    statsById.set(row.supplier_id, row);
  }

  const healthById = new Map<number, HealthRow>();
  for (const row of (health ?? []) as HealthRow[]) {
    healthById.set(row.supplier_id, row);
  }

  const { data: openExceptions, error: exErr } = await supabaseAdmin
    .from("supplier_ops_exceptions")
    .select("supplier_id")
    .eq("status", "open");

  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });

  const openBySupplier = new Map<number, number>();
  for (const row of openExceptions ?? []) {
    const sid = row.supplier_id as number | null;
    if (sid == null) continue;
    openBySupplier.set(sid, (openBySupplier.get(sid) ?? 0) + 1);
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const priceEventsBySupplier = new Map<number, number>();
  const supplierIds = (suppliers ?? []).map((s: { id: number }) => s.id);
  await Promise.all(
    supplierIds.map(async (supplierId) => {
      const { count, error } = await supabaseAdmin
        .from("dentago_price_history")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierId)
        .gte("recorded_at", since);
      if (!error && typeof count === "number") {
        priceEventsBySupplier.set(supplierId, count);
      }
    }),
  );

  const rows = (suppliers ?? []).map((s: { id: number; name: string; website?: string | null }) => {
    const live = statsById.get(s.id);
    const h = healthById.get(s.id);
    const main = getMainSupplierMeta(s.name);
    return {
      supplier: { id: s.id, name: s.name, website: s.website ?? null },
      main_supplier: main
        ? {
            catalogue_prices: main.cataloguePrices,
            short_note: main.shortNote,
          }
        : null,
      live: live ?? null,
      persisted_health: h ?? null,
      open_exceptions: openBySupplier.get(s.id) ?? 0,
      price_change_events_7d: priceEventsBySupplier.get(s.id) ?? 0,
    };
  });

  rows.sort((a, b) => {
    const ka = mainSupplierSortKey(a.supplier.name);
    const kb = mainSupplierSortKey(b.supplier.name);
    if (ka !== kb) return ka - kb;
    return a.supplier.name.localeCompare(b.supplier.name);
  });

  return NextResponse.json({ suppliers: rows });
}
