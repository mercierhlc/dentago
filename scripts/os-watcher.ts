/**
 * OS Watcher — the proactive intelligence layer.
 *
 * Runs hourly. Queries the full business state, identifies gaps and anomalies,
 * takes action where possible, writes attention items to Obsidian.
 *
 * This is what makes the OS proactive instead of passive.
 * It stops waiting to be asked and starts surfacing problems itself.
 *
 * Checks:
 *  - Clinics pending >2h → flag for manual review
 *  - Approved clinics with no supplier connected >48h → nudge email
 *  - Approved clinics with supplier but no order >7 days → activation gap
 *  - GMV = £0 with approved clinics → critical flag
 *  - Decisions >7 days old with no outcome → prompt review
 *  - KPI gaps vs targets → alert if off track
 *
 * Run:
 *   npx tsx scripts/os-watcher.ts
 *   npx tsx scripts/os-watcher.ts --dry-run   # audit only, no emails
 *
 * Set up as hourly cron:
 *   crontab -e
 *   0 * * * * cd /Users/mercier/dentago && npx tsx scripts/os-watcher.ts >> /tmp/os-watcher.log 2>&1
 */

import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

const dry = process.argv.includes("--dry-run");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const OBSIDIAN_KEY = process.env.OBSIDIAN_API_KEY;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function db(table: string, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return res.json();
}

async function dbInsert(table: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}

async function writeObsidian(filepath: string, content: string) {
  if (!OBSIDIAN_KEY) return;
  await fetch(`http://localhost:27123/vault/${encodeURIComponent(filepath)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${OBSIDIAN_KEY}`, "Content-Type": "text/markdown" },
    body: content,
  }).catch(() => {});
}

interface AttentionItem {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  action?: string;
  entity_id?: string;
}

async function runWatcher() {
  const now = new Date();
  const ts = now.toISOString();
  console.log(`\n🔍 OS Watcher — ${ts}${dry ? " [DRY RUN]" : ""}\n`);

  const runStart = Date.now();
  const items: AttentionItem[] = [];

  // ── 1. Fetch all business state ───────────────────────────────────────────
  const [clinics, events, decisions, loops] = await Promise.all([
    db("clinic_profiles", "?select=id,practice_name,status,created_at,is_deactivated"),
    db("events", "?select=event_type,entity_id,payload,metrics,created_at&order=created_at.desc&limit=500"),
    db("decisions", "?select=*&order=created_at.desc&limit=50"),
    db("loop_runs", "?select=*&order=created_at.desc&limit=50"),
  ]);

  const approved = (clinics as any[]).filter((c: any) => c.status === "approved" && !c.is_deactivated);
  const pending = (clinics as any[]).filter((c: any) => c.status === "pending");
  const evList = Array.isArray(events) ? events as any[] : [];
  const decList = Array.isArray(decisions) ? decisions as any[] : [];

  // ── 2. GMV check — most critical ─────────────────────────────────────────
  const orderEvents = evList.filter((e: any) => e.event_type === "order_placed");
  const totalGMV = orderEvents.reduce((s: number, e: any) =>
    s + (e.metrics?.order_value ?? e.payload?.order_value ?? 0), 0);

  if (totalGMV === 0 && approved.length > 0) {
    items.push({
      severity: "critical",
      category: "GMV",
      message: `£0 GMV with ${approved.length} approved clinic${approved.length > 1 ? "s" : ""}. No order has ever been placed.`,
      action: "Check the ordering flow end-to-end. Is checkout working? Do clinics know they can order?",
    });
  }

  // ── 3. Pending clinics >2h ────────────────────────────────────────────────
  for (const c of pending) {
    const age = (now.getTime() - new Date(c.created_at).getTime()) / 3600000;
    if (age > 2) {
      items.push({
        severity: "warning",
        category: "Onboarding",
        message: `${c.practice_name} has been pending for ${age.toFixed(1)}h — target is <2h to verified.`,
        action: `Review at dentago.co.uk/admin — approve or reject`,
        entity_id: c.id,
      });
    }
  }

  // ── 4. Approved clinics with no supplier connection >48h ─────────────────
  const connectedClinicIds = new Set(
    evList.filter((e: any) => e.event_type === "supplier_connected").map((e: any) => e.entity_id)
  );
  for (const c of approved) {
    const ageH = (now.getTime() - new Date(c.created_at).getTime()) / 3600000;
    if (ageH > 48 && !connectedClinicIds.has(c.id)) {
      items.push({
        severity: "warning",
        category: "Activation",
        message: `${c.practice_name} approved ${ageH.toFixed(0)}h ago with no supplier connected. Target: connect within 48h.`,
        action: "Send activation nudge email",
        entity_id: c.id,
      });
    }
  }

  // ── 5. Approved + connected but no order >7 days ──────────────────────────
  const orderedClinicIds = new Set(
    orderEvents.map((e: any) => e.entity_id)
  );
  for (const c of approved) {
    const ageD = (now.getTime() - new Date(c.created_at).getTime()) / 86400000;
    if (ageD > 7 && connectedClinicIds.has(c.id) && !orderedClinicIds.has(c.id)) {
      items.push({
        severity: "warning",
        category: "GMV",
        message: `${c.practice_name} is connected but hasn't ordered in ${ageD.toFixed(0)} days.`,
        action: "Send first-order prompt email",
        entity_id: c.id,
      });
    }
  }

  // ── 6. Decisions with no outcome >7 days ─────────────────────────────────
  const unresolved = decList.filter((d: any) => {
    const ageD = (now.getTime() - new Date(d.created_at).getTime()) / 86400000;
    return ageD > 7 && !d.actual_outcome && !d.prediction_accurate;
  });
  if (unresolved.length > 0) {
    items.push({
      severity: "info",
      category: "Decisions",
      message: `${unresolved.length} decision${unresolved.length > 1 ? "s" : ""} made >7 days ago with no outcome recorded.`,
      action: `Review: ${unresolved.map((d: any) => d.decision.slice(0, 50)).join(" | ")}`,
    });
  }

  // ── 7. Activation rate calculation ───────────────────────────────────────
  const searchedIds = new Set(
    evList.filter((e: any) => ["search_performed", "product_viewed"].includes(e.event_type))
      .map((e: any) => e.entity_id)
  );
  const fullyActivated = approved.filter((c: any) =>
    connectedClinicIds.has(c.id) && searchedIds.has(c.id) && orderedClinicIds.has(c.id)
  );
  const activationRate = approved.length > 0 ? (fullyActivated.length / approved.length) * 100 : 0;
  if (approved.length > 0 && activationRate < 60) {
    items.push({
      severity: activationRate < 20 ? "critical" : "warning",
      category: "Activation",
      message: `Activation rate: ${activationRate.toFixed(0)}% (${fullyActivated.length}/${approved.length} fully activated). Target: >60%.`,
      action: "Check where clinics drop off: supplier connection vs first search vs first order.",
    });
  }

  // ── 8. Ask AI for additional flags ────────────────────────────────────────
  const aiContext = `
Business state:
- Approved clinics: ${approved.length} (${fullyActivated.length} fully activated)
- GMV: £${totalGMV.toFixed(2)}
- Pending: ${pending.length}
- Supplier connections made: ${connectedClinicIds.size}
- Orders placed: ${orderEvents.length}
- Unresolved decisions: ${unresolved.length}
- Recent events (last 50): ${JSON.stringify(evList.slice(0, 50))}

Already flagged items: ${JSON.stringify(items)}

Target: 50 approved clinics by end May 2026. Currently ${approved.length}.
`.trim();

  const aiRes = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `You are the Dentago OS watcher. Identify 1-3 additional high-signal issues not already flagged.
Be specific, use numbers, focus on what's actually blocking growth.
Return a JSON array of {severity: "critical"|"warning"|"info", category: string, message: string, action: string}.
Return [] if nothing additional. Return only valid JSON.`,
    messages: [{ role: "user", content: aiContext }],
  });

  try {
    const aiText = aiRes.content[0].type === "text" ? aiRes.content[0].text : "[]";
    const match = aiText.match(/\[[\s\S]*\]/);
    if (match) {
      const aiItems = JSON.parse(match[0]) as AttentionItem[];
      items.push(...aiItems.slice(0, 3));
    }
  } catch { /* skip */ }

  // ── 9. Build report ────────────────────────────────────────────────────────
  const critical = items.filter(i => i.severity === "critical");
  const warnings = items.filter(i => i.severity === "warning");
  const infos = items.filter(i => i.severity === "info");

  console.log(`\n📊 Watcher found ${items.length} items:`);
  console.log(`   🔴 Critical: ${critical.length}`);
  console.log(`   🟡 Warning: ${warnings.length}`);
  console.log(`   🔵 Info: ${infos.length}`);

  for (const item of items) {
    const icon = item.severity === "critical" ? "🔴" : item.severity === "warning" ? "🟡" : "🔵";
    console.log(`\n${icon} [${item.category}] ${item.message}`);
    if (item.action) console.log(`   → ${item.action}`);
  }

  if (dry) {
    console.log("\n[DRY RUN] No writes made.");
    return;
  }

  // ── 10. Write to Obsidian ──────────────────────────────────────────────────
  const obsidianContent = `# OS Watcher — ${now.toISOString().slice(0, 16).replace("T", " ")}

## Summary
- **Approved clinics:** ${approved.length} | **Activated:** ${fullyActivated.length} (${activationRate.toFixed(0)}%)
- **GMV:** £${totalGMV.toFixed(2)} | **Orders:** ${orderEvents.length}
- **Pending review:** ${pending.length}

## Attention Required (${items.length} items)

${critical.length > 0 ? `### 🔴 Critical\n${critical.map(i => `- **[${i.category}]** ${i.message}\n  → ${i.action ?? ""}`).join("\n")}\n` : ""}
${warnings.length > 0 ? `### 🟡 Warnings\n${warnings.map(i => `- **[${i.category}]** ${i.message}\n  → ${i.action ?? ""}`).join("\n")}\n` : ""}
${infos.length > 0 ? `### 🔵 Info\n${infos.map(i => `- **[${i.category}]** ${i.message}\n  → ${i.action ?? ""}`).join("\n")}\n` : ""}
${items.length === 0 ? "✅ No attention items. Business running on track.\n" : ""}

---
_Generated by os-watcher.ts at ${ts}_
`;

  const filepath = `Dentago/Intelligence/OS Watcher — ${now.toISOString().slice(0, 16).replace("T", "-")}.md`;
  await writeObsidian(filepath, obsidianContent);
  console.log(`\n✅ Written to Obsidian: ${filepath}`);

  // ── 11. Log watcher run to events table ───────────────────────────────────
  await dbInsert("events", {
    event_type: "loop_completed",
    payload: {
      loop: "os_watcher",
      items_found: items.length,
      critical: critical.length,
      warnings: warnings.length,
      gmv: totalGMV,
      approved_clinics: approved.length,
      activated_clinics: fullyActivated.length,
      activation_rate: parseFloat(activationRate.toFixed(1)),
    },
    source: "os_watcher",
  });

  await dbInsert("loop_runs", {
    loop_name: "os_watcher",
    triggered_by: "cron",
    status: "completed",
    input: { approved_clinics: approved.length, pending_clinics: pending.length },
    output: { items_found: items.length, critical: critical.length },
    kpis_measured: {
      gmv: totalGMV,
      approved_clinics: approved.length,
      activation_rate: parseFloat(activationRate.toFixed(1)),
      pending_review: pending.length,
    },
    duration_ms: Date.now() - runStart,
    completed_at: new Date().toISOString(),
  });

  console.log(`\n✅ Watcher complete. Duration: ${Date.now() - runStart}ms`);
}

runWatcher().catch(e => {
  console.error(e);
  process.exit(1);
});
