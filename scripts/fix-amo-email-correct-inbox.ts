/**
 * Fix Amo CRM: Obsidian/batch data incorrectly used info@thesmileworks.com (Smile Works).
 * Correct contact: info@diamonddentalstaff.co.uk — Diamond Dental Staff.
 *
 * Migrates the wrong CRM row if present, then sends the re-engage to the correct inbox.
 *
 * Run:  npx tsx scripts/fix-amo-email-correct-inbox.ts
 * Dry:  npx tsx scripts/fix-amo-email-correct-inbox.ts --dry-run
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

const WRONG = "info@thesmileworks.com";
const RIGHT = "info@diamonddentalstaff.co.uk";
const PRACTICE = "Diamond Dental Staff";
const FROM = "Mercier <mercier@dentago.co.uk>";
const REPLY_TO = "mercier@dentago.co.uk";

const SUBJECT = `${PRACTICE} — Dentago follow-up (correct address)`;

const TEXT = `Hi Amo,

Quick correction on my side — my last Dentago follow-up went to the wrong inbox (an outdated address on file). Sending the same note here so it actually reaches you.

You'd replied positively when we first spoke about Dentago — I sent a link to book time and I know how fast inboxes move, so timing may simply not have lined up.

If multi-supplier ordering is still costing the team time each week:

• ~2 minutes, no signup — https://www.dentago.co.uk/watch
• Or reply with a time that suits you for a 10-minute call and I'll send a meet link.

If it's not a priority anymore, a one-line "not for us" is helpful too.

Mercier
Founder, Dentago
mercier@dentago.co.uk
https://dentago.co.uk
`;

const HTML = `<p>Hi Amo,</p>

<p><strong>Quick correction on my side</strong> — my last Dentago follow-up went to the wrong inbox (an outdated address on file). Sending the same note here so it actually reaches you.</p>

<p>You'd replied positively when we first spoke about <strong>Dentago</strong> — I sent a link to book time and I know how fast inboxes move, so timing may simply not have lined up.</p>

<p>If multi-supplier ordering is still costing the team time each week:</p>
<ul>
  <li>~2 minutes, no signup — <a href="https://www.dentago.co.uk/watch">dentago.co.uk/watch</a></li>
  <li>Or reply with a time that suits you for a <strong>10-minute</strong> call and I'll send a meet link.</li>
</ul>

<p>If it's not a priority anymore, a one-line &quot;not for us&quot; is helpful too.</p>

<p>Mercier<br>Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`;

async function logEventDb(
  supabase: typeof import("../lib/supabase").supabaseAdmin,
  payload: {
    event_type: string;
    entity_type?: string;
    entity_id?: string;
    payload?: Record<string, unknown>;
    source?: string;
  },
) {
  const { error } = await supabase.from("events").insert({
    event_type: payload.event_type,
    entity_type: payload.entity_type ?? null,
    entity_id: payload.entity_id ?? null,
    payload: payload.payload ?? {},
    source: payload.source ?? "script:fix-amo-email-correct-inbox",
  });
  if (error) throw new Error(`events: ${error.message}`);
}

async function main() {
  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing RESEND_API_KEY or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const { supabaseAdmin } = await import("../lib/supabase");

  const { data: okRow } = await supabaseAdmin
    .from("contacts")
    .select("id, total_messages_sent, notes")
    .eq("email", RIGHT)
    .maybeSingle();

  const { data: badRow } = await supabaseAdmin
    .from("contacts")
    .select("id, total_messages_sent, notes")
    .eq("email", WRONG)
    .maybeSingle();

  let contactId: string;
  let prevSent: number;

  if (okRow?.id && badRow?.id && okRow.id !== badRow.id) {
    console.log(`[crm] Merging duplicate: move messages ${badRow.id} → ${okRow.id}, drop wrong row`);
    if (!DRY) {
      const { error: mErr } = await supabaseAdmin
        .from("messages")
        .update({ contact_id: okRow.id })
        .eq("contact_id", badRow.id);
      if (mErr) throw mErr;
      const { error: dErr } = await supabaseAdmin.from("contacts").delete().eq("id", badRow.id);
      if (dErr) throw dErr;
    }
    contactId = okRow.id;
    prevSent = okRow.total_messages_sent ?? 0;
  } else if (okRow?.id) {
    contactId = okRow.id;
    prevSent = okRow.total_messages_sent ?? 0;
    await supabaseAdmin
      .from("contacts")
      .update({
        name: "Amo",
        practice_name: PRACTICE,
        notes: `${okRow.notes ?? ""}\n[crm fix] Canonical practice Diamond Dental Staff; inbox ${RIGHT}.`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactId);
  } else if (badRow?.id) {
    contactId = badRow.id;
    prevSent = badRow.total_messages_sent ?? 0;
    console.log(`[crm] Migrating contact email ${WRONG} → ${RIGHT}`);
    if (!DRY) {
      const { error } = await supabaseAdmin
        .from("contacts")
        .update({
          email: RIGHT,
          name: "Amo",
          practice_name: PRACTICE,
          notes: `${badRow.notes ?? ""}\n[crm fix Apr 2026] Wrong address was Smile Works/thesmileworks from vault error; corrected to Diamond Dental Staff.`.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", badRow.id);
      if (error) throw error;
    }
  } else {
    console.error("No contact rows for Smile Works or Diamond — create manually or run rekindle script.");
    process.exit(1);
  }

  const nowIso = new Date().toISOString();

  if (DRY) {
    console.log(`Would send to ${RIGHT}, contact ${contactId}`);
    console.log(TEXT);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const sent = await resend.emails.send({
    from: FROM,
    to: RIGHT,
    replyTo: REPLY_TO,
    subject: SUBJECT,
    text: TEXT,
    html: HTML,
  });
  const err = (sent as { error?: { message?: string } }).error;
  const data = (sent as { data?: { id?: string } }).data;
  if (err) throw new Error(err.message ?? "resend failed");
  const resendId = data?.id ?? null;
  console.log(`[resend] ${RIGHT} → ${resendId}`);

  await supabaseAdmin.from("messages").insert({
    contact_id: contactId,
    channel: "email",
    direction: "outbound",
    subject: SUBJECT,
    body: TEXT,
    body_html: HTML,
    status: "sent",
    metadata: {
      resend_id: resendId,
      template: "amo_rekindle_correct_inbox_corrective",
      supersedes_wrong_send_to: WRONG,
    },
    sent_at: nowIso,
  });

  await supabaseAdmin
    .from("contacts")
    .update({
      last_contacted_at: nowIso,
      last_message_preview: SUBJECT.slice(0, 140),
      total_messages_sent: prevSent + 1,
      updated_at: nowIso,
    })
    .eq("id", contactId);

  await logEventDb(supabaseAdmin, {
    event_type: "outreach_sent",
    entity_type: "contact",
    entity_id: contactId,
    payload: {
      email: RIGHT,
      practice: PRACTICE,
      name: "Amo",
      subject: SUBJECT,
      resend_id: resendId,
      corrective: true,
      wrong_record_had_email: WRONG,
    },
  });

  console.log("[events] Logged corrective outreach_sent");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
