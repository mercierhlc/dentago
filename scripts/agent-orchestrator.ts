/**
 * Agent Orchestrator — Dentago's autonomous multi-agent engine
 *
 * Reads the task queue from Supabase, spawns parallel worker agents by type,
 * triggers QA review after each completion, and logs everything to the OS.
 *
 * Flow:
 *   1. Read OS state (north star alignment)
 *   2. Pull pending tasks from agent_tasks, ordered by priority
 *   3. Spawn N parallel Claude Code agents (one per task type)
 *   4. After each agent completes → trigger QA reviewer
 *   5. QA passes → mark done, log to OS
 *   6. QA fails → task goes back to pending with rework instructions
 *   7. Every 3h → run KPI monitor
 *
 * Usage:
 *   npx tsx scripts/agent-orchestrator.ts                    # run with defaults (3 parallel)
 *   npx tsx scripts/agent-orchestrator.ts --parallel 5      # 5 parallel workers
 *   npx tsx scripts/agent-orchestrator.ts --type coding     # only coding tasks
 *   npx tsx scripts/agent-orchestrator.ts --type outreach   # only outreach tasks
 *   npx tsx scripts/agent-orchestrator.ts --ingest          # ingest todos first, then run
 *   npx tsx scripts/agent-orchestrator.ts --kpi-only        # just run KPI monitor
 *   npx tsx scripts/agent-orchestrator.ts --status          # show current queue status
 *   npx tsx scripts/agent-orchestrator.ts --max-batches 1 --skip-kpi  # one batch (cron-friendly)
 */

import { spawn } from 'child_process';
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
const BASE_URL = 'https://www.dentago.co.uk';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentTask {
  id: string;
  title: string;
  description: string;
  worker_type: string;
  priority: number;
  spec_file?: string;
  attempt_count: number;
}

// ─── Claim a task atomically ──────────────────────────────────────────────────

async function claimTask(workerType?: string, agentId?: string): Promise<AgentTask | null> {
  const agId = agentId ?? `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Atomic: select the highest-priority pending task and claim it in one shot
  let query = supabase
    .from('agent_tasks')
    .select('*')
    .eq('status', 'pending')
    .lt('attempt_count', 2)
    .order('priority', { ascending: true })   // week 1 before week 2 before week 3...
    .order('created_at', { ascending: true }) // within same week: oldest first
    .limit(1);

  if (workerType) query = query.eq('worker_type', workerType);

  const { data: tasks } = await query;
  if (!tasks || tasks.length === 0) return null;

  const task = tasks[0] as AgentTask;

  // Claim it
  const { error } = await supabase.from('agent_tasks').update({
    status: 'claimed',
    claimed_by: agId,
    claimed_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
  }).eq('id', task.id).eq('status', 'pending');  // status check prevents race

  if (error) return null;  // another agent beat us to it, try again
  return task;
}

// ─── Build agent prompt ───────────────────────────────────────────────────────

function buildAgentPrompt(task: AgentTask): string {
  const claudeMd = fs.existsSync(path.join(REPO_ROOT, 'CLAUDE.md'))
    ? fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf-8').slice(0, 3000)
    : '';
  const workflowMd = fs.existsSync(path.join(REPO_ROOT, 'WORKFLOW.md'))
    ? fs.readFileSync(path.join(REPO_ROOT, 'WORKFLOW.md'), 'utf-8')
    : '';

  const workerInstructions: Record<string, string> = {
    coding: `You are a coding agent. Read the codebase, understand existing patterns, then implement.
- Run tsc --noEmit after changes
- Use logEvent() from lib/events.ts for any meaningful actions
- Never commit or push — write code only
- Test your changes manually before marking done`,

    outreach: `You are an outreach agent. Your job is to send targeted, personalised outreach.
- Use existing outreach templates in Dentago/Outreach Templates.md as a starting point
- Personalise every message — no mass spam
- Log EVERY message sent via logEvent({ event_type: 'outreach_sent', ... })
- Log the exact count sent in your summary
- Do not send from domains with poor reputation — check CLAUDE.md for current state`,

    general: `You are a general operations agent. Execute the task completely and thoroughly.
- Log all meaningful actions via logEvent()
- If the task produces a document or decision, write it to the appropriate Obsidian note
- Update the OS state if anything changes`,

    research: `You are a research agent. Produce actionable insights, not just summaries.
- Every finding should have a clear implication for Dentago
- Write your output to Obsidian: Dentago/Intelligence/ folder
- Log key findings via logEvent()`,
  };

  return `You are an autonomous ${task.worker_type} agent working on Dentago (B2B dental procurement marketplace targeting £50M revenue).

## Workflow Standard (MANDATORY — read before starting)
${workflowMd}

## CLAUDE.md Context
${claudeMd}

## Worker Instructions
${workerInstructions[task.worker_type] ?? workerInstructions.general}

## Your Task (P${task.priority})
**Title:** ${task.title}
**Description:**
${task.description}

## When Done
1. Write a summary to .agent-runs/summary-${task.id.slice(0, 8)}-${Date.now()}.md covering:
   - What you did
   - What files you changed
   - What was logged to the OS
   - Any open questions or blockers
2. Log to the OS:
   curl -X POST ${BASE_URL}/api/os/log-context \\
     -H "Content-Type: application/json" \\
     -d '{
       "summary": "Brief description of what you completed",
       "decisions_made": [],
       "work_completed": [{"task": "${task.title}", "result": "..."}],
       "open_loops": [],
       "outreach_count": 0
     }'

The north star is £50M revenue by end of Year 2. Every action must move Dentago closer to that goal.`;
}

// ─── Run a single agent ───────────────────────────────────────────────────────

async function runWorkerAgent(task: AgentTask): Promise<{ success: boolean; outputFile: string; summary: string }> {
  const agentId = `worker-${task.id.slice(0, 8)}-${Date.now()}`;
  const outputFile = path.join(RUNS_DIR, `${agentId}.log`);
  fs.mkdirSync(RUNS_DIR, { recursive: true });

  console.log(`\n🚀 [${task.worker_type.toUpperCase()}] ${agentId}`);
  console.log(`   P${task.priority}: ${task.title.slice(0, 70)}`);

  // Mark as in_progress
  await supabase.from('agent_tasks').update({ status: 'in_progress' }).eq('id', task.id);

  const prompt = buildAgentPrompt(task);

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = msg.content[0].type === 'text' ? msg.content[0].text : '';

    // Save output to log file
    fs.writeFileSync(outputFile, summary);

    // Also write summary file for QA to pick up
    const summaryFile = path.join(RUNS_DIR, `summary-${task.id.slice(0, 8)}-${Date.now()}.md`);
    fs.writeFileSync(summaryFile, `# Agent Output — ${task.title}\n\n${summary}`);

    // Log to OS
    try {
      await fetch(`${BASE_URL}/api/os/log-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: `Agent completed: "${task.title}"`,
          decisions_made: [],
          work_completed: [{ task: task.title, result: summary.slice(0, 300) }],
          open_loops: [],
          outreach_count: 0,
        }),
      });
    } catch { /* non-fatal */ }

    // Move to qa_review
    await supabase.from('agent_tasks').update({
      status: 'qa_review',
      output_summary: summary.slice(0, 2000),
      attempt_count: task.attempt_count + 1,
    }).eq('id', task.id);

    console.log(`\n✅ [${agentId.slice(0, 14)}] done — queued for QA`);
    return { success: true, outputFile, summary };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ [${agentId.slice(0, 14)}] failed: ${msg}`);

    const newAttemptCount = task.attempt_count + 1;
    const finallyFailed = newAttemptCount >= 2;

    await supabase.from('agent_tasks').update({
      status: 'failed',
      failure_reason: msg.slice(0, 500),
      attempt_count: newAttemptCount,
    }).eq('id', task.id);

    // Log every failure to the OS
    try {
      await fetch(`${BASE_URL}/api/os/log-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: `Agent FAILED: "${task.title}" — ${finallyFailed ? 'max attempts reached, needs human review' : 'will retry'}`,
          decisions_made: [],
          work_completed: [],
          open_loops: [{ task: task.title, blocker: msg.slice(0, 300), next_action: finallyFailed ? 'Needs human review — flagged in agent_tasks' : 'Will retry on next orchestrator run' }],
          outreach_count: 0,
        }),
      });
    } catch { /* non-fatal */ }

    return { success: false, outputFile, summary: msg };
  }
}

// ─── Show queue status ────────────────────────────────────────────────────────

async function showStatus() {
  const { data } = await supabase
    .from('agent_tasks')
    .select('status, worker_type, priority, title, qa_score')
    .order('priority').order('created_at');

  if (!data || data.length === 0) {
    console.log('\nTask queue is empty. Run --ingest first.\n');
    return;
  }

  const byStatus = data.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📊 Task Queue Status\n');
  console.log(`  Pending:     ${byStatus.pending ?? 0}`);
  console.log(`  Claimed:     ${byStatus.claimed ?? 0}`);
  console.log(`  In Progress: ${byStatus.in_progress ?? 0}`);
  console.log(`  QA Review:   ${byStatus.qa_review ?? 0}`);
  console.log(`  Done:        ${byStatus.done ?? 0}`);
  console.log(`  Failed:      ${byStatus.failed ?? 0}`);
  console.log(`  Total:       ${data.length}\n`);

  const inProgress = data.filter(r =>
    r.status === 'claimed' || r.status === 'in_progress' || r.status === 'qa_review');
  if (inProgress.length > 0) {
    console.log('  Active tasks:');
    for (const t of inProgress) {
      const icon =
        t.status === 'qa_review' ? '🔍' : '🔄';
      console.log(`    ${icon} [P${t.priority}][${t.worker_type}] ${t.title.slice(0, 60)}`);
    }
    console.log('');
  }
}

// ─── Run parallel workers ─────────────────────────────────────────────────────

async function runParallelWorkers(options: {
  parallel: number;
  workerType?: string;
  maxBatches: number;
  skipKpi: boolean;
}) {
  const { parallel, workerType, maxBatches, skipKpi } = options;
  console.log(`\n🏭 Starting orchestrator (${parallel} parallel workers${workerType ? `, type: ${workerType}` : ''}${maxBatches !== Infinity ? `, max ${maxBatches} batch(es)` : ''})\n`);

  let totalDone = 0;
  let totalFailed = 0;
  let batchesRun = 0;

  // Keep running until no more tasks or max batches (for cron / CI)
  while (batchesRun < maxBatches) {
    // Claim up to `parallel` tasks
    const claimed: AgentTask[] = [];
    for (let i = 0; i < parallel; i++) {
      const task = await claimTask(workerType);
      if (task) claimed.push(task);
    }

    if (claimed.length === 0) {
      console.log('\n✅ No more pending tasks. Queue exhausted.\n');
      break;
    }
    batchesRun++;

    console.log(`\n⚡ Running ${claimed.length} workers in parallel...\n`);

    // Run all claimed tasks in parallel
    await Promise.all(claimed.map(task => runWorkerAgent(task)));

    // QA review all completed tasks
    for (let i = 0; i < claimed.length; i++) {
      const task = claimed[i];
      console.log(`\n🔍 QA reviewing: ${task.title.slice(0, 60)}`);

      try {
        await runScript('agent-qa-reviewer.ts', ['--task-id', task.id]);
        totalDone++;
      } catch (e) {
        console.error(`  QA review failed for task ${task.id}:`, e);
        totalFailed++;
      }
    }

    // Brief pause between batches
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n📊 Session complete: ${totalDone} done, ${totalFailed} failed\n`);

  if (!skipKpi) {
    await runScript('agent-kpi-monitor.ts', ['--response-review']);
  } else {
    console.log('⏭️  Skipping KPI monitor (--skip-kpi)\n');
  }
}

// ─── Run a script ─────────────────────────────────────────────────────────────

function runScript(script: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', path.join(__dirname, script), ...args], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env },
    });
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--status')) {
    await showStatus();
    return;
  }

  if (args.includes('--kpi-only')) {
    await runScript('agent-kpi-monitor.ts', ['--response-review']);
    return;
  }

  if (args.includes('--ingest')) {
    console.log('📥 Ingesting todos from Obsidian...\n');
    await runScript('agent-task-ingester.ts');
  }

  const parallelArg = args.find(a => a.startsWith('--parallel'));
  const parallel = parallelArg
    ? parseInt(parallelArg.includes('=') ? parallelArg.split('=')[1] : args[args.indexOf('--parallel') + 1] ?? '3')
    : 3;

  const typeIdx = args.indexOf('--type');
  const workerType = typeIdx !== -1 ? args[typeIdx + 1] : undefined;

  const mbIdx = args.findIndex(a => a === '--max-batches');
  const mbEq = args.find(a => a.startsWith('--max-batches='));
  let maxBatches = Infinity;
  if (mbEq) {
    const n = parseInt(mbEq.split('=')[1] ?? '', 10);
    if (!Number.isNaN(n) && n > 0) maxBatches = n;
  } else if (mbIdx !== -1) {
    const n = parseInt(args[mbIdx + 1] ?? '', 10);
    if (!Number.isNaN(n) && n > 0) maxBatches = n;
  }

  const skipKpi = args.includes('--skip-kpi');

  await runParallelWorkers({ parallel, workerType, maxBatches, skipKpi });
}

main().catch(e => { console.error(e); process.exit(1); });
