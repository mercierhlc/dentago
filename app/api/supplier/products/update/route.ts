import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupplierFromToken } from '../../_auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH /api/supplier/products/update
export async function PATCH(request: Request) {
  const supplierId = await getSupplierFromToken(request)
  if (!supplierId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { supplierProductId, price, stock, delivery } = await request.json()

  if (!supplierProductId) {
    return NextResponse.json({ error: 'supplierProductId required' }, { status: 400 })
  }

  // Build update object with only provided fields
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (price !== undefined) {
    const parsed = parseFloat(price)
    if (isNaN(parsed) || parsed < 0) return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    updates.price = parsed
  }
  if (stock !== undefined) updates.stock = Boolean(stock)
  if (delivery !== undefined) updates.delivery = String(delivery)

  // Verify this product belongs to this supplier
  const { data, error } = await supabaseAdmin
    .from('dentago_supplier_products')
    .update(updates)
    .eq('id', supplierProductId)
    .eq('supplier_id', supplierId)
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Product not found or update failed' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
