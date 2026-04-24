import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function getAuthUser(request: Request): Promise<{ userId: string; clinicId: string } | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!clinic) return null;
  return { userId: user.id, clinicId: clinic.id };
}

async function getOrCreateCart(userId: string, clinicId: string): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from("carts")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("status", "active")
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from("carts")
    .insert({ clinic_id: clinicId, status: "active" })
    .select("id")
    .single();

  if (error) { console.error("Create cart error:", error); return null; }
  return created.id;
}

// GET — fetch full cart grouped by supplier
export async function GET(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const cartId = await getOrCreateCart(auth.userId, auth.clinicId);
  if (!cartId) return NextResponse.json({ error: "Failed to get cart" }, { status: 500 });

  const { data: items, error } = await supabaseAdmin
    .from("cart_items")
    .select(`
      id, quantity, unit_price, pack_size, sku, added_at,
      product_id, supplier_id,
      dentago_products ( id, name, brand, category, image, pack_size ),
      dentago_suppliers ( id, name )
    `)
    .eq("cart_id", cartId)
    .order("added_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch live stock status for every (product_id, supplier_id) pair in the cart
  const pairs = (items ?? []).map((i: any) => ({ product_id: i.product_id, supplier_id: i.supplier_id }));
  const stockMap: Record<string, boolean> = {};
  if (pairs.length > 0) {
    const productIds  = [...new Set(pairs.map(p => p.product_id))];
    const supplierIds = [...new Set(pairs.map(p => p.supplier_id))];
    const { data: stockRows } = await supabaseAdmin
      .from("dentago_supplier_products")
      .select("product_id, supplier_id, stock")
      .in("product_id", productIds)
      .in("supplier_id", supplierIds);
    for (const row of stockRows ?? []) {
      stockMap[`${row.product_id}:${row.supplier_id}`] = row.stock;
    }
  }

  const shaped = (items ?? []).map((item: any) => ({
    id:         item.id,
    productId:  item.dentago_products?.id,
    name:       item.dentago_products?.name,
    brand:      item.dentago_products?.brand,
    category:   item.dentago_products?.category,
    image:      item.dentago_products?.image,
    packSize:   item.pack_size ?? item.dentago_products?.pack_size,
    supplier:   item.dentago_suppliers?.name,
    supplierId: item.dentago_suppliers?.id,
    sku:        item.sku,
    quantity:   item.quantity,
    unitPrice:  parseFloat(item.unit_price),
    addedAt:    item.added_at,
    inStock:    stockMap[`${item.product_id}:${item.supplier_id}`] ?? true,
  }));

  // Group by supplier
  const bySupplier: Record<string, { supplier: string; items: typeof shaped; subtotal: number }> = {};
  for (const item of shaped) {
    const s = item.supplier ?? "Unknown";
    if (!bySupplier[s]) bySupplier[s] = { supplier: s, items: [], subtotal: 0 };
    bySupplier[s].items.push(item);
    bySupplier[s].subtotal += item.unitPrice * item.quantity;
  }

  const total = shaped.reduce((sum: number, i: any) => sum + i.unitPrice * i.quantity, 0);

  return NextResponse.json({
    cartId,
    items: shaped,
    bySupplier: Object.values(bySupplier),
    total: parseFloat(total.toFixed(2)),
    itemCount: shaped.length,
  });
}

// POST — add item (looks up supplier_product_id from productId + supplierId)
export async function POST(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { productId, supplierId, quantity, unitPrice } = await request.json();
  if (!productId || !supplierId || !unitPrice) {
    return NextResponse.json({ error: "productId, supplierId and unitPrice are required" }, { status: 400 });
  }

  const cartId = await getOrCreateCart(auth.userId, auth.clinicId);
  if (!cartId) return NextResponse.json({ error: "Failed to get cart" }, { status: 500 });

  // Check if item already exists in cart — if so, increment rather than replace
  const { data: existing } = await supabaseAdmin
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("product_id", productId)
    .eq("supplier_id", supplierId)
    .single();

  if (existing) {
    const { error } = await supabaseAdmin
      .from("cart_items")
      .update({ quantity: existing.quantity + (quantity ?? 1), unit_price: unitPrice })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from("cart_items")
      .insert({
        cart_id:     cartId,
        product_id:  productId,
        supplier_id: supplierId,
        quantity:    quantity ?? 1,
        unit_price:  unitPrice,
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// PATCH — update quantity
export async function PATCH(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { itemId, quantity } = await request.json();
  if (!itemId || quantity == null) return NextResponse.json({ error: "itemId and quantity required" }, { status: 400 });

  if (quantity <= 0) {
    await supabaseAdmin.from("cart_items").delete().eq("id", itemId);
  } else {
    await supabaseAdmin.from("cart_items").update({ quantity }).eq("id", itemId);
  }

  return NextResponse.json({ success: true });
}

// DELETE — remove item or clear cart
export async function DELETE(request: Request) {
  const auth = await getAuthUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { itemId, clearAll } = await request.json();

  if (clearAll) {
    const { data: cart } = await supabaseAdmin
      .from("carts").select("id").eq("clinic_id", auth.clinicId).eq("status", "active").single();
    if (cart) {
      await supabaseAdmin.from("cart_items").delete().eq("cart_id", cart.id);
    }
  } else if (itemId) {
    await supabaseAdmin.from("cart_items").delete().eq("id", itemId);
  }

  return NextResponse.json({ success: true });
}
