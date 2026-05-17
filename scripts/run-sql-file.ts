/**
 * Run a single SQL file against Postgres (uses DATABASE_URL from .env / .env.local).
 * Usage: npx tsx scripts/run-sql-file.ts path/to/file.sql
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Usage: npx tsx scripts/run-sql-file.ts <path.sql>");
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), fileArg);
const sql = fs.readFileSync(sqlPath, "utf8");
const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL not set (.env required for direct Postgres)");
  process.exit(1);
}

async function main() {
  const client = new pg.Client({
    connectionString: conn,
    ssl: conn.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("OK:", sqlPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
