import { Resend } from "resend";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";

async function main() {
  const html = `<p>Hi Howard,</p>

<p>I reached out to Jon Wiltshire and then Sam Tyrer about a partnership — both have kindly moved on and suggested you're the right person to speak with.</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental practices. We aggregate all major UK dental suppliers into one platform so practices can search, compare prices, and place orders without switching between portals.</p>

<p>We're currently processing <strong>£800,000 in GMV monthly</strong>, projected to hit <strong>£1,000,000/month within 3 months of our public launch</strong>, and tracking towards <strong>£8,000,000 GMV monthly by end of year one</strong>.</p>

<p>I'd love to get <strong>DD Group / Dental Directory</strong> on the platform — your full catalog visible to every practice actively shopping on Dentago, with existing negotiated pricing intact for trade accounts.</p>

<p><strong>What it looks like for DD Group:</strong></p>
<ul>
  <li>Direct visibility to hundreds of UK practices already on the platform</li>
  <li>Negotiated account prices pulled through automatically — existing customers see the right price</li>
  <li>New clinic customers you wouldn't otherwise reach</li>
  <li>Zero upfront cost — commission basis from orders placed through Dentago</li>
</ul>

<p>Worth a quick 20-minute call? Happy to walk you through the platform and the integration.</p>

<p>You can reach me directly on WhatsApp at <strong>+447466 607116</strong> or just reply here.</p>

<p>Best,<br/>
Mercier<br/>
Founder @ Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a><br/>
mercier@dentago.co.uk</p>`;

  try {
    await resend.emails.send({
      from: `Mercier @ Dentago <${FROM}>`,
      to: "howard.taylor@ddgroup.com",
      subject: "Partnership opportunity — Dentago (referred by Sam Tyrer)",
      html,
      replyTo: FROM,
    });
    console.log("✅ Email sent to Howard Taylor (Group CEO) @ DD Group → howard.taylor@ddgroup.com");
  } catch (e: any) {
    console.error("❌ Failed:", e?.message);
  }
}

main().catch(console.error);
