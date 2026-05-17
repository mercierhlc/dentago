import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminOrOsAuth } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const { data, error, count } = await supabaseAdmin
    .from("dentago_supplier_products")
    .select(
      `
      id,
      sku,
      price,
      stock,
      delivery,
      pack_size,
      product_id,
      supplier_id,
      match_confidence,
      match_method,
      match_status,
      match_notes,
      updated_at,
      created_at,
      dentago_suppliers ( id, name ),
      dentago_products ( id, name, brand, category )
    `,
      { count: "exact" },
    )
    .eq("match_status", "pending_review")
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
