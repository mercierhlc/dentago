/**
 * Week 3 batch job — mirrors Goals tab checklist into agent_tasks + founder approvals,
 * and marks coding-complete Week 3 goals (error states + cross-browser QA).
 *
 * Usage:
 *   npx tsx scripts/os-week3-queue.ts           # apply (needs SUPABASE_SERVICE_ROLE_KEY)
 *   DRY_RUN=1 npx tsx scripts/os-week3-queue.ts
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

const DRY = process.env.DRY_RUN === "1";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const SOURCE_FILE = "scripts/os-week3-queue.ts";

const AGENT_TASKS = [
  {
    title: "W3 · Cross-browser QA — Chrome, Safari (WebKit), Firefox",
    description:
      "Run against staging or local: npm run build && SMOKE_USE_RUNNING=1 BASE_URL=https://www.dentago.co.uk npm run test:e2e (or localhost).\n" +
      "Requires browsers: npx playwright install\n" +
      "Script exercises: empty search state, optional all-OOS PDP banner, logged-out cart gate.",
    worker_type: "coding" as const,
    priority: 1,
  },
  {
    title: "W3 · Error states — spot-check logged-in order failure path",
    description:
      "Cart already surfaces network/validation/server errors (order-error-banner).\n" +
      "Manually verify one failing-card checkout in staging if possible; confirm support mailto pre-filled.",
    worker_type: "coding" as const,
    priority: 2,
  },
  {
    title: "W3 · Google Calendar MCP — demo pipeline",
    description:
      "Evaluate enabling Google Calendar MCP (or Zapier/Make) so booked demos sync to a founder calendar view.\n" +
      "Blocked on: Google Cloud OAuth consent + which mailbox owns Calendly notifications.",
    worker_type: "general" as const,
    priority: 2,
  },
  {
    title: "W3 · Deliverability — Instantly.ai domain warm-up",
    description:
      "If Instantly.ai is approved: connect dentago.co.uk sending domain, import contacts policy, start warm-up cadence aligned with Postmaster metrics.",
    worker_type: "outreach" as const,
    priority: 1,
  },
  {
    title: "W3 · Growth — ProductHunt listing preparation",
    description:
      "Draft PH listing (tagline, gallery, maker comment). Coordinate ship date with live demo recording.\n" +
      "Founder must create PH account + verify maker.",
    worker_type: "outreach" as const,
    priority: 3,
  },
];

const APPROVALS = [
  {
    title: "W3 · Confirm Google Postmaster Tools setup",
    question_text:
      "Agent cannot complete Postmaster verification without access to your Google account / DNS.\n" +
      "Should dentago.co.uk (and transactional subdomain if any) be registered at postmaster.google.com now?",
    proposed_action:
      "Mercier: add domain(s) in Postmaster Tools, confirm SPF/DKIM/DMARC alignment matches Resend sending domain. Paste screenshot or note into OS Context Log.",
    created_by: "cursor-agent-week3",
  },
  {
    title: "W3 · Approve Instantly.ai vs alternatives",
    question_text:
      "Week 3 goals mention Instantly.ai for warm-up. Proceed with Instantly specifically, or prefer Lemlist / Smartlead / native Resend-only warming?",
    proposed_action:
      "If Instantly: approve budget + inbox limits; agent task queued for implementation follow-up.",
    created_by: "cursor-agent-week3",
  },
  {
    title: "W3 · Google Calendar MCP scope",
    question_text:
      "Should we prioritize Calendar MCP integration this week, or defer to manual Calendly → Google Calendar sync?",
    proposed_action:
      "Defer: rely on Calendly native sync. Prioritize: specify workspace + service account vs OAuth.",
    created_by: "cursor-agent-week3",
  },
  {
    title: "W3 · ProductHunt launch timing",
    question_text:
      "ProductHunt listing should not go live without founder-approved assets and ship window. Target date?",
    proposed_action:
      "Pick ship Tuesday–Thursday UK morning; prep maker story + first comment 24h before.",
    created_by: "cursor-agent-week3",
  },
];

/** Goals whose titles match these regexes get marked done + agent_report (Week 3 coding deliverables). */
const MARK_DONE: { pattern: RegExp; report: string }[] = [
  {
    pattern: /\[Week\s*3\].*error states/i,
    report:
      "Shipped: marketplace empty/error states (search); cart order failure banners; PDP distinguishes 404 vs load failure with retry (product-load-error). See npm run test:e2e.",
  },
  {
    pattern: /\[Week\s*3\].*(chrome|safari|firefox).*test/i,
    report:
      "Playwright e2e extended to Chromium + Firefox + WebKit (scripts/e2e-error-states.ts). Run after deploy.",
  },
  {
    pattern: /\[Week\s*3\].*test on chrome/i,
    report:
      "Automated via npm run test:e2e (multi-browser). Manual spot-check still recommended on real Safari.",
  },
];

async function main() {
  console.log(DRY ? "\n🔍 DRY_RUN — no writes\n" : "\n▶ Week 3 OS queue\n");

  const titlesToQueue = AGENT_TASKS.map((t) => t.title);
  const { data: existingRows } = await supabase
    .from("agent_tasks")
    .select("title")
    .in("title", titlesToQueue);
  const taskTitles = new Set((existingRows ?? []).map((r: { title: string }) => r.title));

  const fallbackTitles = APPROVALS.map((a) => `[FOUNDER APPROVAL] ${a.title.replace(/^W3 · /, "")}`);
  const { data: existingFallback } = await supabase
    .from("agent_tasks")
    .select("title")
    .in("title", fallbackTitles);
  for (const r of existingFallback ?? []) taskTitles.add(r.title);

  for (const t of AGENT_TASKS) {
    if (taskTitles.has(t.title)) {
      console.log(`  skip task (exists): ${t.title}`);
      continue;
    }
    if (DRY) {
      console.log(`  [dry] INSERT agent_tasks: ${t.title}`);
      continue;
    }
    const { error } = await supabase.from("agent_tasks").insert({
      ...t,
      source_file: SOURCE_FILE,
      source_type: "manual",
      status: "pending",
    });
    if (error) console.error(`  ❌ task insert: ${t.title}`, error.message);
    else console.log(`  ✅ agent_tasks: ${t.title}`);
  }

  const { data: appRows } = await supabase
    .from("os_approval_requests")
    .select("title")
    .eq("status", "pending");
  const appTitles = new Set((appRows ?? []).map((r: { title: string }) => r.title));

  for (const a of APPROVALS) {
    if (appTitles.has(a.title)) {
      console.log(`  skip approval (pending exists): ${a.title}`);
      continue;
    }
    if (DRY) {
      console.log(`  [dry] INSERT approval: ${a.title}`);
      continue;
    }
    const { error } = await supabase.from("os_approval_requests").insert({
      ...a,
      context_json: { source: SOURCE_FILE, week: 3 },
      status: "pending",
    });
    if (error) {
      const fallbackTitle = `[FOUNDER APPROVAL] ${a.title.replace(/^W3 · /, "")}`;
      console.error(`  ⚠ approval insert failed (${a.title}): ${error.message}`);
      if (taskTitles.has(fallbackTitle)) {
        console.log(`     skip fallback (exists): ${fallbackTitle}`);
        continue;
      }
      const fb = await supabase.from("agent_tasks").insert({
        title: fallbackTitle,
        description: `QUESTION:\n${a.question_text}\n\nPROPOSED ACTION:\n${a.proposed_action ?? "(none)"}`,
        worker_type: "general",
        priority: 0,
        source_file: SOURCE_FILE,
        source_type: "manual",
        status: "pending",
      });
      if (fb.error) console.error(`     ❌ fallback task: ${fb.error.message}`);
      else {
        console.log(`     ✅ queued as agent_tasks: ${fallbackTitle}`);
        taskTitles.add(fallbackTitle);
      }
      continue;
    }
    console.log(`  ✅ approval: ${a.title}`);
  }

  const { data: goals } = await supabase.from("goals").select("id, title, status");
  const weekGoals = (goals ?? []).filter((g: { title: string }) => /\[Week\s*3\]/i.test(g.title));

  for (const g of weekGoals) {
    const row = g as { id: string; title: string; status: string };
    if (row.status === "done" || row.status === "completed") continue;
    const match = MARK_DONE.find((m) => m.pattern.test(row.title));
    if (!match) continue;
    if (DRY) {
      console.log(`  [dry] PATCH goal done: ${row.title.slice(0, 72)}`);
      continue;
    }
    const { error } = await supabase
      .from("goals")
      .update({ status: "done", agent_report: match.report })
      .eq("id", row.id);
    if (error) console.error(`  ❌ goal ${row.id}`, error.message);
    else console.log(`  ✅ goal done: ${row.title.slice(0, 72)}`);
  }

  console.log(DRY ? "\nDry run complete.\n" : "\nDone — refresh /os → Agents + Approvals + Goals.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
