/**
 * Insert one row into OS `events` via logEvent (service role).
 * Loads ../.env.local before importing lib (required for Supabase client).
 *
 * Usage: npx tsx scripts/log-os-event.ts
 *
 * Edit the payload in main() for future manual logs.
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

async function main() {
  const { logEvent } = await import('../lib/events');

  await logEvent({
    event_type: 'feature_shipped',
    entity_type: 'platform',
    entity_id: 'os-doctrine-v1',
    payload: {
      title: 'OS doctrine, dashboard link, agent hooks, production deploy',
      shipped: [
        'public/os/OS-DOCTRINE.md (canonical charter; served at /os/OS-DOCTRINE.md)',
        'app/os/page.tsx — Overview link to doctrine markdown',
        'CLAUDE.md — charter pointer + Key Files row',
        '.cursor/rules/dentago-os.mdc — alwaysApply OS discipline',
        'vercel deploy --prod → dentago.co.uk',
        'app/api/admin/update-status/route.ts — fixed invalid ternary comma (build blocker)',
      ],
    },
    source: 'cursor_agent_session',
  });

  console.log('Logged feature_shipped → events (platform/os-doctrine-v1)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
