/**
 * Imports every unchecked todo from all Personal weekly files in Obsidian
 * into the Supabase goals table. Idempotent — skips titles already present.
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
const DRY_RUN = process.argv.includes('--dry-run');

interface GoalRow {
  title: string;
  category: string;
  status: string;
  target_outcome: string;
  acceptance_criteria: string;
  priority: number;
  approaches: string[];
  failure_context: unknown[];
  constraints: string[];
  agent_decomposition: unknown[];
  next_review_at: string;
  metric_current: number;
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/email|outreach|send|linkedin|follow.?up|message|contact|prospect/.test(lower)) return 'outreach';
  if (/build|implement|code|fix|page|api|database|deploy|supabase|feature/.test(lower)) return 'product';
  if (/supplier|henry schein|kent express|dd group|trycare|dental sky|partnership|agreement/.test(lower)) return 'supplier';
  if (/seo|blog|g2|capterra|content|search|listing|index/.test(lower)) return 'seo';
  if (/research|analyse|compare|audit|review|check|competitor/.test(lower)) return 'ai';
  return 'product';
}

function detectPriority(text: string, weekHeader: string): number {
  const combined = (text + ' ' + weekHeader).toLowerCase();
  if (/week [1-4]\b|p0|critical|urgent|before.*demo|before.*launch/.test(combined)) return 0;
  if (/week [5-9]\b|week 1[0-9]\b|p1|before.*may|50.clinic/.test(combined)) return 1;
  if (/week [2-5][0-9]\b|p2|year 2|series a/.test(combined)) return 2;
  return 3;
}

function parseWeeklyFile(content: string, sourceFile: string): GoalRow[] {
  const goals: GoalRow[] = [];
  const lines = content.split('\n');
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track section headers for context
    if (/^#+\s/.test(line)) {
      currentSection = line.replace(/^#+\s*/, '').trim();
    }

    // Only grab unchecked todos
    const match = line.match(/^[-*]\s+\[ \]\s+(.+)/);
    if (!match) continue;

    const todoText = match[1].trim();
    if (todoText.length < 5) continue;

    // Build a meaningful title including the week context
    const weekMatch = sourceFile.match(/Week (\d+)/i);
    const weekLabel = weekMatch ? `[Week ${weekMatch[1]}] ` : '';
    const title = currentSection
      ? `${weekLabel}${todoText}`
      : `${weekLabel}${todoText}`;

    const category = detectCategory(todoText);
    const priority = detectPriority(todoText, currentSection);

    // Next review: 3 days from now for current weeks, longer for future weeks
    const weekNum = weekMatch ? parseInt(weekMatch[1]) : 99;
    const daysUntilReview = weekNum <= 4 ? 3 : weekNum <= 12 ? 7 : 14;
    const nextReview = new Date(Date.now() + daysUntilReview * 24 * 60 * 60 * 1000).toISOString();

    goals.push({
      title: title.slice(0, 300),
      category,
      status: 'active',
      target_outcome: todoText,
      acceptance_criteria: todoText,
      priority,
      approaches: [],
      failure_context: [],
      constraints: [],
      agent_decomposition: [],
      next_review_at: nextReview,
      metric_current: 0,
    });
  }

  return goals;
}

async function main() {
  console.log(`\n📥 Importing goals from Obsidian Personal weekly files ${DRY_RUN ? '[DRY RUN]' : ''}\n`);

  const personalDir = path.join(VAULT_PATH, 'Personal');
  if (!fs.existsSync(personalDir)) {
    console.error('Personal folder not found at', personalDir);
    process.exit(1);
  }

  // Also read Dentago sources
  const dentagoDir = path.join(VAULT_PATH, 'Dentago');
  const dentagoFiles = fs.existsSync(dentagoDir)
    ? fs.readdirSync(dentagoDir).filter(f => f.endsWith('.md')).map(f => path.join(dentagoDir, f))
    : [];

  const personalFiles = fs.readdirSync(personalDir)
    .filter(f => f.endsWith('.md') && /^Week \d+/i.test(f) && !f.toLowerCase().includes('password'))
    .map(f => path.join(personalDir, f));

  const allFiles = [...personalFiles, ...dentagoFiles];
  console.log(`  Found ${personalFiles.length} Personal weekly files + ${dentagoFiles.length} Dentago files\n`);

  const allGoals: GoalRow[] = [];

  for (const filePath of allFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = filePath.replace(VAULT_PATH + '/', '');
      const parsed = parseWeeklyFile(content, relPath);
      if (parsed.length > 0) {
        console.log(`  📄 ${relPath.split('/').pop()} → ${parsed.length} todos`);
        allGoals.push(...parsed);
      }
    } catch (e) {
      console.warn(`  ⚠️  Could not read ${filePath}: ${(e as Error).message}`);
    }
  }

  console.log(`\n  Total parsed: ${allGoals.length} goals\n`);

  if (DRY_RUN) {
    for (const g of allGoals.slice(0, 20)) {
      console.log(`  [P${g.priority}][${g.category}] ${g.title.slice(0, 80)}`);
    }
    console.log(`  ... and ${Math.max(0, allGoals.length - 20)} more`);
    return;
  }

  // Fetch existing goal titles to skip duplicates
  const { data: existing } = await supabase.from('goals').select('title');
  const existingTitles = new Set((existing ?? []).map((r: { title: string }) => r.title));
  const newGoals = allGoals.filter(g => !existingTitles.has(g.title));

  console.log(`  ${existingTitles.size} already exist, inserting ${newGoals.length} new goals...\n`);

  // Batch insert in chunks of 100
  let inserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < newGoals.length; i += CHUNK) {
    const chunk = newGoals.slice(i, i + CHUNK);
    const { error } = await supabase.from('goals').insert(chunk);
    if (error) {
      console.error(`  ❌ Batch ${Math.floor(i / CHUNK) + 1} failed:`, error.message);
    } else {
      inserted += chunk.length;
      process.stdout.write(`  ✅ Inserted ${inserted}/${newGoals.length}\r`);
    }
  }

  console.log(`\n\n✨ Done — ${inserted} goals added to the OS\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
