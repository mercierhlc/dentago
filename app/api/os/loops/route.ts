import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('loop_runs')
    .select('loop_name, status, kpis_measured, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    // Table may not exist yet
    return NextResponse.json({ data: [] });
  }

  return NextResponse.json({ data: data ?? [] });
}
