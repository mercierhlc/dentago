import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminAuth } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const unauth = requireAdminAuth(request);
  if (unauth) return unauth;

  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get('clinicId');

  let query = supabaseAdmin
    .from('verification_audit')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(100);

  if (clinicId) query = query.eq('clinic_id', clinicId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
