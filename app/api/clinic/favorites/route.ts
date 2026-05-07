import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function getClinicFromToken(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

// GET /api/clinic/favorites — list all favorites with product info
export async function GET(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("clinic_favorites")
    .select("id, product_id, preferred_supplier_name, preferred_price, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const productIds = rows.map((r: any) => r.product_id).filter(Boolean);

  let productMap: Record<number, any> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from("dentago_products")
      .select("id, name, brand, category, image_url")
      .in("id", productIds);
    for (const p of products ?? []) productMap[p.id] = p;
  }

  const enriched = rows.map((r: any) => ({
    ...r,
    product: productMap[r.product_id] ?? null,
  }));

  return NextResponse.json({ favorites: enriched });
}

// POST /api/clinic/favorites — add a favorite
export async function POST(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await request.json();
  const { product_id, preferred_supplier_name, preferred_price } = body;

  if (!product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("clinic_favorites")
    .upsert(
      {
        clinic_id: clinicId,
        product_id,
        preferred_supplier_name: preferred_supplier_name ?? null,
        preferred_price: preferred_price ?? null,
      },
      { onConflict: "clinic_id,product_id" }
    )
    .select("id, product_id, preferred_supplier_name, preferred_price")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ favorite: data }, { status: 201 });
}

// DELETE /api/clinic/favorites?product_id=X — remove a favorite
export async function DELETE(request: Request) {
  const clinicId = await getClinicFromToken(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");
  if (!productId) return NextResponse.json({ error: "product_id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("clinic_favorites")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("product_id", parseInt(productId));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
