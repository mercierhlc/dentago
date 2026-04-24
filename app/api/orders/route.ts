import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { orderConfirmationEmail, supplierOrderEmail, type OrderItem, type SupplierOrder } from "@/emails/order-confirmation";

const resend = new Resend(process.env.RESEND_API_KEY);

async function getAuthUser(request: Request): Promise<{ userId: string; clinicId: string } | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  if (!clinic) return null;
  return { userId: user.id, clinicId: clinic.id };
}

// POST /api/orders — split cart into per-supplier orders, persist, email clinic + ops
export async function POST(request: Request) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await request.json();
    const { clinicName, clinicEmail, notes, items } = body;

    if (!clinicName || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── 1. Group items by supplierId ─────────────────────────────────────────
    const bySupplier = new Map<number, { supplierName: string; items: typeof items }>();
    for (const item of items) {
      if (!bySupplier.has(item.supplierId)) {
        bySupplier.set(item.supplierId, { supplierName: item.supplierName ?? "Unknown", items: [] });
      }
      bySupplier.get(item.supplierId)!.items.push(item);
    }

    // Resolve supplier names from DB (cart page may not always pass supplierName)
    const supplierIds = [...bySupplier.keys()];
    const { data: supplierRows } = await supabaseAdmin
      .from("dentago_suppliers")
      .select("id, name")
      .in("id", supplierIds);
    const supplierNameMap: Record<number, string> = {};
    for (const row of supplierRows ?? []) supplierNameMap[row.id] = row.name;

    // Resolve product details for email rendering
    const productIds = [...new Set(items.map((i: any) => i.productId))];
    const { data: productRows } = await supabaseAdmin
      .from("dentago_products")
      .select("id, name, brand")
      .in("id", productIds);
    const productMap: Record<number, { name: string; brand: string }> = {};
    for (const row of productRows ?? []) productMap[row.id] = { name: row.name, brand: row.brand };

    // ── 2. Create one order record per supplier ──────────────────────────────
    const createdOrders: Array<{ orderId: string; supplierId: number }> = [];
    const supplierOrdersForEmail: SupplierOrder[] = [];

    for (const [supplierId, group] of bySupplier) {
      const supplierName = supplierNameMap[supplierId] ?? group.supplierName;
      const subtotal = group.items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);

      const { data: order, error: orderError } = await supabaseAdmin
        .from("dentago_orders")
        .insert({
          clinic_name:  clinicName,
          clinic_email: clinicEmail ?? null,
          notes:        notes ?? null,
          total_amount: parseFloat(subtotal.toFixed(2)),
          status:       "pending",
        })
        .select("id")
        .single();

      if (orderError || !order) {
        console.error(`Order creation error for supplier ${supplierId}:`, orderError);
        // Roll back any orders created so far
        if (createdOrders.length > 0) {
          await supabaseAdmin.from("dentago_orders").delete().in("id", createdOrders.map(o => o.orderId));
        }
        return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
      }

      const orderItems = group.items.map((item: any) => ({
        order_id:    order.id,
        product_id:  item.productId,
        supplier_id: supplierId,
        sku:         item.sku ?? "",
        quantity:    item.quantity ?? 1,
        unit_price:  item.unitPrice,
        pack_size:   item.packSize ?? null,
      }));

      const { error: itemsError } = await supabaseAdmin.from("dentago_order_items").insert(orderItems);

      if (itemsError) {
        console.error("Order items error:", itemsError);
        await supabaseAdmin.from("dentago_orders").delete().in("id", [...createdOrders.map(o => o.orderId), order.id]);
        return NextResponse.json({ error: itemsError.message ?? "Failed to save order items" }, { status: 500 });
      }

      createdOrders.push({ orderId: order.id, supplierId });

      const emailItems: OrderItem[] = group.items.map((item: any) => ({
        name:      productMap[item.productId]?.name ?? item.name ?? "Product",
        brand:     productMap[item.productId]?.brand ?? item.brand ?? "",
        packSize:  item.packSize ?? "",
        sku:       item.sku ?? null,
        quantity:  item.quantity,
        unitPrice: item.unitPrice,
      }));

      supplierOrdersForEmail.push({ supplier: supplierName, items: emailItems, subtotal });

      // ── 3a. Notify Dentago ops per supplier (acts as supplier notification
      //        until suppliers have direct accounts) ──────────────────────────
      if (clinicEmail && process.env.RESEND_API_KEY) {
        const { subject, html } = supplierOrderEmail({
          supplierName,
          clinicName,
          clinicEmail,
          orderId: order.id,
          items: emailItems,
          subtotal,
        });
        const { error: emailErr } = await resend.emails.send({
          from:    "Dentago <support@dentago.co.uk>",
          to:      "support@dentago.co.uk",
          replyTo: clinicEmail,
          subject,
          html,
        });
        if (emailErr) console.error("Supplier notification email error:", emailErr);
      }
    }

    const grandTotal = supplierOrdersForEmail.reduce((s, g) => s + g.subtotal, 0);
    // Use first order ID as the canonical reference shown to the clinic
    const primaryOrderId = createdOrders[0]?.orderId ?? "ORD-" + Date.now();

    // ── 3b. Send clinic confirmation email ───────────────────────────────────
    if (clinicEmail && process.env.RESEND_API_KEY) {
      const { subject, html } = orderConfirmationEmail({
        clinicName,
        orderId: primaryOrderId,
        supplierOrders: supplierOrdersForEmail,
        total: grandTotal,
      });
      const { error: clinicEmailErr } = await resend.emails.send({
        from:    "Dentago <support@dentago.co.uk>",
        to:      clinicEmail,
        subject,
        html,
      });
      if (clinicEmailErr) console.error("Clinic confirmation email error:", clinicEmailErr);
    }

    return NextResponse.json({
      orderId:  primaryOrderId,
      orderIds: createdOrders.map(o => o.orderId),
      total:    parseFloat(grandTotal.toFixed(2)),
      suppliers: createdOrders.length,
    }, { status: 201 });

  } catch (err) {
    console.error("Orders route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/orders — list orders (admin) with filtering, search, stats
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adminKey = request.headers.get("x-admin-key") ?? searchParams.get("key") ?? "";
  const token    = request.headers.get("authorization")?.replace("Bearer ", "");

  let clinicEmailFilter: string | null = null;

  if (adminKey !== "dentago-admin-2024") {
    // Clinic auth — only return their own orders
    if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    clinicEmailFilter = user.email ?? null;
    if (!clinicEmailFilter) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const limit     = parseInt(searchParams.get("limit") ?? "50");
  const offset    = (page - 1) * limit;
  const status    = searchParams.get("status") ?? "all";
  const search    = (searchParams.get("search") ?? "").trim();
  const dateFrom  = searchParams.get("dateFrom");
  const dateTo    = searchParams.get("dateTo");
  const statsOnly = searchParams.get("stats") === "1";

  // ── Stats snapshot ────────────────────────────────────────────────────────
  if (statsOnly) {
    let statsQuery = supabaseAdmin.from("dentago_orders").select("status, total_amount, created_at");
    if (clinicEmailFilter) statsQuery = statsQuery.eq("clinic_email", clinicEmailFilter);
    const { data: allOrders } = await statsQuery;

    const rows = allOrders ?? [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const statusCounts: Record<string, number> = {};
    let revenue = 0, monthRevenue = 0, monthCount = 0;

    for (const r of rows) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
      revenue += parseFloat(r.total_amount);
      if (r.created_at >= startOfMonth) {
        monthRevenue += parseFloat(r.total_amount);
        monthCount++;
      }
    }

    return NextResponse.json({
      total: rows.length,
      revenue: parseFloat(revenue.toFixed(2)),
      monthCount,
      monthRevenue: parseFloat(monthRevenue.toFixed(2)),
      avgOrderValue: rows.length ? parseFloat((revenue / rows.length).toFixed(2)) : 0,
      byStatus: statusCounts,
    });
  }

  // ── Build query (orders only, no nested joins) ───────────────────────────
  let query = supabaseAdmin
    .from("dentago_orders")
    .select("id, clinic_name, clinic_email, status, total_amount, notes, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (clinicEmailFilter) query = query.eq("clinic_email", clinicEmailFilter);
  if (status !== "all")  query = query.eq("status", status);
  if (search)            query = query.or(`clinic_name.ilike.%${search}%,clinic_email.ilike.%${search}%,id.ilike.%${search}%`);
  if (dateFrom)          query = query.gte("created_at", dateFrom);
  if (dateTo)            query = query.lte("created_at", dateTo + "T23:59:59");

  const { data: orders, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error("Fetch orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orderList = orders ?? [];

  // Enrich each order with its items + product/supplier names
  const enriched = await Promise.all(orderList.map(async (order: any) => {
    const { data: items } = await supabaseAdmin
      .from("dentago_order_items")
      .select("id, sku, quantity, unit_price, pack_size, product_id, supplier_id")
      .eq("order_id", order.id);

    const rows = items ?? [];
    const productIds  = [...new Set(rows.map((i: any) => i.product_id).filter(Boolean))];
    const supplierIds = [...new Set(rows.map((i: any) => i.supplier_id).filter(Boolean))];

    const [{ data: products }, { data: suppliers }] = await Promise.all([
      supabaseAdmin.from("dentago_products").select("id, name, brand, category")
        .in("id", productIds.length ? productIds : [0]),
      supabaseAdmin.from("dentago_suppliers").select("id, name")
        .in("id", supplierIds.length ? supplierIds : [0]),
    ]);

    const productMap: Record<number, any> = {};
    for (const p of products ?? []) productMap[p.id] = p;
    const supplierMap: Record<number, any> = {};
    for (const s of suppliers ?? []) supplierMap[s.id] = s;

    return {
      ...order,
      dentago_order_items: rows.map((i: any) => ({
        ...i,
        dentago_products: productMap[i.product_id] ?? null,
        dentago_suppliers: supplierMap[i.supplier_id] ?? null,
      })),
    };
  }));

  return NextResponse.json({
    orders: enriched,
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
  });
}

// PATCH /api/orders — update order status + optional clinic notification
export async function PATCH(request: Request) {
  const adminKey = request.headers.get("x-admin-key") ?? "";
  if (adminKey !== "dentago-admin-2024") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { orderId, status, notifyClinic } = await request.json();
  const validStatuses = ["pending", "confirmed", "processing", "dispatched", "delivered", "cancelled"];
  if (!orderId || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data: order, error } = await supabaseAdmin
    .from("dentago_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("id, clinic_name, clinic_email, total_amount")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send status update email to clinic if requested and email available
  if (notifyClinic && order?.clinic_email && process.env.RESEND_API_KEY) {
    const STATUS_LABELS: Record<string, string> = {
      confirmed: "confirmed", processing: "being processed",
      dispatched: "dispatched", delivered: "delivered", cancelled: "cancelled",
    };
    const label = STATUS_LABELS[status];
    if (label) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      resend.emails.send({
        from: "Dentago <support@dentago.co.uk>",
        to: order.clinic_email,
        subject: `Your order has been ${label} — Ref: ${orderId.slice(0, 8).toUpperCase()}`,
        html: `
          <div style="font-family:'Helvetica Neue',sans-serif;max-width:520px;margin:0 auto;padding:48px 24px;">
            <div style="font-size:24px;font-weight:800;color:#6C3DE8;margin-bottom:28px;">Dentago</div>
            <h2 style="font-size:20px;font-weight:800;color:#151121;margin:0 0 12px;">Order ${label}</h2>
            <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px;">
              Hi ${order.clinic_name}, your order <strong style="font-family:monospace;color:#6C3DE8;">${orderId.slice(0, 8).toUpperCase()}</strong>
              has been <strong>${label}</strong>.
            </p>
            ${status === "dispatched" ? `<p style="color:#64748b;font-size:14px;">Your items are on their way. You should receive them within the supplier's stated delivery window.</p>` : ""}
            ${status === "delivered" ? `<p style="color:#64748b;font-size:14px;">Your order has been marked as delivered. If you have any issues, please reply to this email.</p>` : ""}
            ${status === "cancelled" ? `<p style="color:#64748b;font-size:14px;">If you believe this is a mistake or have questions, please reply to this email.</p>` : ""}
            <p style="color:#94a3b8;font-size:12px;margin-top:40px;border-top:1px solid #f1f5f9;padding-top:24px;">
              Dentago Ltd · <a href="mailto:support@dentago.co.uk" style="color:#6C3DE8;">support@dentago.co.uk</a>
            </p>
          </div>`,
      }).catch(err => console.error("Status update email error:", err));
    }
  }

  return NextResponse.json({ success: true });
}
