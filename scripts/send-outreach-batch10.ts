import { Resend } from "resend";
import * as fs from "fs";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter(l => l.trim());
  const hdr = lines[0].replace(/^\uFEFF/, "").split(",").map(h => h.replace(/"/g, "").trim());
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) { vals.push(cur); cur = ""; }
      else cur += ch;
    }
    vals.push(cur);
    const row: Record<string, string> = {};
    hdr.forEach((h, i) => { row[h] = (vals[i] ?? "").replace(/"/g, "").trim(); });
    return row;
  });
}

async function main() {
  const sentData = JSON.parse(fs.readFileSync(process.env.HOME + "/Downloads/dentago-sent-all.json", "utf-8"));
  const rows = parseCSV(fs.readFileSync(
    process.env.HOME + "/Downloads/dataset_leads-finder_2026-04-26_12-22-41-573.csv", "utf-8"
  ));

  const leads = rows.filter(r => r.email && r.email.includes("@"));
  console.log(`Sending to all ${leads.length} leads...\n`);

  let sent = 0, failed = 0;

  for (let i = 0; i < leads.length; i++) {
    const r = leads[i];
    const name = r.first_name || "there";
    const email = r.email.toLowerCase();
    const company = r.company_name || "";

    const subject = "Only open this if cutting supplies cost is a priority...";
    const html = `<p>Hi ${name},</p>
<p>Most dental practices are spending hours every week logging into 4–5 supplier sites, comparing prices manually, and placing separate orders with each one.</p>
<p>Dentago fixes that. One place to search every supplier you already use, see prices side by side, and place one order. Takes 5 minutes to set up and it's completely free for practices. (Btw we integrate your existing supplier accounts to get your negotiated prices).</p>
<p>If saving on supply costs and cutting down admin time sounds useful, why not join the 200+ dental clinics that are already implementing Dentago? (May as well join the party and save thousands annually on supplies eh?)</p>
<p>Here's my WhatsApp — <strong>+447466 607116</strong>. Happy to get you set up as soon as you drop me a message!</p>
<p>No credit card required — we do NOT charge clinics. We take our fee from the suppliers we work with.</p>
<p>Mercier<br/>Founder @ Dentago<br/><a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
<img src="https://www.dentago.co.uk/api/track/open?e=${encodeURIComponent(email)}&b=10" width="1" height="1" style="display:none" />`;

    try {
      await resend.emails.send({ from: `Mercier @ Dentago <${FROM}>`, to: email, subject, html, replyTo: FROM });
      console.log(`✅ [${i + 1}/${leads.length}] ${name} (${company}) → ${email}`);
      sentData.sent.push({ name, email, practice: company, batch: 10, template: "Batch10", sentAt: new Date().toISOString() });
      sent++;
    } catch (e: any) {
      console.error(`❌ [${i + 1}/${leads.length}] ${email}: ${e?.message}`);
      failed++;
    }

    await delay(220);
  }

  fs.writeFileSync(process.env.HOME + "/Downloads/dentago-sent-all.json", JSON.stringify(sentData, null, 2));
  console.log(`\nBatch 10 done: ${sent} sent, ${failed} failed`);
  console.log(`Total on record: ${sentData.sent.length}`);
}

main().catch(console.error);
