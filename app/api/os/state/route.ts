/**
 * GET /api/os/state
 * Agent-readable full OS state. Any agent queries this to understand the business.
 * Returns: goals, context_log, os_state, recent events, open loops.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const [goalsRes, contextRes, stateRes, eventsRes] = await Promise.all([
    supabaseAdmin
      .from('goals')
      .select('*')
      .eq('status', 'active')
      .order('priority', { ascending: true }),
    supabaseAdmin
      .from('context_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('os_state')
      .select('*'),
    supabaseAdmin
      .from('events')
      .select('event_type, payload, metrics, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const state: Record<string, unknown> = {};
  for (const row of stateRes.data ?? []) {
    state[row.category] = row.state;
  }

  // Aggregate open loops from recent context
  const openLoops = (contextRes.data ?? [])
    .flatMap((c: any) => c.open_loops ?? [])
    .slice(0, 20);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    os_state: state,
    active_goals: goalsRes.data ?? [],
    recent_context: contextRes.data ?? [],
    open_loops: openLoops,
    recent_events: eventsRes.data ?? [],
  });
}

/**
 * POST /api/os/state
 * Update a specific category in os_state
 */
export async function POST(request: Request) {
  const { category, state } = await request.json();
  if (!category || !state) {
    return NextResponse.json({ error: 'category and state required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('os_state')
    .upsert({ category, state, updated_at: new Date().toISOString() }, { onConflict: 'category' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
