/**
 * Follow-Up 1 for Batch 5 (Apollo ~1,000 contacts)
 * Due: 26 April 2026 — sending today 27 April (1 day late)
 */
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Load Batch 5 contacts from sent log
function loadBatch5Contacts(): { name: string; email: string; practice: string }[] {
  const logPath = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");
  const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
  return (data.sent ?? [])
    .filter((s: any) => s.batch === 5 && s.status === "Sent")
    .map((s: any) => ({ name: s.name ?? "", email: s.email, practice: s.practice ?? "" }));
}

function buildFollowUp(firstName: string): { subject: string; html: string } {
  const name = firstName?.split(" ")[0] || "there";
  return {
    subject: `${name}, still worth 2 minutes?`,
    html: `
<p>Hi ${name},</p>

<p>Dropping you a quick follow-up on Dentago — the free tool that lets UK dental practices search all their suppliers in one place and compare prices instantly.</p>

<p>Since I last emailed, we've added DD Group's full product catalogue (10,000+ products with live pricing) alongside Henry Schein, Kent Express, Dental Sky and others. Most practices find they're overpaying on at least a few lines.</p>

<p>Takes 5 minutes to connect your existing supplier accounts. Zero cost to the practice.</p>

<p>If it's useful, drop me a WhatsApp on <strong>+447466 607116</strong> and I'll get you set up today.</p>

<p>Best,<br/>
Mercier<br/>
Founder, Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
<img src="https://www.dentago.co.uk/api/track/open?e=${encodeURIComponent(email)}&b=fu5" width="1" height="1" style="display:none" />
    `.trim(),
  };
}

async function main() {
  const contacts = loadBatch5Contacts();
  console.log(`\n📤 Sending Follow-Up 1 to ${contacts.length} Batch 5 contacts\n`);

  let sent = 0, failed = 0;

  for (const c of contacts) {
    const { subject, html } = buildFollowUp(c.name);
    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: c.email,
        subject,
        html,
        replyTo: FROM,
        headers: { "List-Unsubscribe": "<mailto:mercier@dentago.co.uk?subject=unsubscribe>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      sent++;
      if (sent % 50 === 0 || sent <= 5) {
        console.log(`✅ [${sent}/${contacts.length}] ${c.name} → ${c.email}`);
      }
    } catch (err: any) {
      failed++;
      console.error(`❌ ${c.name} (${c.email}): ${err?.message}`);
    }
    await delay(150);
  }

  console.log(`\n=== Follow-Up 1 (Batch 5) Complete ===`);
  console.log(`Sent:   ${sent}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
