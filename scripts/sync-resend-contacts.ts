/**
 * sync-resend-contacts.ts
 *
 * Pulls every email sent via Resend, upserts contacts and messages into
 * the CRM tables (contacts + messages). Same logic as cron:
 *   GET /api/cron/sync-resend-contacts
 *
 * Usage: npx tsx scripts/sync-resend-contacts.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { syncResendContactsToCrm } from "../lib/resend-crm-sync";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resend = process.env.RESEND_API_KEY;
  if (!url || !key || !resend) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY");
    process.exit(1);
  }

  console.log("\n📨  Syncing Resend → CRM contacts + messages…\n");

  const supabase = createClient(url, key);
  const result = await syncResendContactsToCrm(supabase, resend, {
    onProgress: (line) => process.stdout.write(`  ${line}\r`),
  });

  console.log("\n");
  console.log("  Result:", result);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
