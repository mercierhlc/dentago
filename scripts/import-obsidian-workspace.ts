/**
 * import-obsidian-workspace.ts
 * Reads every Obsidian note and upserts into workspace_notes in Supabase.
 * Skips password files. Auto-categorises by folder path.
 *
 * Usage: npx tsx scripts/import-obsidian-workspace.ts
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

const VAULT = '/Users/mercier/Documents/MCP Projects/MCP Test';

// Files to never import
const SKIP = ['Passwords.md', 'Passwords & API Keys.md'];

// Category mapping by folder path
function categorise(relPath: string): { category: string; subcategory: string | null } {
  const parts = relPath.split('/');
  const folder = parts[0];
  const subfolder = parts.length > 2 ? parts[1] : null;

  // ── Main business categories ──────────────────────────────────────────────
  // Sales  · Marketing  · Product  · Operations  · Finance  · Suppliers  · Intelligence  · Planning  · Learning

  if (folder === 'Personal') return { category: 'To-Dos', subcategory: 'Weekly Plans' };
  if (folder === 'Life Lessons') return { category: 'Learning', subcategory: 'Life Lessons' };
  if (folder === "Explicit things I've learned") return { category: 'Learning', subcategory: 'Lessons Learned' };
  if (folder === 'Starting a startup') return { category: 'Learning', subcategory: 'Startup Education' };
  if (folder === 'Products') return { category: 'Intelligence', subcategory: 'Market Research' };
  if (folder === 'Templates') return { category: 'Operations', subcategory: 'Templates' };
  if (folder === 'Demo Calls') return { category: 'Sales', subcategory: 'Demo Calls' };

  if (folder === 'Dentago') {
    if (subfolder === 'Clients') return { category: 'Sales', subcategory: 'Clients' };
    if (subfolder === 'Demo Calls') return { category: 'Sales', subcategory: 'Demo Calls' };
    if (subfolder === 'Intelligence') return { category: 'Intelligence', subcategory: 'Briefings & Research' };
    if (subfolder === 'Reports') return { category: 'Intelligence', subcategory: 'Reports & Analytics' };
    if (subfolder === 'Supplier Outreach') return { category: 'Suppliers', subcategory: 'Outreach' };

    const title = parts[parts.length - 1].toLowerCase();
    // Marketing & Outreach
    if (title.includes('outreach') || title.includes('email') || title.includes('calendly') || title.includes('bda') || title.includes('cold') || title.includes('linkedin') || title.includes('automated email')) return { category: 'Marketing', subcategory: 'Outreach' };
    // Suppliers
    if (title.includes('supplier')) return { category: 'Suppliers', subcategory: null };
    // Finance
    if (title.includes('revenue') || title.includes('expense') || title.includes('projection')) return { category: 'Finance', subcategory: null };
    // Product
    if (title.includes('product') || title.includes('design') || title.includes('implement') || title.includes('sku') || title.includes('os —') || title.includes('architecture')) return { category: 'Product', subcategory: null };
    // Operations
    if (title.includes('report') || title.includes('analytics') || title.includes('week 3 —')) return { category: 'Operations', subcategory: 'Reports' };
    // Strategy (CEO, planning, GTM)
    if (title.includes('ceo') || title.includes('365') || title.includes('paid ads') || title.includes('marketing') || title.includes('competitor') || title.includes('hiring') || title.includes('wellplaece')) return { category: 'Strategy', subcategory: null };
    return { category: 'Strategy', subcategory: null };
  }

  return { category: 'Operations', subcategory: null };
}

function extractTags(content: string, title: string): string[] {
  const tags: string[] = [];
  if (/outreach|email|cold/i.test(title + content)) tags.push('outreach');
  if (/supplier|henry schein|dental sky|kent/i.test(title + content)) tags.push('supplier');
  if (/clinic|dentist|nhs/i.test(title + content)) tags.push('clinic');
  if (/revenue|mrr|gmv|arr|£/i.test(title + content)) tags.push('revenue');
  if (/week \d/i.test(title)) tags.push('weekly-plan');
  if (/demo|call/i.test(title)) tags.push('demo');
  if (/product|feature|build/i.test(title)) tags.push('product');
  if (/seo|blog|content/i.test(title + content)) tags.push('content');
  return [...new Set(tags)];
}

function walkDir(dir: string, base: string = dir): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      files.push(...walkDir(full, base));
    } else if (entry.endsWith('.md') && !SKIP.includes(entry)) {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

async function main() {
  console.log('\n📚 Importing Obsidian workspace into Supabase...\n');

  const files = walkDir(VAULT);
  console.log(`Found ${files.length} markdown files (passwords skipped)\n`);

  let imported = 0;
  let failed = 0;
  const CHUNK = 20;

  for (let i = 0; i < files.length; i += CHUNK) {
    const batch = files.slice(i, i + CHUNK);
    const rows = [];

    for (const relPath of batch) {
      const fullPath = path.join(VAULT, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const title = path.basename(relPath, '.md');
      const { category, subcategory } = categorise(relPath);
      const tags = extractTags(content, title);
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      rows.push({
        title,
        content,
        category,
        subcategory,
        source_path: relPath,
        tags,
        word_count: wordCount,
        updated_at: new Date().toISOString(),
      });
    }

    const { error } = await supabase
      .from('workspace_notes')
      .upsert(rows, { onConflict: 'source_path' });

    if (error) {
      console.error(`  ❌ Batch ${i}–${i + CHUNK}: ${error.message}`);
      failed += batch.length;
    } else {
      imported += batch.length;
      process.stdout.write(`  ✅ ${imported}/${files.length} imported\r`);
    }
  }

  console.log(`\n\n📊 Done: ${imported} imported, ${failed} failed\n`);

  // Print category breakdown
  const { data } = await supabase
    .from('workspace_notes')
    .select('category')
    .order('category');

  if (data) {
    const counts: Record<string, number> = {};
    for (const r of data) counts[r.category] = (counts[r.category] ?? 0) + 1;
    console.log('Category breakdown:');
    for (const [cat, count] of Object.entries(counts).sort()) {
      console.log(`  ${cat}: ${count} notes`);
    }
  }
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
