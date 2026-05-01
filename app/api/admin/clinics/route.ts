import { NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
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

  return NextResponse.json(combined)
}
