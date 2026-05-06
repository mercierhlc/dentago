import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const { data: profiles } = await supabaseAdmin.from('clinic_profiles').select('id, practice_name, status')
  const { data: documents } = await supabaseAdmin.from('clinic_documents').select('user_id')
  const { data: connections } = await supabaseAdmin.from('supplier_connections').select('user_id')

  const profileIds = new Set(profiles?.map((p) => p.id))
  const docIds = new Set(documents?.map((d) => d.user_id))
  const connIds = new Set(connections?.map((c) => c.user_id))

  const tracker = (users ?? []).map((user) => {
    const profile = profiles?.find((p) => p.id === user.id)
    let lastStep = 1
    if (profileIds.has(user.id)) lastStep = 2
    if (profileIds.has(user.id) && docIds.has(user.id)) lastStep = 3
    if (profileIds.has(user.id) && docIds.has(user.id) && connIds.has(user.id)) lastStep = 4

    return {
      id: user.id,
      email: user.email,
      practice_name: profile?.practice_name ?? null,
      status: profile?.status ?? null,
      last_step_completed: lastStep,
      signed_up_at: user.created_at,
    }
  })

  return NextResponse.json(tracker)
}
