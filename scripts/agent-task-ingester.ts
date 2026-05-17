/**
 * Agent Task Ingester
 *
 * Reads all Dentago todo sources from Obsidian and populates the agent_tasks
 * queue in Supabase. Workers then claim tasks from this queue.
 *
 * Sources:
 *   - Dentago/CEO TODOs — 1 May 2026.md
 *   - Dentago/365-Day Plan.md (week-by-week)
 *   - Dentago/What We Need To Implement.md
 *   - Dentago/Reports/ (weekly goal files)
 *
 * Usage:
 *   npx tsx scripts/agent-task-ingester.ts
 *   npx tsx scripts/agent-task-ingester.ts --dry-run   # preview without inserting
 *
 * Run once at the start of each agent session to sync todos → task queue.
 * Idempotent: skips tasks already in the queue (matched by title).
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VAULT_PATH = '/Users/mercier/Documents/MCP Projects/MCP Test';
const SPECS_DIR = path.resolve(__dirname, '..', 'specs');
const DRY_RUN = process.argv.includes('--dry-run');

interface Task {
  source_file: string;
  source_type: string;
  title: string;
  description: string;
  worker_type: 'coding' | 'outreach' | 'general' | 'research';
  priority: number;
  spec_file?: string;
}

// ─── File reader (direct from vault on disk) ──────────────────────────────────

function readVaultFile(filepath: string): string {
  const fullPath = path.join(VAULT_PATH, filepath);
  if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);
  return fs.readFileSync(fullPath, 'utf-8');
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function detectWorkerType(text: string): 'coding' | 'outreach' | 'general' | 'research' {
  const lower = text.toLowerCase();
  if (/build|implement|code|fix|page|api|supabase|database|scrape|deploy/.test(lower)) return 'coding';
  if (/outreach|email|send|linkedin|whatsapp|contact|follow.?up|message/.test(lower)) return 'outreach';
  if (/research|analyse|compare|review|check|audit/.test(lower)) return 'research';
  return 'general';
}

function detectPriority(text: string, header?: string): number {
  if (/p0|P0|critical|before.*launch|before.*demo/.test(text + (header ?? ''))) return 0;
  if (/p1|P1|before.*may|50.clinic|50 clinic|end of may/.test(text + (header ?? ''))) return 1;
  if (/p2|P2|milestone.gated|year 2|series a/.test(text + (header ?? ''))) return 2;
  return 5;
}

/**
 * Parse CEO TODOs file — structured format with TODO blocks
 */
function parseCEOTodos(content: string, sourceFile: string): Task[] {
  const tasks: Task[] = [];
  // Split on "### TODO N" headers
  const blocks = content.split(/(?=^### TODO \d+)/m).filter(b => b.trim());

  for (const block of blocks) {
    const titleMatch = block.match(/^### TODO \d+ — (.+)/m);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const statusMatch = block.match(/\*\*Status:\*\*\s*\[(.)\]/);
    const isDone = statusMatch?.[1] === 'x' || statusMatch?.[1] === 'X';
    if (isDone) continue; // skip completed

    const whyMatch = block.match(/\*\*Why:\*\*\s*([\s\S]*?)(?=\*\*Shape:|$)/);
    const shapeMatch = block.match(/\*\*Shape:\*\*\s*([\s\S]*?)(?=\*\*Effort:|$)/);
    const description = [
      block.match(/\*\*What:\*\*\s*(.+)/)?.[1] ?? '',
      whyMatch ? `\nWhy: ${whyMatch[1].trim()}` : '',
      shapeMatch ? `\nShape: ${shapeMatch[1].trim()}` : '',
    ].join('').trim();

    tasks.push({
      source_file: sourceFile,
      source_type: 'ceo_todo',
      title,
      description: description || block.slice(0, 500),
      worker_type: detectWorkerType(block),
      priority: detectPriority(block),
    });
  }
  return tasks;
}

/**
 * Parse 365-Day Plan — week-by-week, look for checkbox todos
 */
function parse365Plan(content: string, sourceFile: string): Task[] {
  const tasks: Task[] = [];
  const lines = content.split('\n');
  let currentWeek = '';
  let currentContext: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track week headers
    const weekMatch = line.match(/^#+\s*(Week \d+.*)/i);
    if (weekMatch) {
      currentWeek = weekMatch[1].trim();
      currentContext = [];
      continue;
    }

    // Collect context lines (non-checkbox paragraphs)
    if (line.trim() && !line.match(/^- \[[ xX]\]/)) {
      currentContext.push(line.trim());
      if (currentContext.length > 5) currentContext.shift();
    }

    // Unchecked checkbox todos
    const todoMatch = line.match(/^- \[ \]\s+(.+)/);
    if (!todoMatch) continue;

    const todoText = todoMatch[1].trim();
    const title = currentWeek ? `[${currentWeek}] ${todoText}` : todoText;
    const context = currentContext.join(' ');

    tasks.push({
      source_file: sourceFile,
      source_type: '365_plan',
      title,
      description: context ? `Context: ${context}\n\nTask: ${todoText}` : todoText,
      worker_type: detectWorkerType(todoText + ' ' + context),
      priority: detectPriority(todoText, currentWeek),
    });
  }
  return tasks;
}

/**
 * Parse "What We Need To Implement" — numbered priority list
 */
function parseImplementationGaps(content: string, sourceFile: string): Task[] {
  const tasks: Task[] = [];
  // Match P0/P1/P2 sections with numbered items
  const sections = content.split(/(?=^### P\d)/m);

  for (const section of sections) {
    const sectionPriority = section.match(/^### (P\d)/m)?.[1];
    if (!sectionPriority) continue;
    const priority = parseInt(sectionPriority.replace('P', ''));

    // Match numbered items like "**5.1 Title**"
    const items = section.split(/(?=^\*\*\d+\.\d+)/m);
    for (const item of items) {
      const titleMatch = item.match(/^\*\*\d+\.\d+\s+([^*]+)\*\*/m);
      if (!titleMatch) continue;
      const title = titleMatch[1].trim();
      const description = item.replace(/^\*\*[^*]+\*\*/, '').trim().slice(0, 800);

      tasks.push({
        source_file: sourceFile,
        source_type: 'implementation_gaps',
        title,
        description,
        worker_type: detectWorkerType(item),
        priority,
      });
    }
  }
  return tasks;
}

/**
 * Parse weekly outreach/goal reports
 */
function parseWeeklyReport(content: string, sourceFile: string): Task[] {
  const tasks: Task[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const todoMatch = line.match(/^- \[ \]\s+(.+)/);
    if (!todoMatch) continue;
    const todoText = todoMatch[1].trim();

    tasks.push({
      source_file: sourceFile,
      source_type: 'weekly_report',
      title: todoText,
      description: todoText,
      worker_type: detectWorkerType(todoText),
      priority: 1,
    });
  }
  return tasks;
}

// ─── Spec file writer ─────────────────────────────────────────────────────────

function writeSpecFile(task: Task): string {
  const slug = task.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  const filename = `${slug}.md`;
  const specPath = path.join(SPECS_DIR, filename);

  const content = `# ${task.title}

**Source:** ${task.source_file}
**Type:** ${task.worker_type}
**Priority:** P${task.priority}

## Task

${task.description}

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via \`logEvent()\` from \`lib/events.ts\`
- No type errors (\`tsc --noEmit\` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to \`.agent-runs/summary-${Date.now()}.md\`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
`;

  if (!DRY_RUN) {
    fs.mkdirSync(SPECS_DIR, { recursive: true });
    fs.writeFileSync(specPath, content);
  }
  return filename;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📥 Dentago Agent Task Ingester ${DRY_RUN ? '[DRY RUN]' : ''}\n`);

  // 1. Fetch all todo sources from Obsidian
  // Auto-discover all weekly report files in Dentago/Reports/
  const reportsDir = path.join(VAULT_PATH, 'Dentago/Reports');
  const weeklyReports = fs.existsSync(reportsDir)
    ? fs.readdirSync(reportsDir)
        .filter(f => f.endsWith('.md'))
        .map(f => ({ file: `Dentago/Reports/${f}`, parser: parseWeeklyReport }))
    : [];

  // Auto-discover all weekly plan files in Personal/
  const personalDir = path.join(VAULT_PATH, 'Personal');
  const personalWeeklyFiles = fs.existsSync(personalDir)
    ? fs.readdirSync(personalDir)
        .filter(f => f.endsWith('.md') && /^Week \d+/.test(f) && !f.toLowerCase().includes('password'))
        .map(f => ({ file: `Personal/${f}`, parser: parse365Plan }))
    : [];

  const sources: Array<{ file: string; parser: (c: string, f: string) => Task[] }> = [
    { file: 'Dentago/CEO TODOs — 1 May 2026.md', parser: parseCEOTodos },
    { file: 'Dentago/365-Day Plan.md', parser: parse365Plan },
    { file: 'Dentago/What We Need To Implement.md', parser: parseImplementationGaps },
    ...weeklyReports,
    ...personalWeeklyFiles,
  ];

  const allTasks: Task[] = [];

  for (const { file, parser } of sources) {
    try {
      console.log(`  📄 Reading: ${file}`);
      const content = readVaultFile(file);
      const parsed = parser(content, file);
      console.log(`     → ${parsed.length} todos found`);
      allTasks.push(...parsed);
    } catch (err) {
      console.warn(`     ⚠️  Could not read ${file}: ${(err as Error).message}`);
    }
  }

  console.log(`\n  Total: ${allTasks.length} tasks parsed\n`);

  if (DRY_RUN) {
    for (const t of allTasks) {
      console.log(`  [${t.priority === 0 ? 'P0' : t.priority === 1 ? 'P1' : 'P2'}] [${t.worker_type}] ${t.title.slice(0, 70)}`);
    }
    return;
  }

  // 2. Check which tasks already exist (by title) to avoid duplicates
  const { data: existing } = await supabase
    .from('agent_tasks')
    .select('title')
    .in('status', ['pending', 'claimed', 'in_progress', 'qa_review', 'done']);

  const existingTitles = new Set((existing ?? []).map((r: { title: string }) => r.title));
  const newTasks = allTasks.filter(t => !existingTitles.has(t.title));

  console.log(`  ${existingTitles.size} already queued, ${newTasks.length} new to insert\n`);

  // 3. Write spec files + insert to Supabase
  let inserted = 0;
  for (const task of newTasks) {
    const specFilename = writeSpecFile(task);
    const { error } = await supabase.from('agent_tasks').insert({
      ...task,
      spec_file: path.join(SPECS_DIR, specFilename),
    });
    if (error) {
      console.error(`  ❌ Insert failed for "${task.title}": ${error.message}`);
    } else {
      inserted++;
      console.log(`  ✅ [P${task.priority}][${task.worker_type}] ${task.title.slice(0, 65)}`);
    }
  }

  console.log(`\n✨ Done — ${inserted} tasks added to queue\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
