import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminOrOsAuth } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Recomputes persisted `supplier_catalog_health` counters from the live
 * `supplier_ops_catalog_stats` view and ensures every supplier has a shell row.
 */
export async function POST(request: NextRequest) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  const { data: stats, error: statsErr } = await supabaseAdmin.from("supplier_ops_catalog_stats").select("*");
  if (statsErr) return NextResponse.json({ error: statsErr.message }, { status: 500 });

  const rows = (stats ?? []).map((r: Record<string, unknown>) => ({
    supplier_id: r.supplier_id as number,
    supplier_product_count: r.sku_rows as number,
    pending_review_count: r.pending_review as number,
    mapping_ok_count: r.mapping_ok as number,
    mapping_blocked_count: r.mapping_blocked as number,
    missing_price_count: r.missing_price as number,
    stale_row_count: r.stale_rows as number,
    last_row_update_at: (r.last_row_update_at as string | null) ?? null,
  }));

  if (rows.length) {
    const { error: upsertErr } = await supabaseAdmin.from("supplier_catalog_health").upsert(rows, {
      onConflict: "supplier_id",
    });
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  const { data: suppliers, error: supErr } = await supabaseAdmin.from("dentago_suppliers").select("id");
  if (supErr) return NextResponse.json({ error: supErr.message }, { status: 500 });

  const { data: existingHealth } = await supabaseAdmin.from("supplier_catalog_health").select("supplier_id");
  const have = new Set((existingHealth ?? []).map((h: { supplier_id: number }) => h.supplier_id));
  const missing = (suppliers ?? []).filter((s: { id: number }) => !have.has(s.id));

  if (missing.length) {
    const { error: insertErr } = await supabaseAdmin
      .from("supplier_catalog_health")
      .insert(missing.map((s: { id: number }) => ({ supplier_id: s.id, sync_status: "unknown" })));
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated_from_stats: rows.length, shell_rows_added: missing.length });
}
