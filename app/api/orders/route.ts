import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/orders — create a new order
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clinicName, clinicEmail, notes, items } = body;

    if (!clinicName || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + item.unitPrice * item.quantity, 0);

    // Create the order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("dentago_orders")
      .insert({
        clinic_name: clinicName,
        clinic_email: clinicEmail ?? null,
        notes: notes ?? null,
        total_amount: totalAmount,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Order creation error:", orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    // Insert order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.productId,
      supplier_id: item.supplierId,
      sku: item.sku,
      quantity: item.quantity ?? 1,
      unit_price: item.unitPrice,
      pack_size: item.packSize ?? null,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("dentago_order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Order items error:", itemsError);
      // Rollback order
      await supabaseAdmin.from("dentago_orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });
    }

    return NextResponse.json({ orderId: order.id, total: totalAmount }, { status: 201 });
  } catch (err) {
    console.error("Orders route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/orders — list all orders (admin)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adminKey = request.headers.get("x-admin-key") ?? searchParams.get("key") ?? "";

  if (adminKey !== "dentago-admin-2024") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const page = parseInt(searchParams.get("page") ?? "1") || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  const { data: orders, error, count } = await supabaseAdmin
    .from("dentago_orders")
    .select(`
      id, clinic_name, clinic_email, status, total_amount, notes, created_at, updated_at,
      dentago_order_items (
        id, sku, quantity, unit_price, pack_size,
        dentago_products ( id, name, brand, category ),
        dentago_suppliers ( id, name )
      )
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Fetch orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    orders: orders ?? [],
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
  });
}

// PATCH /api/orders — update order status
export async function PATCH(request: Request) {
  const adminKey = request.headers.get("x-admin-key") ?? "";
  if (adminKey !== "dentago-admin-2024") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { orderId, status } = await request.json();
  const validStatuses = ["pending", "confirmed", "processing", "dispatched", "delivered", "cancelled"];
  if (!orderId || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("dentago_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
