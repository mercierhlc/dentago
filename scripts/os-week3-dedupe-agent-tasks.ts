/**
 * Removes duplicate Week 3 agent_tasks: if a title has a `done` row, drops extra `pending` rows.
 * Usage: npx tsx scripts/os-week3-dedupe-agent-tasks.ts
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "node:url";

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

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const TITLES = [
  "W3 · Cross-browser QA — Chrome, Safari (WebKit), Firefox",
  "W3 · Error states — spot-check logged-in order failure path",
  "W3 · Google Calendar MCP — demo pipeline",
  "W3 · Deliverability — Instantly.ai domain warm-up",
  "W3 · Growth — ProductHunt listing preparation",
];

const FOUNDER_TITLES = [
  "[FOUNDER APPROVAL] Confirm Google Postmaster Tools setup",
  "[FOUNDER APPROVAL] Approve Instantly.ai vs alternatives",
  "[FOUNDER APPROVAL] Google Calendar MCP scope",
  "[FOUNDER APPROVAL] ProductHunt launch timing",
];

async function main() {
  for (const title of TITLES) {
    const { data: rows, error } = await supabase
      .from("agent_tasks")
      .select("id, status, created_at")
      .eq("title", title)
      .order("created_at", { ascending: true });

    if (error || !rows?.length) continue;

    const hasDone = rows.some((r) => r.status === "done");
    const pendingIds = rows.filter((r) => r.status === "pending").map((r) => r.id);

    if (hasDone && pendingIds.length > 0) {
      const { error: delErr } = await supabase.from("agent_tasks").delete().in("id", pendingIds);
      console.log(delErr ? `❌ ${title}: ${delErr.message}` : `🗑 removed ${pendingIds.length} pending dup(es): ${title.slice(0, 48)}…`);
      continue;
    }

    if (!hasDone && pendingIds.length > 1) {
      const [, ...rest] = pendingIds;
      const { error: delErr } = await supabase.from("agent_tasks").delete().in("id", rest);
      console.log(delErr ? `❌ ${title}: ${delErr.message}` : `🗑 deduped pending for ${title.slice(0, 48)}…`);
    }
  }

  for (const title of FOUNDER_TITLES) {
    const { data: rows, error } = await supabase
      .from("agent_tasks")
      .select("id, status, created_at")
      .eq("title", title)
      .order("created_at", { ascending: true });

    if (error || !rows || rows.length <= 1) continue;

    const pending = rows.filter((r) => r.status === "pending");
    if (pending.length <= 1) continue;

    const [, ...drop] = pending.map((r) => r.id);
    const { error: delErr } = await supabase.from("agent_tasks").delete().in("id", drop);
    console.log(
      delErr
        ? `❌ founder dup ${title}: ${delErr.message}`
        : `🗑 founder approvals deduped (${drop.length}): ${title.slice(0, 42)}…`
    );
  }
}

main().catch(console.error);
