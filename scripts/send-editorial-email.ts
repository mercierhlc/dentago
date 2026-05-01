import { Resend } from "resend";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");

async function main() {
  const { data, error } = await resend.emails.send({
    from: "Mercier <mercier@dentago.co.uk>",
    to: "editorial@dentistry.co.uk",
    replyTo: "mercier@dentago.co.uk",
    subject: "New free procurement platform for UK dental practices — story idea",
    html: `
      <p>Hi there,</p>

      <p>I'm reaching out because I think there's a story your readers would find genuinely useful.</p>

      <p>I've recently launched <strong>Dentago</strong> — a free B2B procurement marketplace specifically for UK dental practices. The idea came from speaking to practice managers and dentists who were spending hours each week manually comparing prices across suppliers like Henry Schein, Dental Sky, and Trycare using spreadsheets.</p>

      <p>Dentago lets practices:</p>
      <ul>
        <li>Search and compare dental supplies across multiple suppliers in one place</li>
        <li>See real-time pricing and stock availability</li>
        <li>Place orders from a single platform</li>
        <li>Completely free for practices — no subscription, no commission</li>
      </ul>

      <p>In the first month since launch, we've had hundreds of UK dental practices sign up and are booking demos with practice managers across NHS and private practices.</p>

      <p>Given the ongoing pressure on dental practice margins — particularly for NHS contract holders — I thought this might be worth covering. I'm happy to share data on how much practices are typically overpaying, offer a walkthrough of the platform, or make myself available for an interview.</p>

      <p>You can see the platform at <a href="https://dentago.co.uk">dentago.co.uk</a>.</p>

      <p>Would love to hear if this is something you'd consider covering.</p>

      <p>Best,<br>
      Mercier<br>
      Founder, Dentago<br>
      mercier@dentago.co.uk</p>
    `,
  });

  if (error) {
    console.error("Failed:", error);
  } else {
    console.log("✅ Email sent to editorial@dentistry.co.uk");
    console.log("ID:", data?.id);
  }
}

main().catch(console.error);
