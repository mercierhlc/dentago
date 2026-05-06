/**
 * GET  /api/admin/sku-matches  — list pending sku_match_candidates
 * POST /api/admin/sku-matches  — approve or reject a candidate
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logEvent } from "@/lib/events";

const ADMIN_SECRET = process.env.CRON_SECRET ?? "";

function isAuthorised(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${ADMIN_SECRET}` && ADMIN_SECRET.length > 0;
}

// ── GET — list pending candidates ─────────────────────────────────────────
export async function GET(req: Request) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
  const offset = (page - 1) * limit;

  const { data, count, error } = await supabaseAdmin
    .from("sku_match_candidates")
    .select("*", { count: "exact" })
    .eq("status", status)
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

// ── POST — approve or reject a candidate ──────────────────────────────────
export async function POST(req: Request) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    candidate_id?: string;
    decision?: string;
    reviewed_by?: string;
  };
  const { candidate_id, decision, reviewed_by } = body;

  if (!candidate_id || !decision || !reviewed_by) {
    return NextResponse.json(
      { error: "candidate_id, decision, and reviewed_by are required" },
      { status: 400 }
    );
  }

  if (!["approved", "rejected"].includes(decision)) {
    return NextResponse.json(
      { error: "decision must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  const { error: updateErr } = await supabaseAdmin
    .from("sku_match_candidates")
    .update({
      status:      decision,
      reviewed_by,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", candidate_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await logEvent({
    event_type: decision === "approved" ? "sku_match_approved" : "sku_match_rejected",
    entity_type: "sku_match_candidate",
    entity_id:   candidate_id,
    payload:     { candidate_id, decision, reviewed_by },
    source:      "admin_sku_matches",
  });

  return NextResponse.json({ success: true, new_status: decision });
}
