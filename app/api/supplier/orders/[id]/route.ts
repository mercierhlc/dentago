import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupplierFromToken } from '../../_auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/supplier/orders/[id] — single order detail
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supplierId = await getSupplierFromToken(request)
  if (!supplierId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { id: orderId } = await params

  // Verify this supplier has items in this order
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('dentago_order_items')
    .select('order_id, sku, quantity, unit_price, pack_size, product_id')
    .eq('order_id', orderId)
    .eq('supplier_id', supplierId)

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('dentago_orders')
    .select('id, clinic_name, clinic_email, status, total_amount, notes, created_at, updated_at')
    .eq('id', orderId)
    .single()

  if (orderError || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Enrich items with product names
  const productIds = [...new Set(items.map((i: any) => i.product_id).filter(Boolean))]
  const { data: products } = await supabaseAdmin
    .from('dentago_products')
    .select('id, name, brand, category')
    .in('id', productIds.length ? productIds : [0])

  const productMap: Record<number, any> = {}
  for (const p of products ?? []) productMap[p.id] = p

  const enrichedItems = items.map((item: any) => ({
    ...item,
    product_name: productMap[item.product_id]?.name ?? 'Unknown',
    brand: productMap[item.product_id]?.brand ?? '',
    category: productMap[item.product_id]?.category ?? '',
  }))

  const supplierTotal = enrichedItems.reduce((s: number, i: any) => s + i.unit_price * i.quantity, 0)

  return NextResponse.json({
    order: {
      ...order,
      items: enrichedItems,
      supplier_total: supplierTotal,
    },
  })
}
