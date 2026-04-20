import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  'https://wybqjycfpauwlcrqgtfb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI'
)

export async function GET() {
  const { data: profiles, error } = await supabase
    .from('clinic_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = profiles.map((p: { id: string }) => p.id)

  const { data: { users } } = await supabase.auth.admin.listUsers()
  const { data: documents } = await supabase.from('clinic_documents').select('*').in('user_id', userIds)
  const { data: connections } = await supabase.from('supplier_connections').select('*').in('user_id', userIds)

  const combined = profiles.map((profile: Record<string, unknown>) => ({
    ...profile,
    email: users?.find((u) => u.id === profile.id)?.email ?? '—',
    documents: (documents ?? []).filter((d: { user_id: string }) => d.user_id === profile.id),
    connections: (connections ?? []).filter((c: { user_id: string }) => c.user_id === profile.id),
  }))

  return NextResponse.json(combined)
}
