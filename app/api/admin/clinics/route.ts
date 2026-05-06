import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;
  const { data: profiles, error } = await supabaseAdmin
    .from('clinic_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = (profiles ?? []).map((p: { id: string }) => p.id)

  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const { data: documents } = await supabaseAdmin.from('clinic_documents').select('*').in('user_id', userIds)
  const { data: connections } = await supabaseAdmin.from('supplier_connections').select('*').in('user_id', userIds)

  const combined = (profiles ?? []).map((profile: Record<string, unknown>) => ({
    ...profile,
    email: users?.find((u) => u.id === profile.id)?.email ?? '—',
    documents: (documents ?? []).filter((d: { user_id: string }) => d.user_id === profile.id),
    connections: (connections ?? []).filter((c: { user_id: string }) => c.user_id === profile.id),
  }))

  const emails = [...new Set(
    combined
      .map((row: Record<string, unknown>) => typeof row.email === 'string' && row.email !== '—' ? String(row.email).toLowerCase().trim() : null)
      .filter((e): e is string => Boolean(e))
  )]

  let marketingByEmail = new Map<string, boolean>()
  if (emails.length > 0) {
    const { data: crmRows } = await supabaseAdmin
      .from('contacts')
      .select('email, marketing_opt_out')
      .in('email', emails)

    marketingByEmail = new Map(
      (crmRows ?? []).map((r: { email: string; marketing_opt_out: boolean }) =>
        [String(r.email).toLowerCase().trim(), Boolean(r.marketing_opt_out)]
      )
    )
  }

  const withMarketing = combined.map((row: Record<string, unknown>) => {
    const em = typeof row.email === 'string' && row.email !== '—' ? row.email.toLowerCase().trim() : ''
    return {
      ...row,
      marketing_opt_out: em ? (marketingByEmail.get(em) ?? false) : false,
    }
  })

  return NextResponse.json(withMarketing)
}
