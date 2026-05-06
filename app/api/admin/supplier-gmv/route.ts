import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/admin/supplier-gmv?period=month|week|all&key=...
// Returns GMV directed to each supplier, derived from dentago_order_items + dentago_orders
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adminKey = request.headers.get("x-admin-key") ?? searchParams.get("key") ?? "";
  if (adminKey !== "dentago-admin-2024") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const period = searchParams.get("period") ?? "month";

  let fromDate: string | null = null;
  const now = new Date();
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    fromDate = d.toISOString();
  } else if (period === "month") {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  // Fetch order items with their order date and supplier info
  let query = supabaseAdmin
    .from("dentago_order_items")
    .select("supplier_id, unit_price, quantity, order_id, dentago_orders!inner(created_at, status), dentago_suppliers(name)");

  if (fromDate) {
    query = query.gte("dentago_orders.created_at", fromDate);
  }

  const { data: items, error } = await query;

  if (error) {
    console.error("supplier-gmv query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by supplier
  const bySupplier = new Map<number, { supplier_id: number; supplier_name: string; gmv: number; order_count: Set<string>; items_count: number }>();

  for (const item of items ?? []) {
    const sid = item.supplier_id as number;
    const name = (item.dentago_suppliers as any)?.name ?? `Supplier ${sid}`;
    const lineValue = (item.unit_price as number) * (item.quantity as number);

    if (!bySupplier.has(sid)) {
      bySupplier.set(sid, { supplier_id: sid, supplier_name: name, gmv: 0, order_count: new Set(), items_count: 0 });
    }
    const row = bySupplier.get(sid)!;
    row.gmv += lineValue;
    row.order_count.add(item.order_id as string);
    row.items_count++;
  }

  const rows = [...bySupplier.values()]
    .map(r => ({
      supplier_id: r.supplier_id,
      supplier_name: r.supplier_name,
      gmv: parseFloat(r.gmv.toFixed(2)),
      order_count: r.order_count.size,
      items_count: r.items_count,
    }))
    .sort((a, b) => b.gmv - a.gmv);

  const totalGmv = rows.reduce((s, r) => s + r.gmv, 0);

  return NextResponse.json({
    period,
    from_date: fromDate,
    total_gmv: parseFloat(totalGmv.toFixed(2)),
    suppliers: rows,
  });
}
