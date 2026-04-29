import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupplierFromToken } from '../_auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/supplier/orders — fetch all orders that include this supplier's items
export async function GET(request: Request) {
  const supplierId = await getSupplierFromToken(request)
  if (!supplierId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Get order_items for this supplier
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('dentago_order_items')
    .select('order_id, sku, quantity, unit_price, pack_size, product_id')
    .eq('supplier_id', supplierId)

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

  if (!items || items.length === 0) {
    return NextResponse.json({ orders: [] })
  }

  // Get unique order IDs
  const orderIds = [...new Set(items.map((i: any) => i.order_id))]

  // Fetch order headers
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('dentago_orders')
    .select('id, clinic_name, clinic_email, status, total_amount, notes, created_at')
    .in('id', orderIds)
    .order('created_at', { ascending: false })

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 })

  // Fetch product names
  const productIds = [...new Set(items.map((i: any) => i.product_id).filter(Boolean))]
  const { data: products } = await supabaseAdmin
    .from('dentago_products')
    .select('id, name, brand')
    .in('id', productIds.length ? productIds : [0])

  const productMap: Record<number, { name: string; brand: string }> = {}
  for (const p of products ?? []) productMap[p.id] = p

  // Group items by order_id
  const itemsByOrder: Record<string, any[]> = {}
  for (const item of items) {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
    itemsByOrder[item.order_id].push({
      ...item,
      product_name: productMap[item.product_id]?.name ?? 'Unknown',
      brand: productMap[item.product_id]?.brand ?? '',
    })
  }

  const enriched = (orders ?? []).map((order: any) => ({
    ...order,
    items: itemsByOrder[order.id] ?? [],
    // Recalculate total for just this supplier's items
    supplier_total: (itemsByOrder[order.id] ?? []).reduce(
      (s: number, i: any) => s + i.unit_price * i.quantity, 0
    ),
  }))

  return NextResponse.json({ orders: enriched })
}
