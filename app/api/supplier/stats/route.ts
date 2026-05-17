import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupplierFromToken } from '../_auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/supplier/stats — summary stats for this supplier's orders
export async function GET(request: Request) {
  const supplierId = await getSupplierFromToken(request)
  if (!supplierId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Get all order items for this supplier
  const { data: items, error } = await supabaseAdmin
    .from('dentago_order_items')
    .select('order_id, unit_price, quantity, supplier_id')
    .eq('supplier_id', supplierId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items || items.length === 0) {
    return NextResponse.json({ totalOrders: 0, totalRevenue: 0, statusBreakdown: {}, recentOrders: [] })
  }

  const orderIds = [...new Set(items.map((i: any) => i.order_id))]

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from('dentago_orders')
    .select('id, status, created_at, clinic_name')
    .in('id', orderIds)
    .order('created_at', { ascending: false })

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 })

  // Revenue per order from this supplier's items
  const revenueByOrder: Record<string, number> = {}
  for (const item of items) {
    revenueByOrder[item.order_id] = (revenueByOrder[item.order_id] ?? 0) + item.unit_price * item.quantity
  }

  const totalRevenue = Object.values(revenueByOrder).reduce((s, v) => s + v, 0)

  const statusBreakdown: Record<string, number> = {}
  for (const o of orders ?? []) {
    statusBreakdown[o.status] = (statusBreakdown[o.status] ?? 0) + 1
  }

  // Last 5 orders with revenue
  const recentOrders = (orders ?? []).slice(0, 5).map((o: any) => ({
    id: o.id,
    clinicName: o.clinic_name,
    status: o.status,
    revenue: revenueByOrder[o.id] ?? 0,
    createdAt: o.created_at,
  }))

  return NextResponse.json({
    totalOrders: orderIds.length,
    totalRevenue,
    statusBreakdown,
    recentOrders,
  })
}
