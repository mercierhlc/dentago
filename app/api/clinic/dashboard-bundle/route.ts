import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getClinicSessionFromToken } from "@/lib/clinic-session-from-token";
import { computeParLevelAlertsDue, type ParLevelAlertInput } from "@/lib/par-level-alerts";
import { buildReorderSuggestionsFromOrderDates } from "@/lib/reorder-from-history";
import { getMainSupplierMeta } from "@/lib/main-suppliers";

/**
 * One authenticated round-trip for /dashboard — replaces 7+ parallel fetches + /api/clinic/me.
 * Keeps response shape compatible with existing dashboard state setters.
 */
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const cu = await getClinicSessionFromToken(token);
  if (!cu) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { clinicId, email, product_plan, monthly_budget, role, parent_clinic_id } = cu;

  let statsQuery = supabaseAdmin.from("dentago_orders").select("status, total_amount, created_at");
  if (email) {
    statsQuery = statsQuery.or(`clinic_id.eq.${clinicId},clinic_email.eq.${email}`);
  } else {
    statsQuery = statsQuery.eq("clinic_id", clinicId);
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthIso = monthStart.toISOString();

  const canSeeApprovals = role !== "staff";

  const reorderSince = new Date(Date.now() - 120 * 86_400_000).toISOString();

  const [
    staffReq,
    appr,
    parRows,
    favRows,
    statsOrders,
    budgetOrders,
    credRows,
    reorderOrdersRes,
    childSitesRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("clinic_staff_requests")
      .select(
        "id, product_id, product_name, quantity, note, requester_name, status, reviewed_at, created_at, dentago_products(id, name, brand, category)",
      )
      .eq("clinic_id", clinicId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    canSeeApprovals
      ? supabaseAdmin
          .from("dentago_orders")
          .select("id, total_amount")
          .eq("clinic_id", clinicId)
          .eq("approval_status", "pending_approval")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; total_amount: string }[], error: null as null }),
    supabaseAdmin
      .from("clinic_par_levels")
      .select(
        "id, product_id, par_quantity, reorder_quantity, reorder_interval_days, last_ordered_at, alert_sent_at, notes",
      )
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("clinic_favorites")
      .select("id, product_id, preferred_supplier_name, preferred_price, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    statsQuery,
    supabaseAdmin
      .from("dentago_orders")
      .select("total_amount")
      .eq("clinic_id", clinicId)
      .neq("status", "cancelled")
      .gte("created_at", monthIso),
    supabaseAdmin
      .from("supplier_credentials")
      .select("id, supplier_id, username, last_synced, created_at, suppliers(id, name)")
      .eq("clinic_id", clinicId),
    supabaseAdmin
      .from("dentago_orders")
      .select("id, created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", reorderSince)
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("clinic_accounts")
      .select("id", { count: "exact", head: true })
      .eq("parent_clinic_id", clinicId),
  ]);

  const requests = staffReq.error ? [] : (staffReq.data ?? []);
  const pendingApprovalOrders =
    appr && typeof appr === "object" && "data" in appr && Array.isArray((appr as { data: unknown }).data)
      ? ((appr as { data: { id: string; total_amount: string }[] }).data ?? [])
      : [];

  const parRaw = parRows.error ? [] : (parRows.data ?? []);
  const favRaw = favRows.error ? [] : (favRows.data ?? []);
  const allOrderRows = statsOrders.error ? [] : (statsOrders.data ?? []);
  const reorderOrders = (reorderOrdersRes.error ? [] : (reorderOrdersRes.data ?? [])) as {
    id: string;
    created_at: string;
  }[];
  const childClinicCount =
    childSitesRes.error || childSitesRes.count == null ? 0 : childSitesRes.count;

  const orderCreated: Record<string, string> = {};
  const reorderOrderIds: string[] = [];
  for (const o of reorderOrders) {
    orderCreated[o.id] = o.created_at;
    reorderOrderIds.push(o.id);
  }

  const productOrderDates = new Map<number, Date[]>();
  const CHUNK = 100;
  for (let i = 0; i < reorderOrderIds.length; i += CHUNK) {
    const slice = reorderOrderIds.slice(i, i + CHUNK);
    const { data: items } = await supabaseAdmin
      .from("dentago_order_items")
      .select("order_id, product_id")
      .in("order_id", slice);
    for (const it of items ?? []) {
      const row = it as { order_id: string; product_id: number };
      const created = orderCreated[row.order_id];
      if (!created || row.product_id == null) continue;
      if (!productOrderDates.has(row.product_id)) productOrderDates.set(row.product_id, []);
      productOrderDates.get(row.product_id)!.push(new Date(created));
    }
  }

  const reorderSuggestionsRaw = buildReorderSuggestionsFromOrderDates(productOrderDates, new Date(), {
    minOrders: 2,
  }).slice(0, 12);

  const parAsInputs: ParLevelAlertInput[] = (parRaw as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    clinic_id: clinicId,
    product_id: r.product_id as number,
    par_quantity: (r.par_quantity as number | null) ?? null,
    reorder_quantity: (r.reorder_quantity as number | null) ?? null,
    reorder_interval_days: (r.reorder_interval_days as number | null) ?? null,
    last_ordered_at: (r.last_ordered_at as string | null) ?? null,
    alert_sent_at: (r.alert_sent_at as string | null) ?? null,
  }));

  const stockAlertsDue = computeParLevelAlertsDue(parAsInputs, Date.now(), { respectAlertCooldown: false }).slice(
    0,
    20,
  );

  const productIds = new Set<number>();
  for (const r of parRaw as { product_id?: number }[]) {
    if (r.product_id) productIds.add(r.product_id);
  }
  for (const r of favRaw as { product_id?: number }[]) {
    if (r.product_id) productIds.add(r.product_id);
  }
  for (const s of reorderSuggestionsRaw) productIds.add(s.product_id);
  for (const a of stockAlertsDue) productIds.add(a.product_id);

  let productMap: Record<number, Record<string, unknown>> = {};
  if (productIds.size > 0) {
    const { data: products } = await supabaseAdmin
      .from("dentago_products")
      .select("id, name, brand, category, sku, image_url")
      .in("id", [...productIds]);
    for (const p of products ?? []) productMap[p.id as number] = p as Record<string, unknown>;
  }

  const parProduct = (pid: number) => {
    const p = productMap[pid];
    if (!p) return null;
    return {
      name: String(p.name ?? ""),
      brand: String(p.brand ?? ""),
      category: String(p.category ?? ""),
      sku: p.sku as string | undefined,
    };
  };

  const stock_alerts = stockAlertsDue.map((a) => ({
    id: a.id,
    product_id: a.product_id,
    reason: a.reason,
    days_since_order: a.daysSinceOrder ?? null,
    reorder_quantity: a.reorder_quantity ?? a.par_quantity,
    product: parProduct(a.product_id),
  }));

  const reorder_suggestions = reorderSuggestionsRaw.map((s) => ({
    product_id: s.product_id,
    typical_days_between: s.typical_days_between,
    days_since_last: s.days_since_last,
    urgency: s.urgency,
    order_count: s.order_count,
    product: parProduct(s.product_id),
  }));

  const par_levels = (parRaw as Record<string, unknown>[]).map((r) => {
    const pid = r.product_id as number;
    const last = r.last_ordered_at as string | null;
    const interval = r.reorder_interval_days as number | null;
    return {
      ...r,
      product: parProduct(pid),
      days_since_order: last ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000) : null,
      is_due:
        last && interval
          ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000) >= interval
          : false,
    };
  });

  const favProduct = (pid: number) => {
    const p = productMap[pid];
    if (!p) return null;
    return {
      name: String(p.name ?? ""),
      brand: String(p.brand ?? ""),
      category: String(p.category ?? ""),
      image_url: p.image_url as string | undefined,
    };
  };

  const favorites = (favRaw as { product_id: number }[]).map((r) => {
    const p = favProduct(r.product_id);
    return {
      ...r,
      product: p,
      dentago_products: p,
    };
  });

  const statusCounts: Record<string, number> = {};
  let revenue = 0;
  let monthRevenue = 0;
  let monthCount = 0;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  for (const r of allOrderRows as { status: string; total_amount: string; created_at: string }[]) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    const amt = parseFloat(r.total_amount || "0");
    revenue += amt;
    if (r.created_at >= startOfMonth) {
      monthRevenue += amt;
      monthCount++;
    }
  }

  const stats = {
    total: allOrderRows.length,
    revenue: parseFloat(revenue.toFixed(2)),
    monthCount,
    monthRevenue: parseFloat(monthRevenue.toFixed(2)),
    avgOrderValue: allOrderRows.length ? parseFloat((revenue / allOrderRows.length).toFixed(2)) : 0,
    byStatus: statusCounts,
    supplierBreakdown: [] as { name: string; spend: number }[],
  };

  const spendRows = budgetOrders.error ? [] : (budgetOrders.data ?? []);
  const current_month_spend = (spendRows as { total_amount?: string }[]).reduce(
    (s, o) => s + parseFloat(o.total_amount || "0"),
    0,
  );

  const credData = (credRows.error ? [] : (credRows.data ?? [])) as {
    id: string;
    username?: string;
    last_synced?: string;
    suppliers?: { name?: string } | { name?: string }[] | null;
  }[];

  const supplierNames = credData
    .map((c) => {
      const s = c.suppliers;
      const row = Array.isArray(s) ? s[0] : s;
      return row?.name;
    })
    .filter(Boolean) as string[];

  let nameToIntId: Record<string, number> = {};
  if (supplierNames.length > 0) {
    const { data: ds } = await supabaseAdmin.from("dentago_suppliers").select("id, name").in("name", supplierNames);
    for (const s of ds ?? []) nameToIntId[s.name as string] = s.id as number;
  }

  const credentials = credData.map((c) => {
    const s = c.suppliers;
    const row = Array.isArray(s) ? s[0] : s;
    const name = row?.name ?? "";
    const main = getMainSupplierMeta(name);
    return {
      id: c.id,
      supplier_id: nameToIntId[name] ?? null,
      username: c.username,
      last_synced: c.last_synced,
      dentago_suppliers: {
        id: nameToIntId[name] ?? null,
        name,
      },
      main_supplier: main
        ? { catalogue_prices: main.cataloguePrices, short_note: main.shortNote }
        : null,
    };
  });

  return NextResponse.json(
    {
      clinic: {
        id: clinicId,
        clinic_name: cu.clinicName,
        email: cu.email,
        product_plan,
        parent_clinic_id,
      },
      dso: {
        child_clinic_count: childClinicCount,
      },
      stock_alerts,
      reorder_suggestions,
      requests,
      pendingApprovals: pendingApprovalOrders,
      par_levels,
      favorites,
      budget: {
        monthly_budget: monthly_budget ?? null,
        current_month_spend,
      },
      stats,
      credentials,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
