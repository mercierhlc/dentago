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

  const { data: account } = await supabaseAdmin
    .from('supplier_accounts')
    .select('supplier_id')
    .eq('auth_user_id', user.id)
    .single()

  return account?.supplier_id ?? null
}
