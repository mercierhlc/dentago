/**
 * POST /api/os/log-context
 * Called at the end of every Claude session to log what happened.
 * This is how the OS stays aware across conversations.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const body = await request.json();
  const {
    summary,
    decisions_made = [],
    work_completed = [],
    open_loops = [],
    goals_touched = [],
    outreach_count = 0,
    session_type = 'conversation',
  } = body;

  if (!summary) {
    return NextResponse.json({ error: 'summary required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('context_log')
    .insert({
      summary,
      decisions_made,
      work_completed,
      open_loops,
      goals_touched,
      outreach_count,
      session_type,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also log to events table for the timeline
  await supabaseAdmin.from('events').insert({
    event_type: 'loop_completed',
    payload: { summary: summary.slice(0, 500), open_loops_count: open_loops.length },
    source: 'context_log',
  });

  return NextResponse.json({ ok: true, id: data.id });
}
