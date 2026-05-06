import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { clinicId, action, details } = await request.json()
  const { error } = await supabaseAdmin.from('activity_logs').insert({ clinic_id: clinicId, action, details })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { searchParams } = new URL(request.url)
  const clinicId = searchParams.get('clinicId')
  const { data, error } = await supabaseAdmin
    .from('activity_logs')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('performed_at', { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
