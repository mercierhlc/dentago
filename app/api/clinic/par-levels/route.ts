import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

// ── Auth helper ──────────────────────────────────────────────────────────────
async function getClinicFromToken(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

// ── GET /api/clinic/par-levels ───────────────────────────────────────────────
// Returns all par levels for the authenticated clinic, enriched with product info.
export async function GET(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("clinic_par_levels")
    .select("id, product_id, par_quantity, reorder_quantity, reorder_interval_days, last_ordered_at, alert_sent_at, notes")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))];

  let productMap: Record<number, any> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from("dentago_products")
      .select("id, name, brand, category, sku")
      .in("id", productIds);
    for (const p of products ?? []) productMap[p.id] = p;
  }

  const enriched = rows.map((r: any) => ({
    ...r,
    product: productMap[r.product_id] ?? null,
    // Derive stockout risk: days since last order vs reorder interval
    days_since_order: r.last_ordered_at
      ? Math.floor((Date.now() - new Date(r.last_ordered_at).getTime()) / 86_400_000)
      : null,
    is_due: r.last_ordered_at && r.reorder_interval_days
      ? Math.floor((Date.now() - new Date(r.last_ordered_at).getTime()) / 86_400_000) >= r.reorder_interval_days
      : false,
  }));

  return NextResponse.json({ par_levels: enriched });
}

// ── POST /api/clinic/par-levels ──────────────────────────────────────────────
// Upsert a par level for a product. If one already exists for this product, update it.
export async function POST(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();
  const { product_id, par_quantity, reorder_quantity, reorder_interval_days, notes } = body;

  if (!product_id || typeof par_quantity !== "number" || par_quantity < 1) {
    return NextResponse.json({ error: "product_id and par_quantity (≥1) are required" }, { status: 400 });
  }

  const upsertData: any = {
    clinic_id: clinicId,
    product_id,
    par_quantity,
    reorder_quantity: reorder_quantity ?? par_quantity * 2,
    reorder_interval_days: reorder_interval_days ?? null,
    notes: notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("clinic_par_levels")
    .upsert(upsertData, { onConflict: "clinic_id,product_id" })
    .select("id, product_id, par_quantity, reorder_quantity, reorder_interval_days, notes")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent({
    event_type: "feature_used",
    entity_type: "clinic",
    entity_id: clinicId,
    payload: { feature: "par_level_set", product_id, par_quantity, reorder_quantity },
    source: "par_levels_api",
  });

  return NextResponse.json({ par_level: data }, { status: 201 });
}

// ── DELETE /api/clinic/par-levels ────────────────────────────────────────────
// Remove a par level by id (must belong to the clinic).
export async function DELETE(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("clinic_par_levels")
    .delete()
    .eq("id", id)
    .eq("clinic_id", clinicId); // scoped to clinic — prevents cross-tenant deletes

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
