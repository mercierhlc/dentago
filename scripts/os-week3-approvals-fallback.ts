/**
 * One-off fallback: Week 3 founder decisions as agent_tasks when os_approval_requests
 * table is not migrated yet.
 *
 *   npx tsx scripts/os-week3-approvals-fallback.ts
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "node:url";
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const TASKS = [
  {
    title: "[FOUNDER APPROVAL] W3 · Google Postmaster Tools",
    description:
      "QUESTION: Complete Postmaster verification for dentago.co.uk — agent blocked without Google/DNS access.\n\n" +
      "PROPOSED: Register domain(s) at postmaster.google.com; confirm SPF/DKIM/DMARC vs Resend.",
    worker_type: "general" as const,
    priority: 0,
  },
  {
    title: "[FOUNDER APPROVAL] W3 · Instantly.ai vs alternatives",
    description:
      "QUESTION: Proceed with Instantly.ai for warm-up or prefer Lemlist/Smartlead/Resend-only?\n\n" +
      "PROPOSED: If Instantly — approve budget + inbox limits.",
    worker_type: "general" as const,
    priority: 0,
  },
  {
    title: "[FOUNDER APPROVAL] W3 · Google Calendar MCP scope",
    description:
      "QUESTION: Prioritize Calendar MCP this week or defer to Calendly native sync?\n\n" +
      "PROPOSED: Defer unless explicit OAuth workspace owner.",
    worker_type: "general" as const,
    priority: 1,
  },
  {
    title: "[FOUNDER APPROVAL] W3 · ProductHunt launch timing",
    description:
      "QUESTION: PH ship window + asset approval.\n\n" +
      "PROPOSED: Tuesday–Thursday UK AM; prep maker comment 24h prior.",
    worker_type: "outreach" as const,
    priority: 1,
  },
];

async function main() {
  const { data: rows } = await supabase
    .from("agent_tasks")
    .select("title")
    .in("status", ["pending", "claimed", "in_progress", "qa_review"]);
  const have = new Set((rows ?? []).map((r: { title: string }) => r.title));

  for (const t of TASKS) {
    if (have.has(t.title)) {
      console.log("skip", t.title);
      continue;
    }
    const { error } = await supabase.from("agent_tasks").insert({
      ...t,
      source_file: "scripts/os-week3-approvals-fallback.ts",
      source_type: "manual",
      status: "pending",
    });
    if (error) console.error(error.message);
    else console.log("✅", t.title);
  }
}

main().catch(console.error);
