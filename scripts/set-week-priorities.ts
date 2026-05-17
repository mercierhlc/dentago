/**
 * Sets priority = week number on all goals and agent_tasks
 * so they are worked through week 1 → week 65 in order.
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
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function updateTable(table: 'goals' | 'agent_tasks') {
  const { data, error } = await s.from(table).select('id, title');
  if (error) { console.error(error); return; }

  let updated = 0;
  const CHUNK = 100;
  const rows = (data ?? []) as { id: string; title: string }[];

  // Build batches grouped by week number
  const byWeek: Record<number, string[]> = {};
  for (const row of rows) {
    const match = row.title.match(/\[Week (\d+)/i) || row.title.match(/WEEK (\d+)/i);
    if (!match) continue;
    const week = parseInt(match[1]);
    if (!byWeek[week]) byWeek[week] = [];
    byWeek[week].push(row.id);
  }

  for (const [week, ids] of Object.entries(byWeek)) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await s.from(table).update({ priority: parseInt(week) }).in('id', chunk);
      updated += chunk.length;
    }
  }
  console.log(`  ${table}: updated priority for ${updated} rows`);
}

async function main() {
  console.log('\n🔢 Setting week-based priorities...\n');
  await updateTable('goals');
  await updateTable('agent_tasks');
  console.log('\n✅ Done\n');
}
main().catch(e => { console.error(e); process.exit(1); });
