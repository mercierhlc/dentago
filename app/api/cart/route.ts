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

async function getOrCreateCart(clinicId: string): Promise<string | null> {
  // Try to get existing cart
  const { data: existing } = await supabaseAdmin
    .from("carts")
    .select("id")
    .eq("clinic_id", clinicId)
    .single();

  if (existing) return existing.id;

  // Create new cart
  const { data: created, error } = await supabaseAdmin
    .from("carts")
    .insert({ clinic_id: clinicId })
    .select("id")
    .single();

  if (error) return null;
  return created.id;
}

// GET — fetch full cart with items
export async function GET(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const cartId = await getOrCreateCart(clinicId);
  if (!cartId) return NextResponse.json({ error: "Failed to get cart" }, { status: 500 });

  const { data: items, error } = await supabaseAdmin
    .from("cart_items")
    .select(`
      id, quantity, unit_price, pack_size, sku, added_at,
      dentago_products ( id, name, brand, category, image, pack_size ),
      dentago_suppliers ( id, name )
    `)
    .eq("cart_id", cartId)
    .order("added_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
  }));

  const total = shaped.reduce((sum: number, i: any) => sum + i.unitPrice * i.quantity, 0);

  return NextResponse.json({ items: shaped, total, cartId });
}

// POST — add or update an item
export async function POST(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { productId, supplierId, quantity, unitPrice, packSize, sku } = await request.json();
  if (!productId || !supplierId || !unitPrice) {
    return NextResponse.json({ error: "productId, supplierId and unitPrice are required" }, { status: 400 });
  }

  const cartId = await getOrCreateCart(clinicId);
  if (!cartId) return NextResponse.json({ error: "Failed to get cart" }, { status: 500 });

  const { error } = await supabaseAdmin
    .from("cart_items")
    .upsert({
      cart_id:    cartId,
      product_id: productId,
      supplier_id: supplierId,
      quantity:   quantity ?? 1,
      unit_price: unitPrice,
      pack_size:  packSize ?? null,
      sku:        sku ?? null,
    }, { onConflict: "cart_id,product_id,supplier_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update cart timestamp
  await supabaseAdmin
    .from("carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", cartId);

  return NextResponse.json({ success: true }, { status: 201 });
}

// PATCH — update quantity for a cart item
export async function PATCH(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { itemId, quantity } = await request.json();
  if (!itemId || quantity == null) return NextResponse.json({ error: "itemId and quantity required" }, { status: 400 });

  if (quantity <= 0) {
    await supabaseAdmin.from("cart_items").delete().eq("id", itemId);
  } else {
    await supabaseAdmin.from("cart_items").update({ quantity }).eq("id", itemId);
  }

  return NextResponse.json({ success: true });
}

// DELETE — remove a single item or clear the whole cart
export async function DELETE(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { itemId, clearAll } = await request.json();

  if (clearAll) {
    const { data: cart } = await supabaseAdmin
      .from("carts").select("id").eq("clinic_id", clinicId).single();
    if (cart) {
      await supabaseAdmin.from("cart_items").delete().eq("cart_id", cart.id);
    }
  } else if (itemId) {
    await supabaseAdmin.from("cart_items").delete().eq("id", itemId);
  }

  return NextResponse.json({ success: true });
}
