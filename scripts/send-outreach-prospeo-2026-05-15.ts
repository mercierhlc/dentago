/**
 * Outreach — Prospeo exports 2026-05-15
 *
 * Template: "WhatsApp/200 clinics" — social proof + frictionless CTA
 *   Subject: [Practice] — free to use
 *
 * Sources:
 *   prospeo_person_export_20260515_192813_bff9c5.csv
 *   prospeo_person_export_20260515_192834_8bee5d.csv
 *   prospeo_person_export_20260515_192903_b7a43c.csv
 *   prospeo_person_export_20260515_192939_5a817a.csv
 *
 * Logic:
 *   Already in sent log  →  follow-up
 *   New lead             →  cold (new "200 clinics" template)
 *
 * Run: npx tsx scripts/send-outreach-prospeo-2026-05-15.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import Papa from "papaparse";

// ── env ──────────────────────────────────────────────────────────────────────
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

const resend   = new Resend(RESEND_API_KEY);
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const FROM        = "Mercier at Dentago <mercier@dentago.co.uk>";
const REPLY_TO    = "mercier@dentago.co.uk";
const CALENDLY    = "https://calendly.com/rnsv/dentago-introduction";
const WHATSAPP    = "+447466607116";
const BATCH_LABEL = "prospeo-2026-05-15";
const BATCH_NUM   = 13;
const TEMPLATE_ID = "200-clinics-v1";

const CSV_FILES = [
  "prospeo_person_export_20260515_192813_bff9c5.csv",
  "prospeo_person_export_20260515_192834_8bee5d.csv",
  "prospeo_person_export_20260515_192903_b7a43c.csv",
  "prospeo_person_export_20260515_192939_5a817a.csv",
].map(f => path.join(process.env.HOME!, "Downloads", f));

const SENT_LOG_PATH = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── CSV parser (handles embedded newlines in quoted fields) ──────────────────
function parseCSV(content: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(content.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });
  return (result.data ?? []) as Record<string, string>[];
}

// ── email copy ────────────────────────────────────────────────────────────────
function coldEmail(r: Record<string, string>): { subject: string; html: string; text: string } {
  const name     = (r["First name"] || r["first_name"] || "there").trim();
  const practice = (r["Company name"] || r["company_name"] || "").trim();
  const email    = (r["Email"] || r["email"] || "").toLowerCase();

  const subject = practice ? `${practice} — free to use` : `Dentago — free for practices`;

  const trackingPixel = `<img src="${SITE_URL}/api/track/open?e=${encodeURIComponent(email)}&b=${BATCH_NUM}&t=${TEMPLATE_ID}" width="1" height="1" style="display:none" />`;

  const html = `
<div style="font-family:sans-serif;max-width:560px;line-height:1.6;color:#111">
  <p>Hi ${name},</p>
  <p>Most dental practices are spending hours every week logging into 4–5 supplier sites, comparing prices manually, and placing separate orders with each one.</p>
  <p>Dentago fixes that. One place to search every supplier you already use, see prices side by side, and place one order. Takes 5 minutes to set up and it's completely free for practices. (We integrate your existing supplier accounts to get your actual negotiated prices.)</p>
  <p>If saving on supply costs and cutting down admin time sounds useful, why not join the 200+ dental clinics already using Dentago? (May as well join the party and save thousands annually on supplies.)</p>
  <p>Here's my WhatsApp — <strong>${WHATSAPP}</strong>. Happy to get you set up as soon as you drop me a message!</p>
  <p>No credit card required — we do <strong>not</strong> charge clinics. We take our fee from the suppliers we work with.</p>
  <p>Or book a quick call: <a href="${CALENDLY}">${CALENDLY}</a></p>
  <p>Mercier<br/>
  Founder @ Dentago<br/>
  <a href="${SITE_URL}">${SITE_URL}</a></p>
</div>
${trackingPixel}`;

  const text = `Hi ${name},

Most dental practices are spending hours every week logging into 4–5 supplier sites, comparing prices manually, and placing separate orders with each one.

Dentago fixes that. One place to search every supplier you already use, see prices side by side, and place one order. Takes 5 minutes to set up and it's completely free for practices. (We integrate your existing supplier accounts to get your actual negotiated prices.)

If saving on supply costs and cutting down admin time sounds useful, why not join the 200+ dental clinics already using Dentago? (May as well join the party and save thousands annually on supplies.)

Here's my WhatsApp — ${WHATSAPP}. Happy to get you set up as soon as you drop me a message!

No credit card required — we do NOT charge clinics. We take our fee from the suppliers we work with.

Or book a quick call: ${CALENDLY}

Mercier
Founder @ Dentago
${SITE_URL}`;

  return { subject, html, text };
}

function followUpEmail(r: Record<string, string>): { subject: string; html: string; text: string } {
  const name     = (r["First name"] || r["first_name"] || "there").trim();
  const practice = (r["Company name"] || r["company_name"] || "").trim();
  const email    = (r["Email"] || r["email"] || "").toLowerCase();

  const subject = practice ? `Re: ${practice} — following up` : `Following up from Dentago`;

  const trackingPixel = `<img src="${SITE_URL}/api/track/open?e=${encodeURIComponent(email)}&b=${BATCH_NUM}&t=followup-v1" width="1" height="1" style="display:none" />`;

  const html = `
<div style="font-family:sans-serif;max-width:560px;line-height:1.6;color:#111">
  <p>Hi ${name},</p>
  <p>Just following up on my earlier email in case it got buried.</p>
  <p>Still completely free for the practice — we help you search all your suppliers in one place and get your actual negotiated prices, not catalogue rates.</p>
  <p>Drop me a WhatsApp on <strong>${WHATSAPP}</strong> and I'll get you set up in 5 minutes.</p>
  <p>— Mercier<br/>
  Dentago — <a href="${SITE_URL}">${SITE_URL}</a></p>
</div>
${trackingPixel}`;

  const text = `Hi ${name},

Just following up on my earlier email in case it got buried.

Still completely free for the practice — we help you search all your suppliers in one place and get your actual negotiated prices, not catalogue rates.

Drop me a WhatsApp on ${WHATSAPP} and I'll get you set up in 5 minutes.

— Mercier
Dentago — ${SITE_URL}`;

  return { subject, html, text };
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
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
  const email    = (r["Email"] || r["email"] || "").toLowerCase();
  const practice = (r["Company name"] || r["company_name"] || null);
  const city     = (r["Person city"] || r["city"] || "").split(",")[0].trim() || null;
  const name     = [(r["First name"] || r["first_name"]), (r["Last name"] || r["last_name"])].filter(Boolean).join(" ") || null;
  const jobTitle = (r["Job title"] || r["job_title"] || null);

  const { data: contact } = await supabase
    .from("contacts")
    .upsert(
      {
        email,
        name,
        practice_name: practice,
        location: city,
        status: "cold",
        source: "prospeo",
        notes: jobTitle ? `Job title: ${jobTitle}` : undefined,
      },
      { onConflict: "email", ignoreDuplicates: false }
    )
    .select("id, total_messages_sent")
    .single();

  if (!contact) return;

  await supabase.from("messages").insert({
    contact_id: contact.id,
    channel: "email",
    direction: "outbound",
    subject,
    body,
    status: "sent",
    metadata: {
      resend_id: resendId,
      batch: BATCH_LABEL,
      template: type === "cold" ? TEMPLATE_ID : "followup-v1",
      batch_num: BATCH_NUM,
    },
    sent_at: new Date().toISOString(),
  });

  await supabase.from("contacts").update({
    total_messages_sent: (contact.total_messages_sent ?? 0) + 1,
    last_contacted_at: new Date().toISOString(),
  }).eq("id", contact.id);

  await logEvent({
    event_type: "outreach_sent",
    entity_type: "contact",
    entity_id: contact.id,
    payload: {
      email,
      practice,
      template: type === "cold" ? TEMPLATE_ID : "followup-v1",
      batch: BATCH_LABEL,
      resend_id: resendId,
      subject,
    },
    source: "outreach_script",
  });
}

async function logSessionToOS(cold: number, followups: number, failed: number, total: number) {
  const body = JSON.stringify({
    summary: `Outreach batch ${BATCH_LABEL}: ${cold + followups} emails sent (${cold} cold "200 clinics" template, ${followups} follow-up), ${failed} failed. Source: 4 Prospeo CSV exports (${total} leads).`,
    decisions_made: [
      {
        decision: "Used '200 clinics' social proof template",
        rationale: "New template emphasizing 200+ clinics, WhatsApp CTA, and supplier commission model to maximise reply rate",
      },
    ],
    work_completed: [
      {
        task: `Send Prospeo outreach batch ${BATCH_LABEL}`,
        result: `${cold + followups} emails via Resend (${cold} cold / ${followups} follow-up). Template: ${TEMPLATE_ID}. Contacts + messages upserted to Supabase.`,
      },
    ],
    open_loops: [],
    outreach_count: cold + followups,
  });

  await new Promise<void>((resolve) => {
    const req = https.request(
      `${SITE_URL}/api/os/log-context`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
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
  let sentData: { sent: { email: string; batch: number; sentAt: string }[] } = { sent: [] };
  if (fs.existsSync(SENT_LOG_PATH)) {
    sentData = JSON.parse(fs.readFileSync(SENT_LOG_PATH, "utf-8"));
  }
  const alreadySentEmails = new Set(sentData.sent.map(s => s.email.toLowerCase()));
  console.log(`  Already sent: ${alreadySentEmails.size} on record`);

  // Parse & dedupe all 4 CSVs
  const seenInBatch = new Set<string>();
  const rows: Record<string, string>[] = [];
  for (const csvPath of CSV_FILES) {
    const parsed = parseCSV(fs.readFileSync(csvPath, "utf-8"));
    for (const r of parsed) {
      const email = (r["Email"] || r["email"] || "").toLowerCase().trim();
      if (!email || !email.includes("@")) continue;
      if (seenInBatch.has(email)) continue;
      seenInBatch.add(email);
      rows.push(r);
    }
  }
  console.log(`  CSV leads (deduplicated, valid email): ${rows.length}\n`);

  // Log template once
  await logEvent({
    event_type: "outreach_template_logged",
    entity_type: "template",
    entity_id: TEMPLATE_ID,
    payload: {
      template_id: TEMPLATE_ID,
      batch: BATCH_LABEL,
      subject_pattern: "[Practice] — free to use",
      cta: "WhatsApp + Calendly",
      social_proof: "200+ clinics",
      key_message: "Free for practices, 5 min setup, negotiated prices, we charge suppliers",
      source_files: CSV_FILES.map(f => path.basename(f)),
    },
    source: "outreach_script",
  });

  let cold = 0, followups = 0, failed = 0;
  const newSentEntries: { email: string; batch: number; sentAt: string; name?: string; practice?: string; template?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const email    = (r["Email"] || r["email"] || "").toLowerCase();
    const name     = (r["First name"] || r["first_name"] || "there").trim();
    const practice = (r["Company name"] || r["company_name"] || "").trim();
    const isFollowUp = alreadySentEmails.has(email);

    const { subject, html, text } = isFollowUp ? followUpEmail(r) : coldEmail(r);

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
      const tag = isFollowUp ? "↩ follow-up" : "📧 cold     ";
      console.log(`✅ [${i + 1}/${rows.length}] ${tag} ${name} (${practice}) → ${email}`);

      await upsertContactAndLogMessage(r, isFollowUp ? "followup" : "cold", subject, text, resendId);

      newSentEntries.push({
        email,
        batch: BATCH_NUM,
        sentAt: new Date().toISOString(),
        name: [r["First name"] || r["first_name"], r["Last name"] || r["last_name"]].filter(Boolean).join(" ") || undefined,
        practice: practice || undefined,
        template: isFollowUp ? "followup-v1" : TEMPLATE_ID,
      });

      if (isFollowUp) followups++; else cold++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`❌ [${i + 1}/${rows.length}] ${email}: ${msg}`);
      failed++;
    }

    await delay(260); // ~3.8/sec — safe for Resend rate limits
  }

  // Update sent log
  sentData.sent.push(...newSentEntries);
  fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(sentData, null, 2));

  // Log session to OS
  await logSessionToOS(cold, followups, failed, rows.length);

  console.log(`\n${"═".repeat(55)}`);
  console.log(`  Batch:       ${BATCH_LABEL}`);
  console.log(`  Template:    ${TEMPLATE_ID}`);
  console.log(`  Cold:        ${cold}`);
  console.log(`  Follow-up:   ${followups}`);
  console.log(`  Failed:      ${failed}`);
  console.log(`  Total sent:  ${cold + followups}`);
  console.log(`  Log total:   ${sentData.sent.length} all-time`);
  console.log(`${"═".repeat(55)}\n`);
}

main().catch(console.error);
