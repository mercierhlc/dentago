import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('goals')
    .select('id, title, category, status, priority, target_outcome, acceptance_criteria, approaches, failure_context, agent_report, next_review_at, created_at')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ data: [] });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, status, agent_report } = body as { id?: string; status?: string; agent_report?: string };
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

  const row: { status: string; agent_report?: string } = { status };
  if (typeof agent_report === 'string' && agent_report.length > 0) row.agent_report = agent_report;

  const { error } = await supabaseAdmin.from('goals').update(row).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
