import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log("[orders/[id]] GET id:", id);

  // Accept either clinic Bearer token or admin key
  const adminKey = request.headers.get("x-admin-key") ?? "";
  const token    = request.headers.get("authorization")?.replace("Bearer ", "");

  let clinicScope: { id: string; email: string } | null = null;

  if (adminKey !== "dentago-admin-2024") {
    if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const { data: clinic, error: ce } = await supabaseAdmin
      .from("clinic_accounts")
      .select("id, email")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (ce || !clinic?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    clinicScope = { id: clinic.id, email: clinic.email ?? "" };
  }

  // Step 1: fetch order row
  const { data: order, error } = await supabaseAdmin
    .from("dentago_orders")
    .select("id, clinic_id, clinic_name, clinic_email, status, total_amount, notes, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !order) {
    console.error("[orders/[id]] order lookup failed — id:", id, "error:", error?.message ?? "no row");
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Step 2: fetch order items (plain columns only — no nested joins)
  const { data: rawItems, error: itemsError } = await supabaseAdmin
    .from("dentago_order_items")
    .select("id, sku, quantity, unit_price, pack_size, product_id, supplier_id")
    .eq("order_id", id);

  if (itemsError) console.error("[orders/[id]] items lookup failed:", itemsError.message);
  const orderItems = rawItems ?? [];

  // Step 3: resolve products + suppliers in parallel
  const productIds  = [...new Set(orderItems.map((i: any) => i.product_id).filter(Boolean))];
  const supplierIds = [...new Set(orderItems.map((i: any) => i.supplier_id).filter(Boolean))];

  const [{ data: productRows }, { data: supplierRows }] = await Promise.all([
    supabaseAdmin.from("dentago_products").select("id, name, brand, category, image")
      .in("id", productIds.length ? productIds : [0]),
    supabaseAdmin.from("dentago_suppliers").select("id, name, website")
      .in("id", supplierIds.length ? supplierIds : [0]),
  ]);

  const productMap: Record<number, any> = {};
  for (const p of productRows ?? []) productMap[p.id] = p;
  const supplierMap: Record<number, any> = {};
  for (const s of supplierRows ?? []) supplierMap[s.id] = s;

  // Verify clinic ownership — match clinic_id (modern) or clinic_accounts email (legacy rows)
  if (clinicScope) {
    const emailMatch =
      !!clinicScope.email &&
      order.clinic_email?.toLowerCase() === clinicScope.email.toLowerCase();
    const idMatch = order.clinic_id === clinicScope.id;
    if (!emailMatch && !idMatch) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  // Fetch delivery estimates
  const { data: deliveryRows } = await supabaseAdmin
    .from("dentago_supplier_products")
    .select("product_id, supplier_id, delivery")
    .in("product_id", productIds.length ? productIds : [0])
    .in("supplier_id", supplierIds.length ? supplierIds : [0]);

  const deliveryMap: Record<string, string> = {};
  for (const row of deliveryRows ?? []) {
    deliveryMap[`${row.product_id}:${row.supplier_id}`] = row.delivery;
  }

  // Shape items
  const items = orderItems.map((item: any) => {
    const product  = productMap[item.product_id]  ?? {};
    const supplier = supplierMap[item.supplier_id] ?? {};
    return {
      id:        item.id,
      sku:       item.sku,
      quantity:  item.quantity,
      unitPrice: parseFloat(item.unit_price),
      packSize:  item.pack_size,
      delivery:  deliveryMap[`${item.product_id}:${item.supplier_id}`] ?? null,
      product:  { id: product.id,  name: product.name,  brand: product.brand,  category: product.category,  image: product.image },
      supplier: { id: supplier.id, name: supplier.name, website: supplier.website },
    };
  });

  // Group by supplier
  const bySupplier: Record<string, { supplier: { id: number; name: string; website?: string }; items: typeof items; subtotal: number; delivery: string | null }> = {};
  for (const item of items) {
    const key = item.supplier.name ?? "Unknown";
    if (!bySupplier[key]) bySupplier[key] = { supplier: item.supplier, items: [], subtotal: 0, delivery: item.delivery };
    bySupplier[key].items.push(item);
    bySupplier[key].subtotal += item.unitPrice * item.quantity;
    // Use shortest delivery window found for the supplier group
    if (item.delivery && !bySupplier[key].delivery) bySupplier[key].delivery = item.delivery;
  }

  return NextResponse.json({
    id:          order.id,
    clinicName:  order.clinic_name,
    clinicEmail: order.clinic_email,
    status:      order.status,
    total:       parseFloat(order.total_amount),
    notes:       order.notes,
    createdAt:   order.created_at,
    updatedAt:   order.updated_at,
    items,
    bySupplier:  Object.values(bySupplier),
  });
}
