/**
 * Follow-up blast — all 8,957 previously emailed contacts who haven't signed up
 * Run: npx tsx scripts/send-followup-all-2026-05-15.ts
 *
 * Skips:
 *   - unsubscribes / marketing_opt_out (fetched from Supabase)
 *   - contacts already in this follow-up batch (tracks in sent log)
 *   - replied contacts (Gary, Nigel, Sher — handle manually)
 */

import Papa from "papaparse";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.join(process.env.HOME!, "dentago", ".env"));
loadEnv(path.join(process.env.HOME!, "dentago", ".env.local"));

const resend   = new Resend(process.env.RESEND_API_KEY!);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dentago.co.uk";
const FROM        = "Mercier at Dentago <mercier@dentago.co.uk>";
const REPLY_TO    = "mercier@dentago.co.uk";
const CALENDLY    = "https://calendly.com/rnsv/dentago-introduction";
const WHATSAPP    = "+447466607116";
const BATCH_LABEL = "followup-all-2026-05-15";
const BATCH_NUM   = 15;
const TEMPLATE_ID = "followup-v2";
const SENT_LOG    = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getOptOutList(): Promise<Set<string>> {
  const optOut = new Set<string>();
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from("contacts")
      .select("email")
      .or("status.eq.unsubscribed,marketing_opt_out.eq.true")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const c of data) if (c.email) optOut.add(c.email.toLowerCase());
    if (data.length < 1000) break;
    page++;
  }
  return optOut;
}

async function getRepliedSet(): Promise<Set<string>> {
  const replied = new Set<string>();
  const { data } = await supabase
    .from("contacts")
    .select("email")
    .in("status", ["replied", "demo_booked", "client", "interested"]);
  for (const c of data ?? []) if (c.email) replied.add(c.email.toLowerCase());
  return replied;
}

async function main() {
  console.log("\n📬 Follow-up blast — all previously emailed contacts\n");

  // Load sent log
  let sentData: { sent: { email: string; batch: number; sentAt: string; name?: string; practice?: string; template?: string }[] } = { sent: [] };
  if (fs.existsSync(SENT_LOG)) sentData = JSON.parse(fs.readFileSync(SENT_LOG, "utf-8"));

  // Build sets for skipping
  const alreadySentThisBatch = new Set(
    sentData.sent.filter(s => s.template === TEMPLATE_ID).map(s => s.email.toLowerCase())
  );
  const optOut  = await getOptOutList();
  const replied = await getRepliedSet();

  console.log(`  Opt-out list:    ${optOut.size}`);
  console.log(`  Replied set:     ${replied.size} (skipping — handle personally)`);
  console.log(`  Already sent FU: ${alreadySentThisBatch.size}`);

  // Build unique email list from sent log (one follow-up per unique email)
  const seen      = new Set<string>();
  const toSend: { email: string; name: string; practice: string }[] = [];

  for (const entry of sentData.sent) {
    const email = (entry.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) continue;
    if (seen.has(email)) continue;
    seen.add(email);

    if (optOut.has(email))             continue; // unsubscribed
    if (replied.has(email))            continue; // already replied — handle personally
    if (alreadySentThisBatch.has(email)) continue; // already got this FU

    toSend.push({
      email: entry.email,
      name: entry.name?.split(" ")[0] || "there",
      practice: entry.practice || "",
    });
  }

  console.log(`\n  Eligible to follow up: ${toSend.length}\n`);

  let sent = 0, failed = 0;
  const newEntries: typeof sentData.sent = [];

  for (let i = 0; i < toSend.length; i++) {
    const { email, name, practice } = toSend[i];

    const subject = practice
      ? `${practice} — still paying full price for supplies?`
      : "Still paying full price for dental supplies?";

    const pixel = `<img src="${SITE_URL}/api/track/open?e=${encodeURIComponent(email)}&b=${BATCH_NUM}&t=${TEMPLATE_ID}" width="1" height="1" style="display:none" />`;

    const html = `<div style="font-family:sans-serif;max-width:560px;line-height:1.6;color:#111">
  <p>Hi ${name},</p>
  <p>I reached out a little while ago about Dentago. Just circling back because we've added a lot since then.</p>
  <p>We now have 200+ dental clinics using Dentago to consolidate purchasing across Henry Schein, DD Group, Kent Express and their other suppliers — one search, one basket, real prices (the ones you've actually negotiated, not the list price).</p>
  <p>The average clinic saves 3–5 hours a week on procurement and cuts supply costs by 8–12%. Takes 5 minutes to connect your supplier accounts. Free for practices, always.</p>
  <p>If it's worth a look, drop me a message on WhatsApp — <strong>${WHATSAPP}</strong> — and I'll get you set up same day.</p>
  <p>Or book a quick call: <a href="${CALENDLY}">${CALENDLY}</a></p>
  <p>Mercier<br/>Founder @ Dentago<br/><a href="${SITE_URL}">${SITE_URL}</a></p>
</div>${pixel}`;

    const text = `Hi ${name},

I reached out a little while ago about Dentago. Just circling back because we've added a lot since then.

We now have 200+ dental clinics using Dentago to consolidate purchasing across Henry Schein, DD Group, Kent Express and their other suppliers — one search, one basket, real prices (the ones you've actually negotiated, not the list price).

The average clinic saves 3–5 hours a week on procurement and cuts supply costs by 8–12%. Takes 5 minutes to connect your supplier accounts. Free for practices, always.

If it's worth a look, drop me a message on WhatsApp — ${WHATSAPP} — and I'll get you set up same day.

Or book a quick call: ${CALENDLY}

Mercier
Founder @ Dentago
${SITE_URL}`;

    try {
      const result = await resend.emails.send({ from: FROM, to: email, subject, html, text, replyTo: REPLY_TO });
      const resendId = result.data?.id ?? null;

      if ((i + 1) % 50 === 0 || i < 5) {
        console.log(`✅ [${i + 1}/${toSend.length}] ${name} (${practice || email})`);
      }

      // Supabase upsert contact
      const { data: contact } = await supabase
        .from("contacts")
        .upsert(
          { email, status: "cold" },
          { onConflict: "email", ignoreDuplicates: true }
        )
        .select("id, total_messages_sent")
        .single();

      if (contact) {
        await supabase.from("messages").insert({
          contact_id: contact.id, channel: "email", direction: "outbound",
          subject, body: text, status: "sent",
          metadata: { resend_id: resendId, batch: BATCH_LABEL, template: TEMPLATE_ID, batch_num: BATCH_NUM },
          sent_at: new Date().toISOString(),
        });
        await supabase.from("contacts").update({
          total_messages_sent: (contact.total_messages_sent ?? 0) + 1,
          last_contacted_at: new Date().toISOString(),
        }).eq("id", contact.id);
      }

      newEntries.push({
        email,
        batch: BATCH_NUM,
        sentAt: new Date().toISOString(),
        name: name !== "there" ? name : undefined,
        practice: practice || undefined,
        template: TEMPLATE_ID,
      });
      sent++;
    } catch (e: unknown) {
      if ((i + 1) % 100 === 0) {
        console.error(`❌ [${i + 1}] ${email}: ${e instanceof Error ? e.message : String(e)}`);
      }
      failed++;
    }

    await delay(200);
  }

  // Save log
  sentData.sent.push(...newEntries);
  fs.writeFileSync(SENT_LOG, JSON.stringify(sentData, null, 2));

  // OS log
  const body = JSON.stringify({
    summary: `Follow-up blast: ${sent} emails sent to all previously contacted clinics who haven't signed up. Template: ${TEMPLATE_ID}.`,
    decisions_made: [{ decision: "Send follow-up to all 8,957 previously emailed contacts", rationale: "Re-engage cold contacts with updated social proof (200+ clinics)" }],
    work_completed: [{ task: "Follow-up blast", result: `${sent} sent, ${failed} failed. Template: ${TEMPLATE_ID}` }],
    open_loops: [],
    outreach_count: sent,
  });
  await new Promise<void>(resolve => {
    const req = https.request(`${SITE_URL}/api/os/log-context`, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, res => { res.resume(); res.on("end", resolve); });
    req.on("error", () => resolve());
    req.write(body); req.end();
  });

  console.log(`\n${"═".repeat(55)}`);
  console.log(`  Batch:   ${BATCH_LABEL}`);
  console.log(`  Sent:    ${sent}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Log:     ${sentData.sent.length} all-time`);
  console.log(`${"═".repeat(55)}\n`);
}

main().catch(console.error);
