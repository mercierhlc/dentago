import { NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { userId, deactivate } = await request.json()

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: deactivate ? '876000h' : 'none',
  })

  await supabaseAdmin
    .from('clinic_profiles')
    .update({ is_deactivated: deactivate })
    .eq('id', userId)

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
