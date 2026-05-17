import { Resend } from "resend";
import * as fs from "fs";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const sentData = JSON.parse(fs.readFileSync(process.env.HOME + "/Downloads/dentago-sent-all.json", "utf-8"));

  const chContacts = sentData.sent.filter((s: any) => s.batch === "companies-house-scrape");
  console.log(`\n📤 Companies House FU1 — ${chContacts.length} contacts\n`);

  let sent = 0, failed = 0;

  for (let i = 0; i < chContacts.length; i++) {
    const r = chContacts[i];
    const email = r.email.toLowerCase();
    const practice = r.practice || r.name || "";

    const subject = `Re: Quick question for ${practice}`;

    const html = `<p>Hi there,</p>
<p>Just wanted to follow up on my last email.</p>
<p>We've had a lot of dental practices join Dentago this week — it lets you search all your suppliers in one place, compare prices, and place one order instead of logging into 4–5 separate sites.</p>
<p>It's completely free for practices and takes 5 minutes to set up. We connect your existing supplier accounts so you get your negotiated prices.</p>
<p>If it's of interest, drop me a message on WhatsApp — <strong>+447466 607116</strong> — and I'll get you sorted straight away.</p>
<p>Mercier<br/>Founder @ Dentago<br/><a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
<img src="https://www.dentago.co.uk/api/track/open?e=${encodeURIComponent(email)}&b=unknown" width="1" height="1" style="display:none" />`;

    try {
      await resend.emails.send({
        from: `Mercier @ Dentago <${FROM}>`,
        to: email,
        subject,
        html,
        replyTo: FROM,
        headers: {
          "List-Unsubscribe": `<mailto:${FROM}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      console.log(`✅ [${i + 1}/${chContacts.length}] ${practice} → ${email}`);
      sent++;
    } catch (e: any) {
      console.error(`❌ [${i + 1}/${chContacts.length}] ${email}: ${e?.message}`);
      failed++;
    }

    await delay(220);
  }

  console.log(`\n=== Companies House FU1 Complete ===`);
  console.log(`Sent:   ${sent}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
