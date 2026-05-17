/**
 * Outreach — Prospeo 2026-05-15, constructed emails (firstname.lastname@domain)
 * Run: npx tsx scripts/send-outreach-prospeo-constructed-2026-05-15.ts
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
const SITE_URL     = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dentago.co.uk";
const FROM         = "Mercier at Dentago <mercier@dentago.co.uk>";
const REPLY_TO     = "mercier@dentago.co.uk";
const CALENDLY     = "https://calendly.com/rnsv/dentago-introduction";
const WHATSAPP     = "+447466607116";
const BATCH_LABEL  = "prospeo-2026-05-15-constructed";
const BATCH_NUM    = 14;
const TEMPLATE_ID  = "200-clinics-v1";
const SENT_LOG     = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");

const CSV_FILES = [
  "prospeo_person_export_20260515_192813_bff9c5.csv",
  "prospeo_person_export_20260515_192834_8bee5d.csv",
  "prospeo_person_export_20260515_192903_b7a43c.csv",
  "prospeo_person_export_20260515_192939_5a817a.csv",
].map(f => path.join(process.env.HOME!, "Downloads", f));

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  // Load sent log
  let sentData: { sent: { email: string; batch: number; sentAt: string; name?: string; practice?: string; template?: string }[] } = { sent: [] };
  if (fs.existsSync(SENT_LOG)) sentData = JSON.parse(fs.readFileSync(SENT_LOG, "utf-8"));
  const alreadySent = new Set(sentData.sent.map(s => s.email.toLowerCase()));

  // Parse CSVs — only rows with NO verified email, construct from name + domain
  const seen = new Set<string>();
  const rows: Record<string, string>[] = [];

  for (const f of CSV_FILES) {
    const result = Papa.parse<Record<string, string>>(
      fs.readFileSync(f, "utf-8").replace(/^\uFEFF/, ""),
      { header: true, skipEmptyLines: true }
    );
    for (const r of result.data) {
      const existing = (r["Email"] || "").trim();
      if (existing.includes("@")) continue; // already has verified email — sent in previous batch

      const first  = (r["First name"] || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const last   = (r["Last name"]  || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const domain = (r["Company domain"] || "").trim();
      if (!first || !last || !domain) continue;

      const email = `${first}.${last}@${domain}`;
      if (seen.has(email) || alreadySent.has(email)) continue;
      seen.add(email);
      r["_email"] = email;
      rows.push(r);
    }
  }

  console.log(`\n📬 ${BATCH_LABEL}`);
  console.log(`  Constructed leads: ${rows.length}\n`);

  let sent = 0, failed = 0;
  const newEntries: typeof sentData.sent = [];

  for (let i = 0; i < rows.length; i++) {
    const r       = rows[i];
    const email   = r["_email"];
    const name    = (r["First name"] || "there").trim();
    const practice = (r["Company name"] || "").trim();

    const subject = practice ? `${practice} — free to use` : "Dentago — free for practices";
    const pixel   = `<img src="${SITE_URL}/api/track/open?e=${encodeURIComponent(email)}&b=${BATCH_NUM}&t=${TEMPLATE_ID}" width="1" height="1" style="display:none" />`;

    const html = `<div style="font-family:sans-serif;max-width:560px;line-height:1.6;color:#111">
  <p>Hi ${name},</p>
  <p>Most dental practices are spending hours every week logging into 4–5 supplier sites, comparing prices manually, and placing separate orders with each one.</p>
  <p>Dentago fixes that. One place to search every supplier you already use, see prices side by side, and place one order. Takes 5 minutes to set up and it's completely free for practices. (We integrate your existing supplier accounts to get your actual negotiated prices.)</p>
  <p>If saving on supply costs and cutting down admin time sounds useful, why not join the 200+ dental clinics already using Dentago? (May as well join the party and save thousands annually on supplies.)</p>
  <p>Here's my WhatsApp — <strong>${WHATSAPP}</strong>. Happy to get you set up as soon as you drop me a message!</p>
  <p>No credit card required — we do <strong>not</strong> charge clinics. We take our fee from the suppliers we work with.</p>
  <p>Or book a quick call: <a href="${CALENDLY}">${CALENDLY}</a></p>
  <p>Mercier<br/>Founder @ Dentago<br/><a href="${SITE_URL}">${SITE_URL}</a></p>
</div>${pixel}`;

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

    try {
      const result = await resend.emails.send({ from: FROM, to: email, subject, html, text, replyTo: REPLY_TO });
      const resendId = result.data?.id ?? null;
      console.log(`✅ [${i + 1}/${rows.length}] ${name} (${practice}) → ${email}`);

      // Supabase upsert
      const { data: contact } = await supabase
        .from("contacts")
        .upsert(
          {
            email,
            name: [r["First name"], r["Last name"]].filter(Boolean).join(" "),
            practice_name: practice || null,
            location: (r["Person city"] || "").split(",")[0].trim() || null,
            status: "cold",
            source: "prospeo-constructed",
          },
          { onConflict: "email", ignoreDuplicates: false }
        )
        .select("id, total_messages_sent")
        .single();

      if (contact) {
        await supabase.from("messages").insert({
          contact_id: contact.id, channel: "email", direction: "outbound",
          subject, body: text, status: "sent",
          metadata: { resend_id: resendId, batch: BATCH_LABEL, template: TEMPLATE_ID, batch_num: BATCH_NUM, email_constructed: true },
          sent_at: new Date().toISOString(),
        });
        await supabase.from("contacts").update({
          total_messages_sent: (contact.total_messages_sent ?? 0) + 1,
          last_contacted_at: new Date().toISOString(),
        }).eq("id", contact.id);
        await supabase.from("events").insert({
          event_type: "outreach_sent", entity_type: "contact", entity_id: contact.id,
          payload: { email, practice, template: TEMPLATE_ID, batch: BATCH_LABEL, resend_id: resendId, email_constructed: true },
          metrics: {}, kpi_impact: {}, source: "outreach_script",
        });
      }

      newEntries.push({ email, batch: BATCH_NUM, sentAt: new Date().toISOString(), name: [r["First name"], r["Last name"]].filter(Boolean).join(" ") || undefined, practice: practice || undefined, template: TEMPLATE_ID });
      sent++;
    } catch (e: unknown) {
      console.error(`❌ [${i + 1}/${rows.length}] ${email}: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }

    await delay(260);
  }

  // Save log
  sentData.sent.push(...newEntries);
  fs.writeFileSync(SENT_LOG, JSON.stringify(sentData, null, 2));

  // OS log
  const body = JSON.stringify({
    summary: `Outreach batch ${BATCH_LABEL}: ${sent} emails sent using constructed emails (firstname.lastname@domain), ${failed} failed.`,
    decisions_made: [{ decision: "Constructed emails from firstname.lastname@domain", rationale: "64 Prospeo leads had no verified email — pattern construction gets full coverage" }],
    work_completed: [{ task: "Send constructed-email Prospeo batch", result: `${sent} sent. Template: ${TEMPLATE_ID}.` }],
    open_loops: [],
    outreach_count: sent,
  });
  await new Promise<void>(resolve => {
    const req = https.request(`${SITE_URL}/api/os/log-context`, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, res => { res.resume(); res.on("end", resolve); });
    req.on("error", () => resolve());
    req.write(body); req.end();
  });

  console.log(`\n${"═".repeat(55)}`);
  console.log(`  Batch:      ${BATCH_LABEL}`);
  console.log(`  Sent:       ${sent}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Log total:  ${sentData.sent.length} all-time`);
  console.log(`${"═".repeat(55)}\n`);
}

main().catch(console.error);
