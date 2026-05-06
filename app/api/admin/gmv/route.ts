import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/admin/gmv?days=30
// Returns GMV by supplier, sourced from events table (supplier_gmv_directed events)
// Auth: X-Admin-Key header must match ADMIN_SECRET env var
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Auth
  const adminKey = request.headers.get("x-admin-key") ?? "";
  const secret = process.env.ADMIN_SECRET ?? "";
  if (!secret || adminKey !== secret) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const days = Math.max(1, parseInt(searchParams.get("days") ?? "30") || 30);
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await supabaseAdmin
    .from("events")
    .select("payload, metrics, created_at")
    .eq("event_type", "supplier_gmv_directed")
    .gte("created_at", fromDate);

  if (error) {
    console.error("[admin/gmv] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by supplier_name
  const bySupplier = new Map<string, { total_gmv: number; order_count: number }>();

  for (const ev of events ?? []) {
    const name: string = (ev.payload as any)?.supplier_name ?? "Unknown";
    const gmv: number = parseFloat((ev.metrics as any)?.gmv ?? "0") || 0;

    if (!bySupplier.has(name)) {
      bySupplier.set(name, { total_gmv: 0, order_count: 0 });
    }
    const row = bySupplier.get(name)!;
    row.total_gmv += gmv;
    row.order_count += 1;
  }

  const suppliers = [...bySupplier.entries()]
    .map(([name, row]) => ({
      name,
      total_gmv: parseFloat(row.total_gmv.toFixed(2)),
      order_count: row.order_count,
    }))
    .sort((a, b) => b.total_gmv - a.total_gmv);

  const total_gmv = parseFloat(suppliers.reduce((s, r) => s + r.total_gmv, 0).toFixed(2));

  return NextResponse.json({ suppliers, total_gmv, days, from_date: fromDate });
}
