import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('kpi_snapshots')
    .select('snapshot_date, kpis')
    .order('snapshot_date', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ data: [] });
  }

  return NextResponse.json({ data: data ?? [] });
}
