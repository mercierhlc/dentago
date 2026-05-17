/**
 * Creates or updates the Supabase Auth user used for /admin/login.
 *
 * Defaults: mercier@dentago.co.uk / dentago-admin-2024
 * Override: ADMIN_SEED_EMAIL=… ADMIN_SEED_PASSWORD=… npx tsx scripts/ensure-admin-user.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { DENTAGO_PRIMARY_ADMIN_EMAIL } from "../lib/admin-login-defaults";

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

const EMAIL = (process.env.ADMIN_SEED_EMAIL ?? DENTAGO_PRIMARY_ADMIN_EMAIL).trim().toLowerCase();
const PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? "dentago-admin-2024";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

  if (!createErr && created.user) {
    console.log(`Created admin user: ${EMAIL}`);
    return;
  }

  const msg = createErr?.message ?? "";
  const duplicate =
    msg.includes("already been registered") ||
    msg.includes("already exists") ||
    msg.toLowerCase().includes("duplicate");

  if (!duplicate) {
    console.error("createUser:", createErr?.message ?? createErr);
    process.exit(1);
  }

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
    console.error(`User exists but could not find ${EMAIL} in first page of listUsers.`);
    process.exit(1);
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (updErr) {
    console.error("updateUserById:", updErr.message);
    process.exit(1);
  }

  console.log(`Updated password for admin user: ${EMAIL}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
