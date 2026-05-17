/**
 * merge-weekly-todos.ts
 *
 * Groups all Personal/Week*.md files by week number, merges duplicate files
 * into one clean markdown per week, deduplicates todo items, and upserts
 * into workspace_notes with category="To-Dos" and proper week_number ordering.
 *
 * Usage: npx tsx scripts/merge-weekly-todos.ts
 */

import * as fs from 'fs';
import * as path from 'path';

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

const PERSONAL = '/Users/mercier/Documents/MCP Projects/MCP Test/Personal';

function extractWeekNumber(filename: string): number | null {
  // "Week 1.md", "Week 1 To-Do List.md", "Week 10 — Days 69-75.md", "Week 13-14 — ..."
  const m = filename.match(/^Week (\d+)/i);
  return m ? parseInt(m[1]) : null;
}

function extractTodos(content: string): string[] {
  return content.split('\n')
    .filter(l => /^\s*- \[[ x]\]/.test(l))
    .map(l => l.trim());
}

function mergeTodos(todos: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of todos) {
    for (const todo of list) {
      // Normalise for dedup: strip checkbox prefix, lowercase, trim
      const key = todo.replace(/^- \[[ x]\]\s*/i, '').toLowerCase().trim().slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(todo);
      }
    }
  }
  return result;
}

function buildMergedMarkdown(weekNum: number, files: { name: string; content: string }[]): string {
  // Use the plain "Week N.md" as primary if available, else longest
  const primary = files.find(f => /^Week \d+\.md$/i.test(f.name))
    ?? files.reduce((a, b) => a.content.length >= b.content.length ? a : b);

  // Collect all todos from all files, merge + dedup
  const allTodos = mergeTodos(files.map(f => extractTodos(f.content)));

  // Build a clean frontmatter + content markdown
  const header = `---
week: ${weekNum}
category: To-Dos
title: Week ${weekNum}
---

# Week ${weekNum}

`;

  // Extract the first heading/subtitle from primary content if available
  const subtitle = primary.content
    .split('\n')
    .find(l => l.startsWith('# Week') && l.length > `# Week ${weekNum}`.length)
    ?.replace(/^# Week \d+\s*[—-]?\s*/, '') ?? '';

  const subtitleLine = subtitle ? `**${subtitle}**\n\n` : '';

  // All todos in one clean list
  const todoSection = allTodos.length > 0
    ? `## Tasks\n\n${allTodos.join('\n')}\n`
    : '';

  // Include non-todo content from primary (notes, context, etc.)
  const nonTodoContent = primary.content
    .split('\n')
    .filter(l => !/^\s*- \[[ x]\]/.test(l) && !l.startsWith('# Week'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const notesSection = nonTodoContent
    ? `\n## Notes\n\n${nonTodoContent}\n`
    : '';

  return header + subtitleLine + todoSection + notesSection;
}

async function main() {
  console.log('\n📋 Merging weekly To-Dos...\n');

  // First, delete all existing Planning/To-Dos entries to start clean
  await supabase.from('workspace_notes').delete().eq('category', 'Planning');
  await supabase.from('workspace_notes').delete().eq('category', 'To-Dos');
  console.log('  Cleared old Planning/To-Dos entries\n');

  // Read all Personal week files
  const files = fs.readdirSync(PERSONAL)
    .filter(f => f.endsWith('.md') && f.startsWith('Week'));

  // Group by week number
  const byWeek: Record<number, { name: string; content: string }[]> = {};
  for (const filename of files) {
    const weekNum = extractWeekNumber(filename);
    if (weekNum === null) continue;
    const content = fs.readFileSync(path.join(PERSONAL, filename), 'utf-8');
    if (!byWeek[weekNum]) byWeek[weekNum] = [];
    byWeek[weekNum].push({ name: filename, content });
  }

  const weekNumbers = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
  console.log(`  Found ${weekNumbers.length} unique weeks (${files.length} source files)\n`);

  const rows = weekNumbers.map(weekNum => {
    const weekFiles = byWeek[weekNum];
    const merged = buildMergedMarkdown(weekNum, weekFiles);
    const wordCount = merged.split(/\s+/).filter(Boolean).length;
    const todoCount = (merged.match(/- \[[ x]\]/g) ?? []).length;
    const doneCount = (merged.match(/- \[x\]/gi) ?? []).length;

    return {
      title: `Week ${weekNum}`,
      content: merged,
      category: 'To-Dos',
      subcategory: `Week ${weekNum}`,
      source_path: `Personal/merged/Week ${weekNum}.md`,
      tags: ['weekly-plan'],
      word_count: wordCount,
      week_number: weekNum,
      updated_at: new Date().toISOString(),
    };
  });

  // Upsert in batches
  let imported = 0;
  const CHUNK = 20;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('workspace_notes')
      .upsert(batch, { onConflict: 'source_path' });

    if (error) {
      console.error(`  ❌ Batch error: ${error.message}`);
    } else {
      imported += batch.length;
      process.stdout.write(`  ✅ ${imported}/${rows.length} weeks merged\r`);
    }
  }

  console.log(`\n\n✅ Done: ${imported} weeks upserted\n`);

  // Summary stats
  let totalTodos = 0;
  let doneTodos = 0;
  for (const row of rows) {
    totalTodos += (row.content.match(/- \[[ x]\]/g) ?? []).length;
    doneTodos += (row.content.match(/- \[x\]/gi) ?? []).length;
  }
  console.log(`  Total todos across all weeks: ${totalTodos}`);
  console.log(`  Completed: ${doneTodos} (${Math.round(doneTodos / totalTodos * 100)}%)`);
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
