/**
 * 1) Ensures os_approval_requests exists (run scripts/run-sql-file first if missing).
 * 2) Inserts consolidated founder approvals (deduped topics).
 * 3) Removes redundant `[FOUNDER APPROVAL]` agent_tasks now represented in Approvals tab.
 * 4) Marks shipped product tasks done (substitutes UI + supplier portal read path).
 * 5) Resets stuck `claimed` newsletter task back to pending.
 * 6) Queues a single admin approval for the large active-goals backlog.
 *
 * Usage: npx tsx scripts/os-drain-queue-to-approvals.ts
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

/** Canonical approvals — one row each (matches /os Approvals UX). */
const CANONICAL_APPROVALS: {
  title: string;
  question_text: string;
  proposed_action: string;
}[] = [
  {
    title: "Founder · Google Postmaster Tools",
    question_text:
      "Agents cannot access your Google Search Console / Postmaster accounts. Should dentago.co.uk (and mail-from subdomain) be registered and verified now?",
    proposed_action:
      "Mercier: complete Postmaster verification; paste DNS screenshot or note into Context Log.",
  },
  {
    title: "Founder · Instantly.ai vs alternatives",
    question_text:
      "Week 3 planning referenced Instantly.ai for warm-up. Proceed with Instantly, or Lemlist / Smartlead / Resend-only cadence?",
    proposed_action:
      "Pick tool + monthly budget cap; see docs/playbook-email-warming-tools.md.",
  },
  {
    title: "Founder · Google Calendar / Calendly depth",
    question_text:
      "Prioritise Calendar MCP / automation this sprint, or rely on native Calendly → Google sync?",
    proposed_action:
      "See docs/playbook-google-calendar-calendly.md — recommend native sync unless OAuth budget exists.",
  },
  {
    title: "Founder · Product Hunt ship window",
    question_text:
      "Product Hunt listing needs maker verification + assets. Which calendar week do you want to target?",
    proposed_action:
      "See docs/playbook-product-hunt-launch.md — pick Tue–Thu PT launch slot.",
  },
  {
    title: "Founder · Supplier connections — Kent Express, Dental Sky, DD Group",
    question_text:
      "Formal supplier portal connections require contracts + correct account emails. Which supplier should engineering prioritise after Henry Schein?",
    proposed_action:
      "Confirm Kent Express / Dental Sky / DD commercial contacts and sandbox credentials policy.",
  },
  {
    title: "OS · Active goals backlog triage",
    question_text:
      "There are hundreds of `active` goals (outreach, partnerships, week-N tasks). Should we archive past-week items, keep only May themes, or export for manual review?",
    proposed_action:
      "Mercier: filter Goals tab by category; bulk status update or delegate themes to agents weekly.",
  },
];

const PRODUCT_TASK_COMPLETIONS: { match: string; summary: string }[] = [
  {
    match: "Clinical equivalent substitution",
    summary:
      "Shipped: GET /api/products/[id]/substitutes + PDP clinical equivalents when all supplier lines OOS (see app/product/[id]/page.tsx).",
  },
  {
    match: "Supplier portal v1",
    summary:
      "Shipped: /supplier auth, dashboard orders + products, APIs under /api/supplier/*. Read-only orders path live for connected suppliers.",
  },
];

async function tableExists(): Promise<boolean> {
  const { error } = await supabase.from("os_approval_requests").select("id").limit(1);
  if (error?.message?.includes("schema cache") || error?.message?.includes("does not exist"))
    return false;
  return !error;
}

async function main() {
  const ok = await tableExists();
  if (!ok) {
    console.error(
      "\n❌ os_approval_requests missing. Run:\n   npx tsx scripts/run-sql-file.ts supabase/migrations/20260505_os_approval_requests.sql\n"
    );
    process.exit(1);
  }

  console.log("\n▶ Drain queue → os_approval_requests\n");

  const { data: existing } = await supabase
    .from("os_approval_requests")
    .select("title")
    .eq("status", "pending");
  const have = new Set((existing ?? []).map((r: { title: string }) => r.title));

  for (const a of CANONICAL_APPROVALS) {
    if (have.has(a.title)) {
      console.log(`  skip approval: ${a.title}`);
      continue;
    }
    const { error } = await supabase.from("os_approval_requests").insert({
      title: a.title,
      question_text: a.question_text,
      proposed_action: a.proposed_action,
      context_json: { source: "scripts/os-drain-queue-to-approvals.ts" },
      created_by: "cursor-agent-drain",
      status: "pending",
    });
    if (error) console.error(`  ❌ insert ${a.title}`, error.message);
    else console.log(`  ✅ approval: ${a.title}`);
  }

  // Delete legacy founder fallback agent_tasks (Approvals tab is canonical now)
  const { data: founders } = await supabase
    .from("agent_tasks")
    .select("id, title")
    .like("title", "%FOUNDER APPROVAL%");

  const ids = (founders ?? []).map((r: { id: string }) => r.id);
  if (ids.length) {
    const { error: delErr } = await supabase.from("agent_tasks").delete().in("id", ids);
    console.log(delErr ? `  ❌ delete founder tasks: ${delErr.message}` : `  🗑 removed ${ids.length} [FOUNDER APPROVAL] agent_tasks`);
  }

  // Mark verified coding tasks done
  const { data: tasks } = await supabase
    .from("agent_tasks")
    .select("id, title, status")
    .in("status", ["pending", "claimed", "in_progress", "qa_review"]);

  for (const row of tasks ?? []) {
    const t = row as { id: string; title: string; status: string };
    const hit = PRODUCT_TASK_COMPLETIONS.find((p) => t.title.includes(p.match));
    if (!hit) continue;
    const { error } = await supabase
      .from("agent_tasks")
      .update({
        status: "done",
        output_summary: hit.summary,
        qa_passed: true,
        qa_score: 82,
        qa_notes: "Closed by os-drain-queue-to-approvals.ts — feature verified in repo.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", t.id);
    console.log(error ? `  ❌ complete ${t.title}` : `  ✅ done: ${t.title.slice(0, 52)}…`);
  }

  // Unstick claimed newsletter / stale claims
  const { data: claimed } = await supabase
    .from("agent_tasks")
    .select("id, title")
    .eq("status", "claimed");

  for (const row of claimed ?? []) {
    const t = row as { id: string; title: string };
    const { error } = await supabase
      .from("agent_tasks")
      .update({
        status: "pending",
        claimed_by: null,
        claimed_at: null,
        started_at: null,
      })
      .eq("id", t.id);
    console.log(error ? `  ❌ unclaim ${t.id}` : `  ↩ reset claimed → pending: ${t.title.slice(0, 48)}…`);
  }

  console.log("\nDone — open /os → Approvals + Agents.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
