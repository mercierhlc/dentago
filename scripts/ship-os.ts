/**
 * Production deploy + mandatory Events row (so /os Events shows ships without manual reminders).
 *
 * Usage: npm run ship:os [-- optional note words...]
 * Requires .env.local with SUPABASE_SERVICE_ROLE_KEY (for logEvent) and Vercel CLI logged in.
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(__dirname, "..");

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv(path.join(ROOT, ".env.local"));

  const noteArg = process.argv.slice(2).filter((a) => !a.startsWith("-")).join(" ").trim();
  const note = noteArg || "Production deploy (OS / full site via Vercel CLI).";

  process.chdir(ROOT);
  execSync("npx vercel deploy --prod --yes", { stdio: "inherit", env: process.env });

  const { logEvent } = await import("../lib/events");
  await logEvent({
    event_type: "production_deploy",
    entity_type: "deployment",
    entity_id: `ship-os-${new Date().toISOString().slice(0, 10)}-${Date.now()}`,
    payload: {
      summary_lines: [
        note,
        "Completed via `npm run ship:os` (Vercel CLI). Inspect deployment in Vercel if you need build logs.",
      ],
      target: "production",
      trigger: "ship-os-script",
    },
    source: "ship_os_script",
  });

  console.log("\n[ship-os] Logged production_deploy → events (source: ship_os_script)\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
