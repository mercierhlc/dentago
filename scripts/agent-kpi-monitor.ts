/**
 * Agent KPI Monitor
 *
 * Runs every 3 hours. Reads the live OS state, compares against KPI targets
 * anchored to the £50M Year 2 goal, logs a snapshot, and flags any drift.
 *
 * Also runs the outreach response review — checks Resend inbox for replies,
 * updates reply rate, logs new reply events.
 *
 * Logs everything to:
 *   - /api/os/log-context (visible at dentago.co.uk/os)
 *   - agent_kpi_log table (historical snapshots)
 *   - Obsidian (updates the daily briefing note)
 *
 * Usage:
 *   npx tsx scripts/agent-kpi-monitor.ts
 *   npx tsx scripts/agent-kpi-monitor.ts --response-review   # also review email replies
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

const OBSIDIAN_API = 'http://localhost:27123';
const OBSIDIAN_KEY = process.env.OBSIDIAN_API_KEY ?? '';
const BASE_URL = 'https://www.dentago.co.uk';

// ─── KPI Targets (from CLAUDE.md) ────────────────────────────────────────────

const KPI_TARGETS = {
  reply_rate: { target: 0.10, unit: '%', label: 'Email reply rate' },
  demo_booking_rate: { target: 0.02, unit: '%', label: 'Demo → booking rate' },
  verified_clinics_may: { target: 50, unit: 'clinics', label: 'Verified clinics by end May' },
  gmv: { target: 1, unit: '£', label: 'First GMV (any order)' },
  revenue_year1: { target: 100_000, unit: '£/month', label: 'Year 1 revenue' },
  revenue_year2: { target: 50_000_000, unit: '£', label: 'Year 2 revenue (£50M goal)' },
};

// ─── Read OS state ────────────────────────────────────────────────────────────

async function readOSState() {
  const res = await fetch(`${BASE_URL}/api/os/state`);
  if (!res.ok) throw new Error(`OS state fetch failed: ${res.status}`);
  return res.json();
}

// ─── Read agent task stats ────────────────────────────────────────────────────

async function getTaskStats() {
  const { data } = await supabase
    .from('agent_tasks')
    .select('status, qa_score');

  const stats = {
    total: 0, done: 0, failed: 0, in_progress: 0, pending: 0, qa_review: 0,
    avg_qa_score: 0, qa_pass_rate: 0,
  };

  if (!data) return stats;

  const scores: number[] = [];
  for (const row of data) {
    stats.total++;
    if (row.status === 'done') { stats.done++; if (row.qa_score) scores.push(row.qa_score); }
    else if (row.status === 'failed') stats.failed++;
    else if (row.status === 'in_progress') stats.in_progress++;
    else if (row.status === 'pending') stats.pending++;
    else if (row.status === 'qa_review') stats.qa_review++;
  }

  stats.avg_qa_score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  stats.qa_pass_rate = stats.done > 0 ? scores.filter(s => s >= 70).length / stats.done : 0;

  return stats;
}

// ─── Read outreach stats ──────────────────────────────────────────────────────

async function getOutreachStats() {
  // Total outreach sent from events
  const { count: totalSent } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'outreach_sent');

  const { count: totalReplies } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'outreach_reply_received');

  const sent = totalSent ?? 0;
  const replies = totalReplies ?? 0;
  const reply_rate = sent > 0 ? replies / sent : 0;

  return { sent, replies, reply_rate };
}

// ─── Evaluate KPIs ────────────────────────────────────────────────────────────

function evaluateKPIs(osState: Record<string, unknown>, outreach: Awaited<ReturnType<typeof getOutreachStats>>) {
  const kpis = (osState as Record<string, Record<string, unknown>>).kpis?.state as Record<string, unknown> ?? {};

  const current = {
    reply_rate: outreach.reply_rate,
    demo_booking_rate: outreach.sent > 0
      ? ((kpis.demos_booked as number ?? 0) / outreach.sent)
      : 0,
    verified_clinics_may: kpis.clinics_verified as number ?? 0,
    gmv: kpis.gmv as number ?? 0,
    revenue_year1: 0,
    revenue_year2: 0,
  };

  const status: Record<string, unknown> = {};
  const drift_alerts: string[] = [];

  for (const [key, target] of Object.entries(KPI_TARGETS)) {
    const value = current[key as keyof typeof current] ?? 0;
    const ratio = target.target > 0 ? value / target.target : 0;
    let kpiStatus: 'on_track' | 'at_risk' | 'critical' | 'not_started';

    if (value === 0 && target.target > 0) kpiStatus = 'not_started';
    else if (ratio >= 0.8) kpiStatus = 'on_track';
    else if (ratio >= 0.5) kpiStatus = 'at_risk';
    else kpiStatus = 'critical';

    status[key] = { value, target: target.target, unit: target.unit, label: target.label, status: kpiStatus };

    if (kpiStatus === 'critical' || kpiStatus === 'at_risk') {
      drift_alerts.push(`⚠️  ${target.label}: ${value} vs target ${target.target} ${target.unit} — ${kpiStatus.toUpperCase()}`);
    }
  }

  return { current, status, drift_alerts };
}

// ─── Log KPI snapshot ─────────────────────────────────────────────────────────

async function logKPISnapshot(
  taskStats: Awaited<ReturnType<typeof getTaskStats>>,
  outreach: Awaited<ReturnType<typeof getOutreachStats>>,
  evaluation: ReturnType<typeof evaluateKPIs>,
  osState: Record<string, unknown>
) {
  const kpis = (osState as Record<string, Record<string, unknown>>).kpis?.state as Record<string, unknown> ?? {};

  await supabase.from('agent_kpi_log').insert({
    tasks_total: taskStats.total,
    tasks_done: taskStats.done,
    tasks_failed: taskStats.failed,
    tasks_in_progress: taskStats.in_progress,
    tasks_pending: taskStats.pending,
    avg_qa_score: taskStats.avg_qa_score,
    qa_pass_rate: taskStats.qa_pass_rate,
    outreach_sent_session: 0,
    outreach_replies_received: outreach.replies,
    reply_rate: outreach.reply_rate,
    clinics_total: kpis.clinics_total as number ?? 0,
    clinics_verified: kpis.clinics_verified as number ?? 0,
    gmv: kpis.gmv as number ?? 0,
    kpi_status: evaluation.status,
    drift_alerts: evaluation.drift_alerts,
    notes: evaluation.drift_alerts.length > 0
      ? `${evaluation.drift_alerts.length} KPIs at risk or critical`
      : 'All KPIs on track',
  });

  // Log to events
  await supabase.from('events').insert({
    event_type: 'kpi_snapshot',
    payload: {
      task_throughput: `${taskStats.done}/${taskStats.total} done`,
      qa_pass_rate: taskStats.qa_pass_rate,
      reply_rate: outreach.reply_rate,
      drift_alerts: evaluation.drift_alerts,
    },
    source: 'kpi_monitor',
  });
}

// ─── Log to OS ────────────────────────────────────────────────────────────────

async function logToOS(
  taskStats: Awaited<ReturnType<typeof getTaskStats>>,
  outreach: Awaited<ReturnType<typeof getOutreachStats>>,
  evaluation: ReturnType<typeof evaluateKPIs>
) {
  const open_loops = evaluation.drift_alerts.map(alert => ({
    task: 'KPI drift',
    blocker: alert,
    next_action: 'Agents should prioritise tasks that address this KPI',
  }));

  await fetch(`${BASE_URL}/api/os/log-context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: `KPI Monitor — ${new Date().toISOString()}. Tasks: ${taskStats.done}/${taskStats.total} done. Reply rate: ${(outreach.reply_rate * 100).toFixed(1)}%. ${evaluation.drift_alerts.length} KPIs at risk.`,
      decisions_made: [],
      work_completed: [
        { task: 'KPI snapshot', result: `${taskStats.done} tasks completed, avg QA score ${taskStats.avg_qa_score.toFixed(0)}/100` },
      ],
      open_loops,
      outreach_count: 0,
    }),
  });
}

// ─── Update Obsidian briefing ─────────────────────────────────────────────────

async function updateObsidianBriefing(
  taskStats: Awaited<ReturnType<typeof getTaskStats>>,
  outreach: Awaited<ReturnType<typeof getOutreachStats>>,
  evaluation: ReturnType<typeof evaluateKPIs>
) {
  const today = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const content = `# KPI Monitor — ${today} ${time}

## Task Queue
| Status | Count |
|---|---|
| Pending | ${taskStats.pending} |
| In Progress | ${taskStats.in_progress} |
| QA Review | ${taskStats.qa_review} |
| Done | ${taskStats.done} |
| Failed | ${taskStats.failed} |

**Avg QA Score:** ${taskStats.avg_qa_score.toFixed(0)}/100
**QA Pass Rate:** ${(taskStats.qa_pass_rate * 100).toFixed(0)}%

## Outreach
- Emails sent total: ${outreach.sent.toLocaleString()}
- Replies received: ${outreach.replies}
- Reply rate: ${(outreach.reply_rate * 100).toFixed(2)}% (target: 10%)

## KPI Status
${Object.entries(evaluation.status).map(([k, v]) => {
  const val = v as Record<string, unknown>;
  const icon = val.status === 'on_track' ? '✅' : val.status === 'at_risk' ? '⚠️' : val.status === 'not_started' ? '⬜' : '🔴';
  return `- ${icon} **${val.label}:** ${val.value} / ${val.target} ${val.unit}`;
}).join('\n')}

${evaluation.drift_alerts.length > 0 ? `## Drift Alerts\n${evaluation.drift_alerts.join('\n')}` : '## No drift alerts — all KPIs healthy'}

---
*Auto-generated by KPI Monitor. View live at [dentago.co.uk/os](https://www.dentago.co.uk/os)*
`;

  try {
    const notePath = `Dentago/Intelligence/KPI Monitor — ${today}.md`;
    await fetch(`${OBSIDIAN_API}/vault/${encodeURIComponent(notePath)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${OBSIDIAN_KEY}`,
        'Content-Type': 'text/markdown',
      },
      body: content,
    });
    console.log(`  📓 Obsidian note updated: ${notePath}`);
  } catch (e) {
    console.warn('  ⚠️  Could not update Obsidian:', e);
  }
}

// ─── Response review (run every few hours to check email replies) ─────────────

async function runResponseReview() {
  console.log('\n📬 Running response review...');

  // Trigger the existing os-classify-replies script
  const { spawn } = await import('child_process');
  return new Promise<void>(resolve => {
    const child = spawn('npx', ['tsx', path.join(__dirname, 'os-classify-replies.ts')], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    });
    child.on('close', () => resolve());
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const doResponseReview = args.includes('--response-review');

  console.log('\n📊 Dentago KPI Monitor\n');
  console.log(`  ${new Date().toISOString()}\n`);

  // Read all data
  console.log('  Reading OS state...');
  const osState = await readOSState().catch(() => ({}));

  console.log('  Reading task stats...');
  const taskStats = await getTaskStats();

  console.log('  Reading outreach stats...');
  const outreach = await getOutreachStats();

  // Evaluate
  const evaluation = evaluateKPIs(osState, outreach);

  // Report
  console.log('\n  Task Queue:');
  console.log(`    Done: ${taskStats.done} | In Progress: ${taskStats.in_progress} | Pending: ${taskStats.pending} | Failed: ${taskStats.failed}`);
  console.log(`    Avg QA Score: ${taskStats.avg_qa_score.toFixed(0)}/100 | Pass Rate: ${(taskStats.qa_pass_rate * 100).toFixed(0)}%`);

  console.log('\n  Outreach:');
  console.log(`    Sent: ${outreach.sent.toLocaleString()} | Replies: ${outreach.replies} | Reply rate: ${(outreach.reply_rate * 100).toFixed(2)}%`);

  if (evaluation.drift_alerts.length > 0) {
    console.log('\n  ⚠️  KPI Drift Alerts:');
    for (const alert of evaluation.drift_alerts) {
      console.log(`    ${alert}`);
    }
  } else {
    console.log('\n  ✅ All KPIs on track');
  }

  // Log everything
  console.log('\n  Logging snapshot...');
  await logKPISnapshot(taskStats, outreach, evaluation, osState);
  await logToOS(taskStats, outreach, evaluation);
  await updateObsidianBriefing(taskStats, outreach, evaluation);

  if (doResponseReview) {
    await runResponseReview();
  }

  console.log('\n✨ KPI Monitor complete\n');
}

main().catch(e => { console.error(e); process.exit(1); });
