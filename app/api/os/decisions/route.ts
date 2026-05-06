import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('decisions')
    .select('decision, rationale, expected_outcome, tags, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ data: [] });
  }

  return NextResponse.json({ data: data ?? [] });
}
