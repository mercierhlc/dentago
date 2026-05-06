/**
 * SKU Match Clinical Review Queue
 *
 * GET  /api/admin/sku-review          — list pending matches, paginated
 * POST /api/admin/sku-review          — approve or reject a match
 *
 * Threshold logic (see supabase/migrations/20260504_sku_match_confidence.sql):
 *   match_confidence >= 85  → auto-approved on ingest
 *   match_confidence 60–84  → pending_review (this queue)
 *   match_confidence < 60   → unmatched (not shown in search)
 *   NULL (legacy rows)      → treated as approved in search
 *
 * Safety rationale: a wrong SKU match shows fake savings on a
 * different product — worst case a clinical incident (wrong
 * material ordered). This queue gives a human a chance to catch
 * cross-category or specification mismatches.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

const ADMIN_SECRET = process.env.CRON_SECRET ?? "";

function isAuthorised(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${ADMIN_SECRET}` && ADMIN_SECRET.length > 0;
}

// ── GET — list the review queue ────────────────────────────────────────────
export async function GET(req: Request) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending_review";
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
  const offset = (page - 1) * limit;

  const { data, count, error } = await supabaseAdmin
    .from("dentago_supplier_products")
    .select(
      `
      id, sku, price, pack_size,
      match_confidence, match_status, match_method, match_notes,
      match_reviewed_by, match_reviewed_at,
      created_at,
      dentago_products ( id, name, brand, category, description ),
      dentago_suppliers ( id, name )
      `,
      { count: "exact" }
    )
    .eq("match_status", status)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
    status,
  });
}

// ── POST — approve or reject a match ──────────────────────────────────────
export async function POST(req: Request) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { supplier_product_id, decision, reason, reviewed_by } = body;

  if (!supplier_product_id || !decision || !reviewed_by) {
    return NextResponse.json(
      { error: "supplier_product_id, decision, and reviewed_by are required" },
      { status: 400 }
    );
  }

  if (!["approved", "rejected"].includes(decision)) {
    return NextResponse.json(
      { error: "decision must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  // Fetch the row so we can snapshot it into the audit log
  const { data: sp, error: fetchErr } = await supabaseAdmin
    .from("dentago_supplier_products")
    .select(`
      id, sku, price, product_id,
      match_confidence, match_method,
      dentago_products ( name ),
      dentago_suppliers ( id, name )
    `)
    .eq("id", supplier_product_id)
    .single();

  if (fetchErr || !sp) {
    return NextResponse.json(
      { error: fetchErr?.message ?? "supplier_product not found" },
      { status: 404 }
    );
  }

  const newStatus = decision === "approved" ? "approved" : "rejected";

  // 1. Update the supplier_product row
  const { error: updateErr } = await supabaseAdmin
    .from("dentago_supplier_products")
    .update({
      match_status:        newStatus,
      match_method:        decision === "approved" ? "admin_approved" : sp.match_method,
      match_notes:         reason ?? null,
      match_reviewed_by:   reviewed_by,
      match_reviewed_at:   new Date().toISOString(),
    })
    .eq("id", supplier_product_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 2. Write to the audit log
  await supabaseAdmin.from("sku_match_review_log").insert({
    supplier_product_id,
    product_id:                  sp.product_id,
    supplier_id:                 (sp as any).dentago_suppliers?.id,
    sku:                         sp.sku,
    match_confidence_at_review:  sp.match_confidence,
    match_method_at_review:      sp.match_method,
    decision,
    reason:                      reason ?? null,
    reviewed_by,
    canonical_name:              (sp as any).dentago_products?.name ?? null,
    supplier_name:               (sp as any).dentago_suppliers?.name ?? null,
  });

  // 3. OS event
  await logEvent({
    event_type: decision === "approved" ? "sku_match_approved" : "sku_match_rejected",
    entity_type: "product",
    entity_id: String(sp.product_id),
    payload: {
      supplier_product_id,
      sku:              sp.sku,
      confidence:       sp.match_confidence,
      reviewed_by,
      reason:           reason ?? null,
      canonical_name:   (sp as any).dentago_products?.name ?? null,
      supplier_name:    (sp as any).dentago_suppliers?.name ?? null,
    },
    source: "admin_sku_review",
  }).catch(() => {});

  return NextResponse.json({ success: true, new_status: newStatus });
}
