import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  // Authenticate via Supabase
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({ email, password })

  if (authError || !authData.session) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  // Look up supplier account mapping
  const { data: account, error: accountError } = await supabaseAdmin
    .from('supplier_accounts')
    .select('supplier_id, dentago_suppliers(id, name)')
    .eq('auth_user_id', authData.user.id)
    .single()

  if (accountError || !account) {
    return NextResponse.json({ error: 'No supplier account found for this user' }, { status: 403 })
  }

  const supplier = (account as any).dentago_suppliers
  return NextResponse.json({
    session: authData.session,
    supplierId: account.supplier_id,
    supplierName: supplier?.name ?? 'Unknown',
  })
}
