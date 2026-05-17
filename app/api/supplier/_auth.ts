import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getSupplierFromToken(request: Request): Promise<number | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  // Try supplier_users first (v2 table), fall back to supplier_accounts (legacy)
  const { data: suUser } = await supabaseAdmin
    .from('supplier_users')
    .select('supplier_id')
    .eq('auth_user_id', user.id)
    .single()

  if (suUser) return suUser.supplier_id

  const { data: account } = await supabaseAdmin
    .from('supplier_accounts')
    .select('supplier_id')
    .eq('auth_user_id', user.id)
    .single()

  return account?.supplier_id ?? null
}

export async function getSupplierUser(request: Request): Promise<{ supplierId: number; userId: string } | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null

  const { data: suUser } = await supabaseAdmin
    .from('supplier_users')
    .select('supplier_id')
    .eq('auth_user_id', user.id)
    .single()

  if (suUser) return { supplierId: suUser.supplier_id, userId: user.id }

  const { data: account } = await supabaseAdmin
    .from('supplier_accounts')
    .select('supplier_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!account) return null
  return { supplierId: account.supplier_id, userId: user.id }
}
