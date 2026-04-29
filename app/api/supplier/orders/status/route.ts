import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupplierFromToken } from '../../_auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled']

// PATCH /api/supplier/orders/status
export async function PATCH(request: Request) {
  const supplierId = await getSupplierFromToken(request)
  if (!supplierId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { orderId, status } = await request.json()

  if (!orderId || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Verify this supplier has items in this order
  const { data: check } = await supabaseAdmin
    .from('dentago_order_items')
    .select('order_id')
    .eq('order_id', orderId)
    .eq('supplier_id', supplierId)
    .limit(1)
    .single()

  if (!check) {
    return NextResponse.json({ error: 'Order not found for this supplier' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('dentago_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
