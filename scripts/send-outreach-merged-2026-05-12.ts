/**
 * Batch outreach — dentago-merged-leads-2026-05-12.csv
 *
 * Logic:
 *   - Already in dentago-sent-all.json  →  follow-up email
 *   - Not yet sent                      →  cold email (improved Joanne template)
 *
 * Logs:
 *   - Every send → Supabase contacts + messages tables + events
 *   - Template   → OS event on first run
 *   - Session    → POST /api/os/log-context at end
 *
 * Run: npx tsx scripts/send-outreach-merged-2026-05-12.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// ── env ─────────────────────────────────────────────────────────────────────
function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.join(process.env.HOME!, "dentago", ".env"));
loadEnv(path.join(process.env.HOME!, "dentago", ".env.local"));

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SITE_URL       = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dentago.co.uk";

const resend    = new Resend(RESEND_API_KEY);
const supabase  = createClient(SUPABASE_URL, SERVICE_KEY);

const FROM          = "Mercier at Dentago <mercier@dentago.co.uk>";
const REPLY_TO      = "mercier@dentago.co.uk";
const CALENDLY      = "https://calendly.com/rnsv/dentago-introduction";
const BATCH_LABEL   = "merged-2026-05-12";
const CSV_PATH      = path.join(process.env.HOME!, "Downloads", "dentago-merged-leads-2026-05-12.csv");
const SENT_LOG_PATH = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── CSV parser ───────────────────────────────────────────────────────────────
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter(l => l.trim());
  const hdr = lines[0].replace(/^\uFEFF/, "").split(",").map(h => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { vals.push(cur); cur = ""; }
      else cur += ch;
    }
    vals.push(cur);
    const row: Record<string, string> = {};
    hdr.forEach((h, i) => { row[h] = (vals[i] ?? "").replace(/^"|"$/g, "").trim(); });
    return row;
  });
}

// ── email copy ────────────────────────────────────────────────────────────────
function coldEmail(r: Record<string, string>, batchNum: number): { subject: string; html: string; text: string } {
  const name     = r.first_name || "there";
  const practice = r.company_name || "";
  const city     = (r.city || "").split(",")[0].trim();
  const email    = r.email.toLowerCase();

  const spotLine = practice && city
    ? `I spotted ${practice} in ${city} while mapping UK dental practices.`
    : practice
      ? `I came across ${practice} while mapping UK dental practices.`
      : `I came across your practice while mapping UK dental clinics.`;

  const subject = practice
    ? `${practice} — quick question`
    : `Quick question about your practice`;

  const trackingPixel = `<img src="${SITE_URL}/api/track/open?e=${encodeURIComponent(email)}&b=${batchNum}" width="1" height="1" style="display:none" />`;

  const html = `
<div style="font-family:sans-serif;max-width:560px;line-height:1.6;color:#111">
  <p>Hi ${name},</p>
  <p>Cold vendor emails usually mean a new invoice — so upfront: <strong>Dentago is completely free for the practice.</strong></p>
  <p>${spotLine} What we hear from reception teams: ordering week still means four or five supplier logins, a WhatsApp thread to chase stock, and nobody quite sure who placed the last order.</p>
  <p>Dentago connects your existing supplier accounts (Henry Schein, Kent Express, Dental Sky and others) into one search and checkout — live prices from your actual accounts, not catalogue rates. We're not replacing your supplier relationships, we're making them visible in one place.</p>
  <p>Worth 15 minutes? Book whenever suits:<br/>
  <a href="${CALENDLY}">${CALENDLY}</a></p>
  <p>Many thanks,<br/>
  <strong>Mercier</strong><br/>
  Founder, Dentago<br/>
  <a href="${SITE_URL}">${SITE_URL}</a></p>
</div>
${trackingPixel}`;

  const text = `Hi ${name},

Cold vendor emails usually mean a new invoice — so upfront: Dentago is completely free for the practice.

${spotLine} What we hear from reception teams: ordering week still means four or five supplier logins, a WhatsApp thread to chase stock, and nobody quite sure who placed the last order.

Dentago connects your existing supplier accounts (Henry Schein, Kent Express, Dental Sky and others) into one search and checkout — live prices from your actual accounts, not catalogue rates. We're not replacing your supplier relationships, we're making them visible in one place.

Worth 15 minutes? Book whenever suits:
${CALENDLY}

Many thanks,
Mercier
Founder, Dentago
${SITE_URL}`;

  return { subject, html, text };
}

function followUpEmail(r: Record<string, string>, batchNum: number): { subject: string; html: string; text: string } {
  const name     = r.first_name || "there";
  const practice = r.company_name || "";
  const email    = r.email.toLowerCase();

  const subject = practice
    ? `Re: ${practice} — quick question`
    : `Following up from Dentago`;

  const trackingPixel = `<img src="${SITE_URL}/api/track/open?e=${encodeURIComponent(email)}&b=${batchNum}" width="1" height="1" style="display:none" />`;

  const html = `
<div style="font-family:sans-serif;max-width:560px;line-height:1.6;color:#111">
  <p>Hi ${name},</p>
  <p>Just following up on my email from a few days ago in case it got buried.</p>
  <p><strong>Still zero cost to the practice.</strong> The problem we're solving: heavy weekly admin across supplier portals — four or five logins, fragmented carts, no single view of what you're spending.</p>
  <p>Worth a quick look? Happy to walk you through it on a short call:<br/>
  <a href="${CALENDLY}">${CALENDLY}</a></p>
  <p>— Mercier<br/>
  Dentago — <a href="${SITE_URL}">${SITE_URL}</a></p>
</div>
${trackingPixel}`;

  const text = `Hi ${name},

Just following up on my email from a few days ago in case it got buried.

Still zero cost to the practice. The problem we're solving: heavy weekly admin across supplier portals — four or five logins, fragmented carts, no single view of what you're spending.

Worth a quick look? Happy to walk you through it on a short call:
${CALENDLY}

— Mercier
Dentago — ${SITE_URL}`;

  return { subject, html, text };
}

// ── OS helpers ────────────────────────────────────────────────────────────────
async function logEvent(payload: {
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  payload?: Record<string, unknown>;
  source?: string;
}) {
  try {
    await supabase.from("events").insert({
      event_type: payload.event_type,
      entity_type: payload.entity_type ?? null,
      entity_id: payload.entity_id ?? null,
      payload: payload.payload ?? {},
      metrics: {},
      kpi_impact: {},
      source: payload.source ?? "outreach_script",
    });
  } catch (err) {
    console.warn("[logEvent] failed:", err);
  }
}

async function upsertContactAndLogMessage(
  r: Record<string, string>,
  type: "cold" | "followup",
  subject: string,
  body: string,
  resendId: string | null
) {
  const email = r.email.toLowerCase();
  const practice = r.company_name || null;
  const city = (r.city || "").split(",")[0].trim() || null;
  const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || null;

  // Upsert contact
  const { data: contact } = await supabase
    .from("contacts")
    .upsert({
      email,
      name,
      practice_name: practice,
      phone: r.phone || null,
      linkedin_url: r.linkedin_url || null,
      location: city,
      type: "lead",
      status: "cold",
      source: `outreach_script_${BATCH_LABEL}`,
      tags: ["cold_outreach", BATCH_LABEL],
      last_contacted_at: new Date().toISOString(),
      last_message_preview: subject.slice(0, 100),
      updated_at: new Date().toISOString(),
    }, { onConflict: "email", ignoreDuplicates: false })
    .select("id, total_messages_sent")
    .single();

  if (!contact) return;

  // Insert message record
  await supabase.from("messages").insert({
    contact_id: contact.id,
    channel: "email",
    direction: "outbound",
    subject,
    body,
    status: "sent",
    metadata: { resend_id: resendId, batch: BATCH_LABEL, template: type },
    sent_at: new Date().toISOString(),
  });

  // Update message count
  await supabase.from("contacts").update({
    total_messages_sent: (contact.total_messages_sent ?? 0) + 1,
  }).eq("id", contact.id);

  // Log OS event
  await logEvent({
    event_type: "outreach_sent",
    entity_type: "contact",
    entity_id: contact.id,
    payload: {
      email,
      practice,
      template: type,
      batch: BATCH_LABEL,
      resend_id: resendId,
      subject,
    },
    source: "outreach_script",
  });
}

// ── OS session log ─────────────────────────────────────────────────────────────
async function logSessionToOS(sent: number, followups: number, failed: number, total: number) {
  const body = JSON.stringify({
    summary: `Outreach batch ${BATCH_LABEL}: ${sent} emails sent (${sent - followups} cold, ${followups} follow-up), ${failed} failed. Source: dentago-merged-leads-2026-05-12.csv (${total} leads).`,
    decisions_made: [],
    work_completed: [
      {
        task: `Send outreach batch ${BATCH_LABEL}`,
        result: `${sent} emails sent via Resend (${sent - followups} cold / ${followups} follow-up). Contacts + messages upserted to Supabase. Events logged.`,
      },
    ],
    open_loops: [],
    outreach_count: sent,
  });

  await new Promise<void>((resolve) => {
    const req = https.request(
      `${SITE_URL}/api/os/log-context`,
      { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (res) => { res.resume(); res.on("end", resolve); }
    );
    req.on("error", (e) => { console.warn("[OS log-context] failed:", e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📬 Dentago outreach — ${BATCH_LABEL}\n`);

  // Load sent log
  const sentData = JSON.parse(fs.readFileSync(SENT_LOG_PATH, "utf-8")) as {
    sent: { email: string; batch: number; sentAt: string }[];
  };
  const alreadySentEmails = new Set(sentData.sent.map(s => s.email.toLowerCase()));
  console.log(`  Already sent: ${alreadySentEmails.size} emails on record`);

  // Parse CSV
  const rows = parseCSV(fs.readFileSync(CSV_PATH, "utf-8")).filter(
    r => r.email && r.email.includes("@")
  );
  console.log(`  CSV leads (valid email): ${rows.length}`);

  // Log the template to OS (once, at the start of the run)
  await logEvent({
    event_type: "outreach_sent",
    entity_type: "template",
    entity_id: BATCH_LABEL,
    payload: {
      action: "template_logged",
      batch: BATCH_LABEL,
      cold_subject_pattern: "[Practice] — quick question",
      followup_subject_pattern: "Re: [Practice] — quick question",
      cold_template: "improved-joanne-v1",
      followup_template: "follow-batch-v1",
      note: "Personalized: first_name, practice, city. One CTA: Calendly. Free-for-practice upfront.",
    },
    source: "outreach_script",
  });

  const batchNum = 12; // Next batch after 11
  let sent = 0, followups = 0, failed = 0;
  const newSentEntries: typeof sentData.sent = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email = r.email.toLowerCase();
    const name = r.first_name || "there";
    const practice = r.company_name || "";
    const isFollowUp = alreadySentEmails.has(email);

    const { subject, html, text } = isFollowUp
      ? followUpEmail(r, batchNum)
      : coldEmail(r, batchNum);

    try {
      const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject,
        html,
        text,
        replyTo: REPLY_TO,
      });

      const resendId = result.data?.id ?? null;
      console.log(`✅ [${i + 1}/${rows.length}] ${isFollowUp ? "↩ follow-up" : "📧 cold    "} ${name} (${practice}) → ${email}`);

      await upsertContactAndLogMessage(r, isFollowUp ? "followup" : "cold", subject, text, resendId);

      newSentEntries.push({
        email,
        batch: batchNum,
        sentAt: new Date().toISOString(),
        ...(r.first_name ? { name: [r.first_name, r.last_name].filter(Boolean).join(" ") } : {}),
        ...(practice ? { practice } : {}),
        template: isFollowUp ? "FollowUp-Merged" : "Cold-ImprovedJoanne",
      } as typeof sentData.sent[0]);

      sent++;
      if (isFollowUp) followups++;
    } catch (e: any) {
      console.error(`❌ [${i + 1}/${rows.length}] ${email}: ${e?.message}`);
      failed++;
    }

    // Rate limit: ~4/sec (250ms gap)
    await delay(250);
  }

  // Update sent log
  sentData.sent.push(...newSentEntries);
  fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(sentData, null, 2));

  // Log session to OS
  await logSessionToOS(sent, followups, failed, rows.length);

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Batch:      ${BATCH_LABEL}`);
  console.log(`  Cold:       ${sent - followups}`);
  console.log(`  Follow-up:  ${followups}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Total sent: ${sent}`);
  console.log(`  Sent log:   ${sentData.sent.length} total on record`);
  console.log(`${"═".repeat(50)}\n`);
}

main().catch(console.error);
