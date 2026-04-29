import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupplierFromToken } from '../_auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/supplier/products — fetch all SupplierProduct rows for this supplier
export async function GET(request: Request) {
  const supplierId = await getSupplierFromToken(request)
  if (!supplierId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Query dentago_supplier_products joined with dentago_products
  const { data: supplierProducts, error } = await supabaseAdmin
    .from('dentago_supplier_products')
    .select(`
      id,
      price,
      stock,
      delivery,
      sku,
      pack_size,
      updated_at,
      dentago_products (
        id,
        name,
        brand,
        category,
        image
      )
    `)
    .eq('supplier_id', supplierId)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const products = (supplierProducts ?? []).map((sp: any) => ({
    supplierProductId: sp.id,
    productId: sp.dentago_products?.id ?? null,
    name: sp.dentago_products?.name ?? 'Unknown',
    brand: sp.dentago_products?.brand ?? '',
    category: sp.dentago_products?.category ?? '',
    image: sp.dentago_products?.image ?? '',
    sku: sp.sku,
    price: sp.price,
    stock: sp.stock,
    delivery: sp.delivery,
    packSize: sp.pack_size ?? '',
  }))

  return NextResponse.json({ products })
}
