import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { getClinicSessionFromToken } from "@/lib/clinic-session-from-token";
import { computeParLevelAlertsDue, type ParLevelAlertInput } from "@/lib/par-level-alerts";
import { buildReorderSuggestionsFromOrderDates } from "@/lib/reorder-from-history";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const session = await getClinicSessionFromToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Assistant unavailable" }, { status: 503 });
  }

  const { clinicId, clinicName, product_plan, role } = session;

  const reorderSince = new Date(Date.now() - 120 * 86_400_000).toISOString();

  const [parRes, budgetRes, pendRes, reorderOrdersRes] = await Promise.all([
    supabaseAdmin
      .from("clinic_par_levels")
      .select(
        "id, product_id, par_quantity, reorder_quantity, reorder_interval_days, last_ordered_at, alert_sent_at",
      )
      .eq("clinic_id", clinicId)
      .limit(200),
    supabaseAdmin.from("clinic_accounts").select("monthly_budget").eq("id", clinicId).maybeSingle(),
    role !== "staff"
      ? supabaseAdmin
          .from("dentago_orders")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("approval_status", "pending_approval")
      : Promise.resolve({ count: 0, error: null }),
    supabaseAdmin
      .from("dentago_orders")
      .select("id, created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", reorderSince)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const parRows = (parRes.error ? [] : (parRes.data ?? [])) as Record<string, unknown>[];
  const parAsInputs: ParLevelAlertInput[] = parRows.map((r) => ({
    id: r.id as string,
    clinic_id: clinicId,
    product_id: r.product_id as number,
    par_quantity: (r.par_quantity as number | null) ?? null,
    reorder_quantity: (r.reorder_quantity as number | null) ?? null,
    reorder_interval_days: (r.reorder_interval_days as number | null) ?? null,
    last_ordered_at: (r.last_ordered_at as string | null) ?? null,
    alert_sent_at: (r.alert_sent_at as string | null) ?? null,
  }));

  const duePar = computeParLevelAlertsDue(parAsInputs, Date.now(), { respectAlertCooldown: false });

  const reorderOrders = (reorderOrdersRes.error ? [] : (reorderOrdersRes.data ?? [])) as {
    id: string;
    created_at: string;
  }[];
  const orderCreated: Record<string, string> = {};
  const orderIds: string[] = [];
  for (const o of reorderOrders) {
    orderCreated[o.id] = o.created_at;
    orderIds.push(o.id);
  }

  const productOrderDates = new Map<number, Date[]>();
  const CHUNK = 100;
  for (let i = 0; i < orderIds.length; i += CHUNK) {
    const slice = orderIds.slice(i, i + CHUNK);
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

  const reorderTop = buildReorderSuggestionsFromOrderDates(productOrderDates, new Date(), {
    minOrders: 2,
  }).slice(0, 5);

  const productIds = [...new Set([...duePar.map((d) => d.product_id), ...reorderTop.map((r) => r.product_id)])];
  let idToName: Record<number, string> = {};
  if (productIds.length) {
    const { data: prows } = await supabaseAdmin.from("dentago_products").select("id, name").in("id", productIds);
    for (const p of prows ?? []) idToName[p.id as number] = (p.name as string) ?? "";
  }

  const dueWithNames = duePar.slice(0, 8).map((d) => ({
    product: idToName[d.product_id] || `Product #${d.product_id}`,
    reason: d.reason,
    days_since_order: d.daysSinceOrder ?? null,
  }));

  const reorderNamed = reorderTop.map((r) => ({
    product: idToName[r.product_id] || `Product #${r.product_id}`,
    urgency: r.urgency,
    days_since_last: r.days_since_last,
    typical_days_between: r.typical_days_between,
  }));

  const pendingCount =
    pendRes && typeof pendRes === "object" && "count" in pendRes ? (pendRes as { count: number | null }).count ?? 0 : 0;

  const system = `You are Dentago's procurement assistant for UK dental practices.
Practice name: "${clinicName}".
Subscription: ${product_plan === "pro" ? "Dentago Pro" : "free"}.
You advise only — you cannot place orders, change budgets, or access supplier portals.
Use clear UK English. Prefer bullet lists when listing actions.
If the user asks for live prices, tell them to use Dentago Search with their connected suppliers.
Do not invent regulatory, GDC, or clinical claims.`;

  const contextBlock = `
## Live snapshot (${new Date().toISOString()})
- Par-based reorder alerts (interval elapsed or never ordered): ${duePar.length} row(s). Top items: ${JSON.stringify(dueWithNames)}
- Heuristic reorder hints from order history (median gap between order days — not ML): ${JSON.stringify(reorderNamed)}
- Orders pending manager approval: ${pendingCount}
- Monthly budget (GBP, null if unset): ${budgetRes.data?.monthly_budget ?? "null"}
`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: `${system}\n${contextBlock}`,
    messages: [{ role: "user", content: message }],
  });

  const replyText = response.content[0]?.type === "text" ? response.content[0].text : "";

  return NextResponse.json(
    {
      reply: replyText,
      meta: {
        model: response.model,
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens,
      },
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
