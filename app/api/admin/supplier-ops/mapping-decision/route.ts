import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAdminIdentifier, requireAdminOrOsAuth } from "@/lib/admin-auth";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * Approve or reject a supplier SKU → canonical mapping (same behaviour as
 * POST /api/admin/sku-review, but gated with admin session cookie).
 */
export async function POST(request: NextRequest) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  let body: { supplier_product_id?: number; decision?: string; reason?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supplier_product_id = body.supplier_product_id;
  const decision = body.decision;
  const reviewed_by = getAdminIdentifier(request);

  if (!supplier_product_id || !decision) {
    return NextResponse.json(
      { error: "supplier_product_id and decision are required" },
      { status: 400 },
    );
  }

  if (!["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const { data: sp, error: fetchErr } = await supabaseAdmin
    .from("dentago_supplier_products")
    .select(
      `
      id, sku, price, product_id, supplier_id,
      match_confidence, match_method,
      dentago_products ( name ),
      dentago_suppliers ( id, name )
    `,
    )
    .eq("id", supplier_product_id)
    .single();

  if (fetchErr || !sp) {
    return NextResponse.json({ error: fetchErr?.message ?? "supplier_product not found" }, { status: 404 });
  }

  const newStatus = decision === "approved" ? "approved" : "rejected";

  const { error: updateErr } = await supabaseAdmin
    .from("dentago_supplier_products")
    .update({
      match_status: newStatus,
      match_method: decision === "approved" ? "admin_approved" : sp.match_method,
      match_notes: body.reason ?? null,
      match_reviewed_by: reviewed_by,
      match_reviewed_at: new Date().toISOString(),
    })
    .eq("id", supplier_product_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const spAny = sp as Record<string, unknown> & {
    product_id: number;
    supplier_id: number;
    sku: string;
    match_confidence: number | null;
    match_method: string | null;
    dentago_products?: { name?: string } | null;
    dentago_suppliers?: { id?: number; name?: string } | null;
  };

  const supplierIdForLog = spAny.dentago_suppliers?.id ?? spAny.supplier_id;

  await supabaseAdmin.from("sku_match_review_log").insert({
    supplier_product_id,
    product_id: sp.product_id,
    supplier_id: supplierIdForLog,
    sku: sp.sku,
    match_confidence_at_review: sp.match_confidence,
    match_method_at_review: sp.match_method,
    decision,
    reason: body.reason ?? null,
    reviewed_by,
    canonical_name: spAny.dentago_products?.name ?? null,
    supplier_name: spAny.dentago_suppliers?.name ?? null,
  });

  await logEvent({
    event_type: decision === "approved" ? "sku_match_approved" : "sku_match_rejected",
    entity_type: "product",
    entity_id: String(sp.product_id),
    payload: {
      supplier_product_id,
      sku: sp.sku,
      confidence: sp.match_confidence,
      reviewed_by,
      reason: body.reason ?? null,
      canonical_name: spAny.dentago_products?.name ?? null,
      supplier_name: spAny.dentago_suppliers?.name ?? null,
    },
    source: "supplier_ops_mapping_decision",
  }).catch(() => {});

  return NextResponse.json({ success: true, new_status: newStatus });
}
