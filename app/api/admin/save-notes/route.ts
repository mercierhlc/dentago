import { NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { userId, notes } = await request.json()
  const { error } = await supabaseAdmin
    .from('clinic_profiles')
    .update({ admin_notes: notes })
    .eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
