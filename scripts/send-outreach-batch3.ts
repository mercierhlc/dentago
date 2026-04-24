import { Resend } from "resend";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";

const targets = [
  { name: "Birch Valley Dental Clinic", email: "info@birch-valley.co.uk", city: "Dalbeattie", score: 0, reviewCount: 0, hasInstagram: false },
  { name: "Wollaston Dental Practice", email: "info@wollastondental.co.uk", city: "Stourbridge", score: 0, reviewCount: 0, hasInstagram: false },
  { name: "New Park House Dental Centre", email: "reception@nphd.co.uk", city: "Shrewsbury", score: 0, reviewCount: 0, hasInstagram: false },
  { name: "Dental Health Stop", email: "info@dentalhealthstop.co.uk", city: "Wolverhampton", score: 0, reviewCount: 0, hasInstagram: false },
  { name: "DK Dental Practice", email: "info@dkdentalpracticeandlab.com", city: "Weymouth", score: 0, reviewCount: 0, hasInstagram: false },
  { name: "Roy Morris Dental & Implant Excellence", email: "smiles@excellence-in-dentistry.co.uk", city: "Droitwich", score: 0, reviewCount: 0, hasInstagram: false },
];

function buildEmail(name: string, city: string): { subject: string; html: string } {
  const cityLine = city ? ` in ${city}` : "";
  const subject = `Quick question for ${name}`;
  const html = `
<p>Hi there,</p>

<p>I came across ${name}${cityLine} while researching dental practices across the UK.</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free platform that lets UK dental practices compare prices across all their suppliers (Henry Schein, Kent Express, Dental Sky, and 40+ others) in one place.</p>

<p>Most practices we speak to are spending 3–5 hours a week on procurement and often overpaying by 15–30% simply because they don't have an easy way to compare. Dentago fixes that — no cost, no contract, just a faster and smarter way to buy.</p>

<p>Would it be useful to see how it works for a practice like ${name}? Happy to do a 15-min walkthrough — no sales pitch, just showing you the tool.</p>

<p>Best,<br/>Mercier<br/>Dentago — <a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim();
  return { subject, html };
}

async function main() {
  const results: { name: string; email: string; city: string; status: string }[] = [];

  for (const t of targets) {
    const { subject, html } = buildEmail(t.name, t.city);
    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: t.email,
        subject,
        html,
        replyTo: FROM,
      });
      results.push({ ...t, status: "Sent" });
      console.log(`✅ ${t.name} → ${t.email}`);
    } catch (err) {
      results.push({ ...t, status: "Failed" });
      console.error(`❌ ${t.name}:`, err);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n📊 Batch 3: ${results.filter(r => r.status === "Sent").length} sent, ${results.filter(r => r.status === "Failed").length} failed`);
  results.forEach((r, i) => console.log(`${i + 1}. ${r.name} | ${r.email} | ${r.city} | ${r.status}`));
}

main().catch(console.error);
