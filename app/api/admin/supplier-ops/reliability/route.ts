import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminOrOsAuth } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  const { searchParams } = new URL(request.url);
  const supplierId = searchParams.get("supplier_id");
  let q = supabaseAdmin
    .from("supplier_reliability_snapshots")
    .select("supplier_id, period_end, metrics, created_at")
    .order("period_end", { ascending: false })
    .limit(60);

  if (supplierId) {
    const id = parseInt(supplierId, 10);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid supplier_id" }, { status: 400 });
    q = q.eq("supplier_id", id);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}
