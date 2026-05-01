import { Resend } from "resend";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";

async function main() {
  const html = `<p>Hi Sam,</p>

<p>I reached out to Jon Wiltshire recently about a partnership opportunity — he kindly let me know he's moved on and suggested I contact you.</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental practices. We aggregate all major UK dental suppliers into one platform so practices can search, compare prices, and place orders without switching between portals.</p>

<p>We're currently processing <strong>£800,000 in GMV monthly</strong>, projected to hit <strong>£1,000,000/month within 3 months of our public launch</strong>, and tracking towards <strong>£8,000,000 GMV monthly by end of year one</strong>.</p>

<p>I'd love to get <strong>DD Group / Dental Directory</strong> on the platform — your products visible to every practice actively shopping on Dentago, with existing negotiated pricing intact for trade accounts.</p>

<p><strong>What it looks like for DD Group:</strong></p>
<ul>
  <li>Direct visibility to hundreds of UK practices already on the platform</li>
  <li>Negotiated account prices pulled through automatically — existing customers see the right price</li>
  <li>New clinic customers you wouldn't otherwise reach</li>
  <li>Zero upfront cost — commission basis from orders placed through Dentago</li>
</ul>

<p>Worth a quick 20-minute call to explore? Happy to walk you through the platform.</p>

<p>You can reach me directly on WhatsApp at <strong>+447466 607116</strong> or just reply here.</p>

<p>Best,<br/>
Mercier<br/>
Founder @ Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a><br/>
mercier@dentago.co.uk</p>`;

  try {
    await resend.emails.send({
      from: `Mercier @ Dentago <${FROM}>`,
      to: "sam.tyrer@ddgroup.com",
      subject: "Partnership opportunity — Dentago (referred by Jon Wiltshire)",
      html,
      replyTo: FROM,
    });
    console.log("✅ Email sent to Sam Tyrer @ DD Group → sam.tyrer@ddgroup.com");
  } catch (e: any) {
    console.error("❌ Failed:", e?.message);
  }
}

main().catch(console.error);
