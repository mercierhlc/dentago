/**
 * Local admin: decrypt a stored supplier password from supplier_credentials.
 *
 * Run on your machine only. Requires the same CREDENTIAL_SECRET as production
 * (default in lib/crypto.ts if unset) plus Supabase service role.
 *
 * Usage:
 *   npx tsx scripts/decrypt-supplier-credential.ts --list --clinic-id <clinic_accounts.id uuid>
 *   npx tsx scripts/decrypt-supplier-credential.ts --clinic-id <uuid> --supplier "Henry Schein"
 *
 * Env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   CREDENTIAL_SECRET — must match the deploy that encrypted the row
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "../lib/crypto";

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

function parseArgs(argv: string[]) {
  const out: { list?: boolean; clinicId?: string; supplier?: string } = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") out.list = true;
    else if (a === "--clinic-id" && argv[i + 1]) {
      out.clinicId = argv[++i].trim();
    } else if (a === "--supplier" && argv[i + 1]) {
      out.supplier = argv[++i].trim();
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const clinicId = args.clinicId;
  if (!clinicId) {
    console.error(`Usage:
  npx tsx scripts/decrypt-supplier-credential.ts --list --clinic-id <uuid>
  npx tsx scripts/decrypt-supplier-credential.ts --clinic-id <uuid> --supplier "Henry Schein"`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: rows, error } = await supabase
    .from("supplier_credentials")
    .select("id, username, encrypted_password, suppliers(name)")
    .eq("clinic_id", clinicId);

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.error("No supplier_credentials rows for this clinic_id.");
    process.exit(1);
  }

  if (args.list) {
    console.log(`Credentials for clinic ${clinicId} (${rows.length} row(s)):\n`);
    for (const r of rows as { id: string; username: string; suppliers: { name: string } | null }[]) {
      const name = r.suppliers?.name ?? "(unknown supplier)";
      console.log(`  supplier: ${name}`);
      console.log(`  username: ${r.username}`);
      console.log(`  id:       ${r.id}`);
      console.log("");
    }
    console.log("Decrypt one row: add --supplier \"Exact name from supplier\" (see above).");
    process.exit(0);
  }

  const supplierName = args.supplier;
  if (!supplierName) {
    console.error("Provide --supplier \"Name\" or use --list first. Example: --supplier \"Henry Schein\"");
    process.exit(1);
  }

  const row = (rows as { id: string; username: string; encrypted_password: string; suppliers: { name: string } | null }[]).find(
    (r) => (r.suppliers?.name ?? "").trim() === supplierName.trim()
  );

  if (!row) {
    console.error(`No credential for supplier "${supplierName}". Use --list to see exact names.`);
    process.exit(1);
  }

  let password: string;
  try {
    password = decrypt(row.encrypted_password);
  } catch (e) {
    console.error("Decrypt failed — CREDENTIAL_SECRET may not match the environment that encrypted this row.");
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  console.log(`supplier: ${supplierName}`);
  console.log(`username: ${row.username}`);
  console.log(`password: ${password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
