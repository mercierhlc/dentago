import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function getConnectedSupplierIds(request: Request): Promise<number[] | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  if (!clinic) return null;
  const { data: rows } = await supabaseAdmin
    .from("clinic_suppliers").select("supplier_id").eq("clinic_id", clinic.id);
  return (rows ?? []).map((r: any) => r.supplier_id);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  const { data: product, error } = await supabaseAdmin
    .from("dentago_products")
    .select(`
      id, name, brand, category, image, pack_size, description, specs, similars, created_at, updated_at,
      dentago_supplier_products (
        price, stock, delivery, sku, pack_size,
        dentago_suppliers ( id, name )
      )
    `)
    .eq("id", productId)
    .single();

  if (error || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Resolve clinic's connected suppliers (if authed)
  const connectedSupplierIds = await getConnectedSupplierIds(request);

  // Shape supplier data
  let allSupplierRows = (product.dentago_supplier_products ?? []).map((sp: any) => ({
    name:     sp.dentago_suppliers?.name ?? "Unknown",
    id:       sp.dentago_suppliers?.id,
    price:    parseFloat(sp.price),
    stock:    sp.stock,
    delivery: sp.delivery,
    sku:      sp.sku,
    packSize: sp.pack_size ?? product.pack_size,
  })).sort((a: any, b: any) => {
    if (a.stock && !b.stock) return -1;
    if (!a.stock && b.stock) return 1;
    return a.price - b.price;
  });

  // Filter to connected suppliers if clinic is authed and has connections
  const suppliers = (connectedSupplierIds !== null && connectedSupplierIds.length > 0)
    ? allSupplierRows.filter((s: any) => connectedSupplierIds.includes(s.id))
    : allSupplierRows;

  const inStockSuppliers = suppliers.filter((s: any) => s.stock);
  const bestPrice = inStockSuppliers.length
    ? Math.min(...inStockSuppliers.map((s: any) => s.price))
    : null;

  // Fetch similar products (lightweight)
  let similars: any[] = [];
  if (product.similars?.length) {
    const { data: simData } = await supabaseAdmin
      .from("dentago_products")
      .select(`
        id, name, brand, category, image, pack_size,
        dentago_supplier_products ( price, stock )
      `)
      .in("id", product.similars);

    similars = (simData ?? []).map((s: any) => {
      const inStock = s.dentago_supplier_products.filter((sp: any) => sp.stock);
      const best = inStock.length ? Math.min(...inStock.map((sp: any) => parseFloat(sp.price))) : null;
      return { id: s.id, name: s.name, brand: s.brand, category: s.category, image: s.image, packSize: s.pack_size, bestPrice: best };
    });
  }

  return NextResponse.json({
    id:          product.id,
    name:        product.name,
    brand:       product.brand,
    category:    product.category,
    image:       product.image,
    packSize:    product.pack_size,
    description: product.description,
    specs:       product.specs,
    suppliers,
    bestPrice,
    similars,
    updatedAt:   product.updated_at,
  });
}
