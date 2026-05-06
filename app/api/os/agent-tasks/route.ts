import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logEvent } from '@/lib/events';

/** Founder / oversight: record QA score and optionally resolve queue status. OS cookie required via middleware. */
export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, qa_score, qa_notes, qa_passed, apply_status } = body as {
    id?: string;
    qa_score?: number;
    qa_notes?: string;
    qa_passed?: boolean;
    apply_status?: boolean;
  };

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const score = Number(qa_score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return NextResponse.json({ error: 'qa_score must be 0–100' }, { status: 400 });
  }

  const passed = Boolean(qa_passed);
  const shouldApplyStatus = apply_status !== false;
  const notes = typeof qa_notes === 'string' ? qa_notes.trim() : '';

  const row: Record<string, unknown> = {
    qa_score: Math.round(score),
    qa_notes: notes || null,
    qa_passed: passed,
    updated_at: new Date().toISOString(),
  };

  if (shouldApplyStatus) {
    if (passed) {
      row.status = 'done';
      row.completed_at = new Date().toISOString();
      row.failure_reason = null;
    } else {
      row.status = 'pending';
      row.completed_at = null;
      row.failure_reason = notes ? `Oversight QA: ${notes.slice(0, 500)}` : 'Oversight QA failed — see qa_notes';
    }
  }

  const { data: before } = await supabaseAdmin
    .from('agent_tasks')
    .select('title, status')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabaseAdmin.from('agent_tasks').update(row).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent({
    event_type: passed ? 'agent_qa_passed' : 'agent_qa_failed',
    entity_type: 'agent_task',
    entity_id: id,
    payload: {
      title: before?.title,
      prior_status: before?.status,
      qa_score: Math.round(score),
      qa_passed: passed,
      qa_notes: notes,
      apply_status: shouldApplyStatus,
    },
    source: 'os_oversight',
  });

  return NextResponse.json({ ok: true });
}
