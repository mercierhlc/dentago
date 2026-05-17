import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function getClinicId(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

// GET /api/clinic/analytics — spend analytics for the authenticated clinic
export async function GET(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Query orders for this clinic
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("dentago_orders")
    .select("id, total_amount, created_at, status")
    .eq("clinic_id", clinicId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (ordersError) {
    console.error("[clinic/analytics] orders query error:", ordersError);
    // Return zeroes gracefully if table doesn't exist yet
    return NextResponse.json(emptyAnalytics());
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json(emptyAnalytics());
  }

  const orderIds = orders.map((o: any) => o.id);

  // Query order items with supplier and product info
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("dentago_order_items")
    .select("order_id, unit_price, quantity, supplier_id, product_id")
    .in("order_id", orderIds);

  if (itemsError) {
    console.error("[clinic/analytics] items query error:", itemsError);
    return NextResponse.json(emptyAnalytics());
  }

  const allItems = items ?? [];

  // Resolve supplier names
  const supplierIds = [...new Set(allItems.map((i: any) => i.supplier_id).filter(Boolean))];
  const productIds  = [...new Set(allItems.map((i: any) => i.product_id).filter(Boolean))];

  const [{ data: supplierRows }, { data: productRows }] = await Promise.all([
    supplierIds.length
      ? supabaseAdmin.from("dentago_suppliers").select("id, name").in("id", supplierIds)
      : Promise.resolve({ data: [] }),
    productIds.length
      ? supabaseAdmin.from("dentago_products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [] }),
  ]);

  const supplierMap: Record<number, string> = {};
  for (const s of supplierRows ?? []) supplierMap[s.id] = s.name;

  const productMap: Record<number, string> = {};
  for (const p of productRows ?? []) productMap[p.id] = p.name;

  // Total spend
  const total_spend = parseFloat(
    orders.reduce((s: number, o: any) => s + parseFloat(o.total_amount ?? "0"), 0).toFixed(2)
  );

  // Spend by supplier — aggregate from items
  const supplierSpend = new Map<string, { total: number; order_count: Set<string> }>();
  for (const item of allItems) {
    const name = supplierMap[(item as any).supplier_id] ?? "Unknown";
    const lineValue = parseFloat((item as any).unit_price ?? "0") * ((item as any).quantity ?? 1);
    if (!supplierSpend.has(name)) supplierSpend.set(name, { total: 0, order_count: new Set() });
    const row = supplierSpend.get(name)!;
    row.total += lineValue;
    row.order_count.add((item as any).order_id);
  }

  const spend_by_supplier = [...supplierSpend.entries()]
    .map(([supplier, row]) => ({
      supplier,
      total: parseFloat(row.total.toFixed(2)),
      order_count: row.order_count.size,
    }))
    .sort((a, b) => b.total - a.total);

  // Spend by month — last 6 months
  const now = new Date();
  const monthTotals = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" }); // "Jan 2026"
    monthTotals.set(label, 0);
  }

  for (const order of orders) {
    const d = new Date((order as any).created_at);
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    if (monthTotals.has(label)) {
      monthTotals.set(label, (monthTotals.get(label) ?? 0) + parseFloat((order as any).total_amount ?? "0"));
    }
  }

  const spend_by_month = [...monthTotals.entries()].map(([month, total]) => ({
    month,
    total: parseFloat(total.toFixed(2)),
  }));

  // Top products
  const productSpend = new Map<string, { total: number; order_count: Set<string> }>();
  for (const item of allItems) {
    const name = productMap[(item as any).product_id] ?? "Unknown Product";
    const lineValue = parseFloat((item as any).unit_price ?? "0") * ((item as any).quantity ?? 1);
    if (!productSpend.has(name)) productSpend.set(name, { total: 0, order_count: new Set() });
    const row = productSpend.get(name)!;
    row.total += lineValue;
    row.order_count.add((item as any).order_id);
  }

  const top_products = [...productSpend.entries()]
    .map(([name, row]) => ({
      name,
      total_spend: parseFloat(row.total.toFixed(2)),
      order_count: row.order_count.size,
    }))
    .sort((a, b) => b.total_spend - a.total_spend)
    .slice(0, 10);

  // savings_vs_list — pull from clinic_savings_log if rows exist,
  // otherwise estimate from price_cache: compare order item prices against
  // the highest price in price_cache for the same product.
  let savings_vs_list = 0;
  let savings_pct = 0;

  const { data: savingsLog } = await supabaseAdmin
    .from("clinic_savings_log")
    .select("saving_amount")
    .eq("clinic_id", clinicId);

  if (savingsLog && savingsLog.length > 0) {
    savings_vs_list = parseFloat(
      savingsLog.reduce((s: number, r: any) => s + (parseFloat(r.saving_amount ?? "0") || 0), 0).toFixed(2)
    );
  } else if (productIds.length > 0) {
    // Estimate: for each order item, look up the max price across all suppliers in price_cache
    const { data: priceRows } = await supabaseAdmin
      .from("price_cache")
      .select("product_id, price")
      .in("product_id", productIds);

    const maxPriceByProduct = new Map<number, number>();
    for (const row of priceRows ?? []) {
      const cur = maxPriceByProduct.get(row.product_id) ?? 0;
      if (row.price > cur) maxPriceByProduct.set(row.product_id, row.price);
    }

    let totalPaid = 0;
    let totalMarket = 0;
    for (const item of allItems) {
      const paid = parseFloat((item as any).unit_price ?? "0");
      const qty = (item as any).quantity ?? 1;
      const market = maxPriceByProduct.get((item as any).product_id) ?? 0;
      if (market > paid && market > 0) {
        savings_vs_list += (market - paid) * qty;
        totalPaid += paid * qty;
        totalMarket += market * qty;
      }
    }
    savings_vs_list = parseFloat(savings_vs_list.toFixed(2));
    if (totalMarket > 0) {
      savings_pct = parseFloat(((totalMarket - totalPaid) / totalMarket * 100).toFixed(1));
    }
  }

  // Overall savings % from savings log if available
  if (savings_vs_list > 0 && savings_pct === 0) {
    savings_pct = parseFloat(((savings_vs_list / (total_spend + savings_vs_list)) * 100).toFixed(1));
  }

  return NextResponse.json({
    total_spend,
    spend_by_supplier,
    spend_by_month,
    savings_vs_list,
    savings_pct,
    top_products,
  });
}

function emptyAnalytics() {
  const now = new Date();
  const spend_by_month = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    spend_by_month.push({ month, total: 0 });
  }
  return {
    total_spend: 0,
    spend_by_supplier: [],
    spend_by_month,
    savings_vs_list: 0,
    savings_pct: 0,
    top_products: [],
  };
}
