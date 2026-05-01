import { Resend } from "resend";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const suppliers = [
  {
    name: "DHB Oral Healthcare",
    contactName: "Jo",
    contact: "jmcfadden@dhb.co.uk",
  },
  {
    name: "Trycare",
    contactName: "Craig",
    contact: "craig.cranfield@trycare.co.uk",
  },
];

async function main() {
  console.log(`Resending to ${suppliers.length} corrected addresses...\n`);

  for (let i = 0; i < suppliers.length; i++) {
    const s = suppliers[i];

    const subject = "Partnership opportunity — Dentago";
    const html = `<p>Hi ${s.contactName},</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental practices. We put every supplier in one place so practices can search, compare prices, and order without switching between sites.</p>

<p>We're currently processing <strong>£800,000 in GMV monthly</strong>, projected to hit <strong>£1,000,000/month within 3 months of our public launch</strong>, and tracking towards <strong>£8,000,000 GMV monthly by end of year one</strong>. The platform is growing fast and we're building out our supplier network now.</p>

<p>I'd love to get <strong>${s.name}</strong> on the platform — your products in front of every practice actively shopping on Dentago, with your existing negotiated pricing intact for trade accounts.</p>

<p><strong>What it looks like for ${s.name}:</strong></p>
<ul>
  <li>Direct visibility to hundreds of UK practices already on the platform</li>
  <li>Your negotiated account prices pulled through automatically — so existing customers see the right price</li>
  <li>New clinic customers you wouldn't otherwise reach</li>
  <li>Zero upfront cost — we work on a commission basis from orders placed through Dentago</li>
</ul>

<p>Worth a quick 20-minute call to explore? Happy to walk you through the platform and how the integration works.</p>

<p>You can reach me directly on WhatsApp at <strong>+447466 607116</strong> or just reply here.</p>

<p>Best,<br/>
Mercier<br/>
Founder @ Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a><br/>
mercier@dentago.co.uk</p>`;

    try {
      await resend.emails.send({ from: `Mercier @ Dentago <${FROM}>`, to: s.contact, subject, html, replyTo: FROM });
      console.log(`✅ [${i + 1}/${suppliers.length}] ${s.contactName} @ ${s.name} → ${s.contact}`);
    } catch (e: any) {
      console.error(`❌ ${s.contact}: ${e?.message}`);
    }

    await delay(300);
  }
}

main().catch(console.error);
