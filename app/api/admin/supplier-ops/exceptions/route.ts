import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAdminIdentifier, requireAdminOrOsAuth } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = new Set(["open", "acknowledged", "resolved"]);

export async function GET(request: NextRequest) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";
  if (!ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

  const { data, error } = await supabaseAdmin
    .from("supplier_ops_exceptions")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  let body: {
    kind: string;
    severity?: string;
    supplier_id?: number | null;
    supplier_product_id?: number | null;
    product_id?: number | null;
    title: string;
    detail?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.kind || !body?.title) {
    return NextResponse.json({ error: "kind and title required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("supplier_ops_exceptions")
    .insert({
      kind: body.kind,
      severity: body.severity ?? "medium",
      supplier_id: body.supplier_id ?? null,
      supplier_product_id: body.supplier_product_id ?? null,
      product_id: body.product_id ?? null,
      title: body.title,
      detail: body.detail ?? {},
      status: "open",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data?.id, created_by: getAdminIdentifier(request) });
}
