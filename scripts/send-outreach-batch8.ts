/**
 * send-outreach-batch8.ts
 * Sends to fresh leads from:
 * - dataset_google-maps-email-leads-fast-scraper_2026-04-16 (63 new)
 * - dataset_google-maps-with-contact-details_2026-04-20 (202 new)
 * Deduplicates against dentago-sent-all.json
 */

import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";
import * as csv from "csv-parse/sync";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(l => l.trim());
  const firstLine = lines[0].replace(/^\uFEFF/, "");
  const result: Record<string, string>[] = [];
  const headers = parseCSVLine(firstLine);
  for (const line of lines.slice(1)) {
    const vals = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.replace(/^\uFEFF/, "")] = (vals[i] ?? "").trim(); });
    result.push(row);
  }
  return result;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else { current += ch; }
  }
  result.push(current);
  return result;
}

function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@") || !email.includes(".")) return false;
  if (email.startsWith("//") || email.includes("..")) return false;
  const junk = ["example.com", "test@", "noreply", "sentry", "schema.org", "w3.org"];
  return !junk.some(j => email.includes(j));
}

function loadSentEmails(): Set<string> {
  const logPath = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");
  if (!fs.existsSync(logPath)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    return new Set((data.sent ?? []).map((s: { email: string }) => s.email.toLowerCase()));
  } catch { return new Set(); }
}

interface Lead {
  email: string;
  name: string;
  practice: string;
}

function buildEmail(name: string): { subject: string; html: string } {
  const greeting = name && name.toLowerCase() !== "there" ? name : "there";
  const subject = "Only open this if cutting supplies cost is a priority...";
  const html = `
<p>Hi ${greeting},</p>

<p>Most dental practices are spending hours every week logging into 4–5 supplier sites, comparing prices manually, and placing separate orders with each one.</p>

<p>Dentago fixes that. One place to search every supplier you already use, see prices side by side, and place one order. Takes 5 minutes to set up and it's completely free for practices. (Btw we integrate your existing supplier accounts to get your negotiated prices).</p>

<p>If saving on supply costs and cutting down admin time sounds useful, why not join the 200+ dental clinics that are already implementing Dentago? (May as well join the party and save thousands annually on supplies eh?)</p>

<p>Here's my WhatsApp — <strong>+447466 607116</strong>. Happy to get you set up as soon as you drop me a message!</p>

<p>No credit card required — we do NOT charge clinics. We take our fee from the suppliers we work with.</p>

<p>Mercier<br/>
Founder @ Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim();
  return { subject, html };
}

async function main() {
  const previouslySent = loadSentEmails();
  console.log(`📧 ${previouslySent.size} already sent — skipping duplicates\n`);

  const leads: Lead[] = [];
  const seenEmails = new Set<string>(previouslySent);

  // ── Dataset 1: fast scraper (has 'name' and 'email' columns) ─────────────
  const ds1 = parseCSV(path.join(process.env.HOME!, "Downloads",
    "dataset_google-maps-email-leads-fast-scraper_2026-04-16_23-02-11-503.csv"));

  for (const row of ds1) {
    const email = row["email"]?.trim().toLowerCase();
    if (!isValidEmail(email) || seenEmails.has(email)) continue;
    seenEmails.add(email);
    leads.push({ email, name: "there", practice: row["name"] || "" });
  }
  console.log(`Dataset 1 (fast scraper): ${leads.length} new leads`);

  // ── Dataset 2: google-maps with contact details (emails/0..5, title) ─────
  const countBefore = leads.length;
  const ds2 = parseCSV(path.join(process.env.HOME!, "Downloads",
    "dataset_google-maps-with-contact-details_2026-04-20_00-35-35-834.csv"));

  for (const row of ds2) {
    const practice = row["title"]?.trim() || "";
    // Try each email column
    for (let i = 0; i <= 5; i++) {
      const email = row[`emails/${i}`]?.trim().toLowerCase();
      if (!email) continue;
      if (!isValidEmail(email) || seenEmails.has(email)) continue;
      seenEmails.add(email);
      leads.push({ email, name: "there", practice });
      break; // one email per practice
    }
  }
  console.log(`Dataset 2 (contact details): ${leads.length - countBefore} new leads`);
  console.log(`\n📋 Total to send: ${leads.length}\n`);

  const sent: { name: string; email: string; practice: string; status: string }[] = [];
  const failed: { email: string; error: string }[] = [];

  for (let i = 0; i < leads.length; i++) {
    const { email, name, practice } = leads[i];
    const { subject, html } = buildEmail(name);

    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: email,
        subject,
        html,
        replyTo: FROM,
        headers: { "List-Unsubscribe": "<mailto:mercier@dentago.co.uk?subject=unsubscribe>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      sent.push({ name, email, practice, status: "Sent" });
      console.log(`✅ [${i + 1}/${leads.length}] ${practice || email} → ${email}`);
    } catch (err: any) {
      failed.push({ email, error: err?.message ?? String(err) });
      console.error(`❌ [${i + 1}/${leads.length}] ${email}: ${err?.message ?? err}`);
    }

    await new Promise(r => setTimeout(r, 220));
  }

  console.log(`\n📊 Batch 8 complete: ${sent.length} sent, ${failed.length} failed`);

  // Persist to all-time log
  const logPath = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");
  const existing = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
    : { sent: [] };
  existing.sent.push(...sent.map(s => ({
    ...s,
    batch: 8,
    template: "Batch8-ShortDirect",
    sentAt: new Date().toISOString(),
  })));
  fs.writeFileSync(logPath, JSON.stringify(existing, null, 2));
  console.log(`💾 Log updated — ${existing.sent.length} total emails on record`);
}

main().catch(console.error);
