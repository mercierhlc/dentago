import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function authorizeAgentsWrite(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

type TaskInsert = {
  title: string;
  description: string;
  worker_type: 'coding' | 'outreach' | 'general' | 'research';
  priority?: number;
  source_file?: string;
  source_type?: string;
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('agent_tasks')
    .select('id, title, description, worker_type, priority, status, output_summary, qa_score, qa_notes, qa_passed, attempt_count, failure_reason, source_file, source_type, started_at, completed_at, created_at')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tasks = data ?? [];
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const claimed = tasks.filter(t => t.status === 'claimed').length;
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    /** Strict DB status */
    in_progress: inProgress,
    /** Claimed + in_progress (work actively assigned / executing) */
    running: inProgress + claimed,
    claimed,
    qa_review: tasks.filter(t => t.status === 'qa_review').length,
    done: tasks.filter(t => t.status === 'done').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    avg_qa_score: (() => {
      const scores = tasks.filter(t => t.qa_score != null).map(t => t.qa_score as number);
      return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    })(),
  };

  return NextResponse.json({ data: tasks, stats });
}

/** Queue agent tasks (cron / automation). Bearer CRON_SECRET */
export async function POST(request: Request) {
  const denied = authorizeAgentsWrite(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const raw = body as { tasks?: TaskInsert[] } & Partial<TaskInsert>;
  const list: TaskInsert[] = Array.isArray(raw.tasks)
    ? raw.tasks
    : raw.title && raw.description && raw.worker_type
      ? [{ title: raw.title, description: raw.description, worker_type: raw.worker_type, priority: raw.priority, source_file: raw.source_file, source_type: raw.source_type }]
      : [];

  if (!list.length) {
    return NextResponse.json(
      { error: 'Provide tasks[] or { title, description, worker_type }' },
      { status: 400 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from('agent_tasks')
    .select('title')
    .in('status', ['pending', 'claimed', 'in_progress', 'qa_review']);

  const existingTitles = new Set((existing ?? []).map((r: { title: string }) => r.title));

  const inserted: string[] = [];
  const skipped: string[] = [];

  for (const t of list) {
    if (!t.title?.trim() || !t.description?.trim() || !t.worker_type) {
      return NextResponse.json({ error: 'Each task needs title, description, worker_type' }, { status: 400 });
    }
    if (existingTitles.has(t.title)) {
      skipped.push(t.title);
      continue;
    }

    const { error } = await supabaseAdmin.from('agent_tasks').insert({
      title: t.title.trim(),
      description: t.description.trim(),
      worker_type: t.worker_type,
      priority: t.priority ?? 5,
      source_file: (t.source_file ?? 'api/agents/tasks').trim(),
      source_type: (t.source_type ?? 'manual').trim(),
      status: 'pending',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    existingTitles.add(t.title);
    inserted.push(t.title);
  }

  return NextResponse.json({ ok: true, inserted, skipped });
}
