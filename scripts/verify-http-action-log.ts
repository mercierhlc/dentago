/**
 * Smoke test: hit local Next dev server and confirm middleware wrote http_action to Supabase.
 *
 * Usage (with dev server on 127.0.0.1:3000):
 *   npx tsx scripts/verify-http-action-log.ts
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv(path.resolve(__dirname, "..", ".env.local"));

async function main() {
  const base = process.env.VERIFY_HTTP_LOG_URL ?? "http://127.0.0.1:3000";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const pathProbe = `/api/suppliers?_verify_http_action=${Date.now()}`;
  const hit = await fetch(`${base}${pathProbe}`, { headers: { Accept: "application/json" } });
  console.log(`GET ${pathProbe} → HTTP ${hit.status}`);
  if (!hit.ok) {
    console.error("Dev server returned non-OK; start `npm run dev` or set VERIFY_HTTP_LOG_URL");
    process.exit(1);
  }

  await new Promise((r) => setTimeout(r, 800));

  const q = new URL(`${url}/rest/v1/events`);
  q.searchParams.set("select", "id,event_type,payload,source,created_at");
  q.searchParams.set("event_type", "eq.http_action");
  q.searchParams.set("source", "eq.edge_middleware");
  q.searchParams.set("order", "created_at.desc");
  q.searchParams.set("limit", "8");

  const list = await fetch(q.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const rows = (await list.json()) as Array<{ payload?: { pathname?: string; search?: string } }>;
  if (!Array.isArray(rows)) {
    console.error("Unexpected Supabase response:", rows);
    process.exit(1);
  }

  const match = rows.find(
    (r) =>
      r.payload?.pathname === "/api/suppliers" &&
      String(r.payload?.search ?? "").includes("_verify_http_action=")
  );

  if (!match) {
    console.error(
      "FAIL: No recent edge_middleware http_action for /api/suppliers with probe query.\nLast rows:",
      JSON.stringify(rows, null, 2)
    );
    process.exit(1);
  }

  console.log("PASS: middleware → Supabase events row exists:", match.payload?.pathname, match.payload?.search?.slice(0, 80));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
