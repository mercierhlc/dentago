import { NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { userId, status, rejection_reason } = await request.json()

  const { error } = await supabaseAdmin
    .from('clinic_profiles')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      ...(rejection_reason ? { rejection_reason } : {}),
    })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
