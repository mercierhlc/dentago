/**
 * Reset a Supabase Auth user's password (admin).
 *
 * Usage:
 *   npx tsx scripts/reset-user-password.ts warrenbenh@gmail.com
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

const emailArg = process.argv[2];
if (!emailArg) {
  console.error("Usage: npx tsx scripts/reset-user-password.ts <email>");
  process.exit(1);
}

const EMAIL = emailArg.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

function makeTempPassword() {
  // Human-typeable, avoids ambiguous chars. ~18 chars.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(18);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return `Dtg-${out}`;
}

async function main() {
  const tempPassword = makeTempPassword();

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    console.error("listUsers:", listErr.message);
    process.exit(1);
  }

  const user = list.users.find((u) => u.email?.toLowerCase() === EMAIL);
  if (!user) {
    console.error(`Could not find ${EMAIL} in first page of listUsers.`);
    process.exit(1);
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
    password: tempPassword,
    email_confirm: true,
  });
  if (updErr) {
    console.error("updateUserById:", updErr.message);
    process.exit(1);
  }

  // IMPORTANT: This prints the password. Run locally only.
  console.log(`ok email=${EMAIL} user_id=${user.id} temp_password=${tempPassword}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

