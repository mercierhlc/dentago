import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAdminIdentifier, requireAdminOrOsAuth } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: { status?: string; resolution_note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nextStatus = body.status;
  if (nextStatus !== "acknowledged" && nextStatus !== "resolved" && nextStatus !== "open") {
    return NextResponse.json({ error: "status must be open | acknowledged | resolved" }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("supplier_ops_exceptions")
    .select("id, detail")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const detail = {
    ...((existing.detail as Record<string, unknown>) ?? {}),
    ...(body.resolution_note ? { resolution_note: body.resolution_note } : {}),
  };

  const patch: Record<string, unknown> = {
    status: nextStatus,
    detail,
  };

  if (nextStatus === "resolved") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = getAdminIdentifier(request);
  }

  const { error } = await supabaseAdmin.from("supplier_ops_exceptions").update(patch).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
