/**
 * 1) Log Accrington Surgical EDI follow-up (already sent via Resend) → events + optional CRM note.
 * 2) Re-engage Amo (Diamond Dental Staff, info@diamonddentalstaff.co.uk) → Resend + messages + events.
 *
 * Run:  npx tsx scripts/log-accrington-send-and-amo-rekindle.ts
 * Dry:  npx tsx scripts/log-accrington-send-and-amo-rekindle.ts --dry-run
 */
import * as fs from "fs";
import * as path from "path";
import { Resend } from "resend";

const ROOT = path.resolve(__dirname, "..");

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.join(ROOT, ".env.local"));
loadEnv(path.join(ROOT, ".env"));

const DRY = process.argv.includes("--dry-run");

const FROM = "Mercier <mercier@dentago.co.uk>";
const REPLY_TO = "mercier@dentago.co.uk";

const ACCRINGTON = {
  email: "info@accringtonsurgical.co.uk",
  resendId: "37fe12e7-dd2e-46a8-8acb-b1bf9d07918b",
  subject: "Re: Incremental practice orders — Dentago (catalogue connection)",
};

const AMO_EMAIL = "info@diamonddentalstaff.co.uk";
const AMO_PRACTICE = "Diamond Dental Staff";

const AMO_SUBJECT = `${AMO_PRACTICE} — still worth a quick look at Dentago?`;

const AMO_TEXT = `Hi Amo,

You'd replied positively when we first spoke about Dentago — I sent a link to book time and I know how fast clinic inboxes move, so this may simply have dropped.

If multi-supplier ordering is still costing the team time each week, two easy options:

• ~2 minutes, no signup — https://www.dentago.co.uk/watch
• Or reply with a time that suits you for a 10-minute call and I'll send a meet link.

If it's not a priority anymore, a one-line "not for us" is helpful too — no hard feelings.

Mercier
Founder, Dentago
mercier@dentago.co.uk
https://dentago.co.uk
`;

const AMO_HTML = `<p>Hi Amo,</p>

<p>You'd replied positively when we first spoke about <strong>Dentago</strong> — I sent a link to book time and I know how fast clinic inboxes move, so this may simply have dropped.</p>

<p>If multi-supplier ordering is still costing the team time each week, two easy options:</p>

<ul>
  <li>~2 minutes, no signup — <a href="https://www.dentago.co.uk/watch">dentago.co.uk/watch</a></li>
  <li>Or reply with a time that suits you for a <strong>10-minute</strong> call and I'll send a meet link.</li>
</ul>

<p>If it's not a priority anymore, a one-line "not for us" is helpful too — no hard feelings.</p>

<p>Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a><br>
<a href="https://dentago.co.uk">dentago.co.uk</a></p>`;

async function logEventDb(payload: {
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  payload?: Record<string, unknown>;
  source?: string;
}) {
  const { supabaseAdmin } = await import("../lib/supabase");
  const { error } = await supabaseAdmin.from("events").insert({
    event_type: payload.event_type,
    entity_type: payload.entity_type ?? null,
    entity_id: payload.entity_id ?? null,
    payload: payload.payload ?? {},
    source: payload.source ?? "script:log-accrington-send-and-amo-rekindle",
  });
  if (error) throw new Error(`events insert: ${error.message}`);
}

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing");
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("Supabase env missing");
    process.exit(1);
  }

  const { supabaseAdmin } = await import("../lib/supabase");

  // ── 1) Accrington (retrospective log — email already sent) ─────────────
  if (!DRY) {
    await logEventDb({
      event_type: "outreach_sent",
      entity_type: "supplier",
      entity_id: ACCRINGTON.email,
      payload: {
        thread: "nhs_framework_edi_followup",
        subject: ACCRINGTON.subject,
        resend_id: ACCRINGTON.resendId,
        template: "supplier_c_accrington_edi_friday_slot",
        notes: "EDI-first follow-up after send details; proposed Friday 3pm UK, no Calendly.",
      },
    });
    console.log("[events] Logged outreach_sent → Accrington Surgical");
  } else {
    console.log("[dry-run] Would log outreach_sent → Accrington");
  }

  // ── 2) Amo — CRM row + send + message + event ───────────────────────────
  let contactId: string;

  const { data: existing } = await supabaseAdmin
    .from("contacts")
    .select("id, total_messages_sent")
    .eq("email", AMO_EMAIL)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (existing?.id) {
    contactId = existing.id;
    await supabaseAdmin
      .from("contacts")
      .update({
        name: "Amo",
        practice_name: AMO_PRACTICE,
        status: "warm",
        updated_at: nowIso,
        notes:
          "Amo — Diamond Dental Staff. Warm lead; Calendly sent earlier, never booked. Inbox: info@diamonddentalstaff.co.uk (not Smile Works / thesmileworks.com).",
      })
      .eq("id", contactId);
  } else {
    const { data: ins, error: insErr } = await supabaseAdmin
      .from("contacts")
      .insert({
        email: AMO_EMAIL,
        name: "Amo",
        practice_name: AMO_PRACTICE,
        type: "lead",
        status: "warm",
        source: "batch_followup_manual_amo_rekindle",
        notes:
          "Amo — Diamond Dental Staff. Re-engage; Calendly never booked.",
      })
      .select("id")
      .single();
    if (insErr || !ins) throw new Error(insErr?.message ?? "contact insert failed");
    contactId = ins.id;
  }

  console.log(`[crm] Contact id: ${contactId}`);

  let resendId: string | null = null;

  if (DRY) {
    console.log("[dry-run] Would send Amo email:");
    console.log(AMO_TEXT);
  } else {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const sent = await resend.emails.send({
      from: FROM,
      to: AMO_EMAIL,
      replyTo: REPLY_TO,
      subject: AMO_SUBJECT,
      text: AMO_TEXT,
      html: AMO_HTML,
    });
    const err = (sent as { error?: { message?: string } }).error;
    const data = (sent as { data?: { id?: string } }).data;
    if (err) throw new Error(err.message ?? "Resend failed");
    resendId = data?.id ?? null;
    console.log(`[resend] Amo → ${resendId}`);

    const prevCount = existing?.total_messages_sent ?? 0;
    await supabaseAdmin.from("messages").insert({
      contact_id: contactId,
      channel: "email",
      direction: "outbound",
      subject: AMO_SUBJECT,
      body: AMO_TEXT,
      body_html: AMO_HTML,
      status: "sent",
      metadata: { resend_id: resendId, template: "amo_practice_rekindle_watch_or_call" },
      sent_at: nowIso,
    });

    await supabaseAdmin
      .from("contacts")
      .update({
        last_contacted_at: nowIso,
        last_message_preview: AMO_SUBJECT.slice(0, 140),
        total_messages_sent: prevCount + 1,
        updated_at: nowIso,
      })
      .eq("id", contactId);

    await logEventDb({
      event_type: "outreach_sent",
      entity_type: "contact",
      entity_id: contactId,
      payload: {
        email: AMO_EMAIL,
        practice: AMO_PRACTICE,
        name: "Amo",
        subject: AMO_SUBJECT,
        resend_id: resendId,
        template: "amo_practice_rekindle_watch_or_call",
        channel: "email",
      },
    });
    console.log("[events] Logged outreach_sent → Amo / Diamond Dental Staff");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
