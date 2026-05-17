/**
 * Agent QA Reviewer
 *
 * After a worker completes a task, this agent reviews the output against:
 *   1. CLAUDE.md quality standards
 *   2. The task's acceptance criteria
 *   3. The £50M north star (does this move the needle?)
 *
 * Scores 0-100. < 70 = failed, needs rework. >= 70 = passed, mark done.
 * All reviews logged to OS events table and /api/os/log-context.
 *
 * Usage:
 *   npx tsx scripts/agent-qa-reviewer.ts --task-id <uuid>
 *   npx tsx scripts/agent-qa-reviewer.ts --review-all   # review all qa_review tasks
 */

import * as path from 'path';
import * as fs from 'fs';

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv(path.resolve(__dirname, '..', '.env.local'));
loadEnv(path.resolve(__dirname, '..', '.env'));

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNS_DIR = path.join(REPO_ROOT, '.agent-runs');

interface AgentTask {
  id: string;
  title: string;
  description: string;
  worker_type: string;
  priority: number;
  output_summary: string;
  spec_file?: string;
}

// ─── QA Review via Claude ─────────────────────────────────────────────────────

async function reviewTask(task: AgentTask, agentOutput: string): Promise<{
  score: number;
  passed: boolean;
  notes: string;
  rework_instructions?: string;
}> {
  const claudeMd = fs.existsSync(path.join(REPO_ROOT, 'CLAUDE.md'))
    ? fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf-8').slice(0, 2000)
    : '';

  const prompt = `You are the QA agent for Dentago, a B2B dental procurement marketplace targeting £50M revenue.

Your job: review a completed agent task and score it 0-100.

## North Star
${claudeMd}

## Task
Title: ${task.title}
Description: ${task.description}
Worker type: ${task.worker_type}
Priority: P${task.priority}

## Agent Output / Summary
${agentOutput.slice(0, 3000)}

## Scoring Rubric
- **Completeness (0-30):** Was the task fully done or only partial?
- **Quality (0-30):** Is the implementation solid? No shortcuts, no bugs, no half-measures?
- **£50M alignment (0-20):** Does this genuinely move Dentago toward £50M? Or is it busywork?
- **Logging (0-10):** Was the output properly logged to the OS?
- **No regressions (0-10):** Did it avoid breaking existing functionality?

## Response Format (JSON only, no prose)
{
  "score": <0-100>,
  "passed": <true if score >= 70>,
  "breakdown": {
    "completeness": <0-30>,
    "quality": <0-30>,
    "alignment": <0-20>,
    "logging": <0-10>,
    "no_regressions": <0-10>
  },
  "notes": "<2-3 sentences on what was done well and what was lacking>",
  "rework_instructions": "<if failed: specific instructions for the worker to fix it, null if passed>"
}`;

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('QA response was not valid JSON');

  return JSON.parse(jsonMatch[0]);
}

// ─── Log review to OS ─────────────────────────────────────────────────────────

async function logReviewToOS(task: AgentTask, review: Awaited<ReturnType<typeof reviewTask>>) {
  try {
    const res = await fetch(`https://www.dentago.co.uk/api/os/log-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `QA review: "${task.title}" — score ${review.score}/100 — ${review.passed ? 'PASSED' : 'FAILED'}`,
        decisions_made: [],
        work_completed: review.passed ? [{ task: task.title, result: `QA passed with score ${review.score}` }] : [],
        open_loops: !review.passed ? [{ task: task.title, blocker: review.notes, next_action: review.rework_instructions ?? 'Rework required' }] : [],
        outreach_count: 0,
      }),
    });
    if (!res.ok) console.warn('  ⚠️  OS log-context failed:', res.status);
  } catch (e) {
    console.warn('  ⚠️  Could not log to OS:', e);
  }

  // Also log to events table
  await supabase.from('events').insert({
    event_type: 'loop_completed',
    entity_type: 'agent_task',
    entity_id: task.id,
    payload: {
      task_title: task.title,
      worker_type: task.worker_type,
      qa_score: review.score,
      qa_passed: review.passed,
      qa_notes: review.notes,
    },
    source: 'qa_agent',
  });
}

// ─── Review one task ──────────────────────────────────────────────────────────

async function reviewOne(taskId: string) {
  const { data: task, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error || !task) {
    console.error('Task not found:', taskId);
    return;
  }

  console.log(`\n🔍 Reviewing: ${task.title}`);

  // Find agent output log
  let agentOutput = task.output_summary ?? '';
  if (!agentOutput) {
    // Try to find the most recent summary file
    const summaries = fs.existsSync(RUNS_DIR)
      ? fs.readdirSync(RUNS_DIR).filter(f => f.startsWith('summary-')).sort().reverse()
      : [];
    if (summaries.length > 0) {
      agentOutput = fs.readFileSync(path.join(RUNS_DIR, summaries[0]), 'utf-8');
    }
  }

  const review = await reviewTask(task as AgentTask, agentOutput);

  console.log(`  Score: ${review.score}/100 — ${review.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Notes: ${review.notes}`);
  if (review.rework_instructions) {
    console.log(`  Rework: ${review.rework_instructions}`);
  }

  // Update task in Supabase
  await supabase.from('agent_tasks').update({
    status: review.passed ? 'done' : 'pending',  // failed = back to pending for rework
    qa_score: review.score,
    qa_notes: review.notes,
    qa_passed: review.passed,
    completed_at: review.passed ? new Date().toISOString() : null,
    // If failed, reset so worker picks it up again with rework instructions
    description: review.passed ? task.description : `${task.description}\n\n## REWORK REQUIRED\n${review.rework_instructions}`,
    attempt_count: (task.attempt_count ?? 0) + 1,
  }).eq('id', taskId);

  await logReviewToOS(task as AgentTask, review);

  // Write QA report to .agent-runs/
  const reportPath = path.join(RUNS_DIR, `qa-${taskId.slice(0, 8)}-${Date.now()}.md`);
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.writeFileSync(reportPath, `# QA Review — ${task.title}

**Score:** ${review.score}/100
**Passed:** ${review.passed}
**Reviewed at:** ${new Date().toISOString()}

## Notes
${review.notes}

${review.rework_instructions ? `## Rework Instructions\n${review.rework_instructions}` : ''}
`);
}

// ─── Review all tasks awaiting QA ────────────────────────────────────────────

async function reviewAll() {
  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('id, title')
    .eq('status', 'qa_review');

  if (!tasks || tasks.length === 0) {
    console.log('No tasks awaiting QA review.');
    return;
  }

  console.log(`\n🔍 ${tasks.length} tasks awaiting QA review\n`);
  for (const t of tasks) {
    await reviewOne(t.id);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--review-all')) {
    await reviewAll();
    return;
  }

  const taskIdIdx = args.indexOf('--task-id');
  if (taskIdIdx !== -1 && args[taskIdIdx + 1]) {
    await reviewOne(args[taskIdIdx + 1]);
    return;
  }

  console.log(`
Dentago QA Reviewer

Usage:
  npx tsx scripts/agent-qa-reviewer.ts --task-id <uuid>
  npx tsx scripts/agent-qa-reviewer.ts --review-all
`);
}

main().catch(e => { console.error(e); process.exit(1); });
