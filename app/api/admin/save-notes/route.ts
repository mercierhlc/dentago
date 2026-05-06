import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { userId, notes } = await request.json()
  const { error } = await supabaseAdmin
    .from('clinic_profiles')
    .update({ admin_notes: notes })
    .eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
