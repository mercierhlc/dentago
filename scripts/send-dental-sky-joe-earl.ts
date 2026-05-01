/**
 * One-shot partnership outreach to Joe Earl (Director & GM, Dental Sky).
 *
 * Sends to joe.earl@dentalsky.com (primary), CCs joe.earl9@googlemail.com.
 * Run:  npx tsx scripts/send-dental-sky-joe-earl.ts
 * Dry:  npx tsx scripts/send-dental-sky-joe-earl.ts --dry-run
 */
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

// Load .env.local (RESEND_API_KEY) without requiring dotenv at runtime
function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

const DRY_RUN = process.argv.includes("--dry-run");

const FROM = "Mercier <mercier@dentago.co.uk>";
const TO = "joe.earl@dentalsky.com";
const CC = "joe.earl9@googlemail.com";
const REPLY_TO = "mercier@dentago.co.uk";

const SUBJECT = "Dental Sky as the price-winner on Dentago — partnership conversation";

const TEXT = `Hi Joe,

I'm Mercier, founder of Dentago — a free procurement marketplace for UK dental practices. Clinics search a single product, see every UK supplier side-by-side with live pricing, and order from all of them in one cart. Think VetCove for UK dental.

I'm writing because, having indexed your full public catalogue (~10,700 SKUs) against the rest of the UK supplier landscape, Dental Sky comes out as the price-winner across most consumables, infection control, and endo categories — meaningfully under Henry Schein and Kent Express on a per-line basis. That isn't a marketing line; that's what every clinic running a comparison search on Dentago will see.

Two implications for Dental Sky:

1. You will be the default winner of the cart. When a practice manager compares the same SKU across suppliers, the cheapest stocked option wins by default. The data we've already pulled says that's overwhelmingly you.

2. You get distribution to clinics who currently default to Henry Schein out of habit. UK practices stick with HS not because HS is cheapest — they're not — but because switching is friction. Dentago removes the friction.

We're tracking toward £3M/month in GMV across the platform by Year 1 close (current pipeline + BDA conversation in progress). Based on the price comparison data, we expect the majority of that order flow to route to Dental Sky.

What I'd like from a 15-minute call:
- Walk you through what we've built and the live pricing comparison vs. the rest of the market
- Discuss a founding catalogue partnership — direct CSV/API feed instead of public-page scraping, so your data on Dentago is always current and complete
- Talk about how we surface Dental Sky to clinics as the default supplier for the categories where you're strongest

Free this week or next? Happy to come up to your office or do it on Teams/Zoom.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
dentago.co.uk
`;

// Lightweight HTML version for inboxes that prefer it (preserves the bold lead-ins)
const HTML = `<p>Hi Joe,</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement marketplace for UK dental practices. Clinics search a single product, see every UK supplier side-by-side with live pricing, and order from all of them in one cart. Think VetCove for UK dental.</p>

<p>I'm writing because, having indexed your full public catalogue (~10,700 SKUs) against the rest of the UK supplier landscape, <strong>Dental Sky comes out as the price-winner across most consumables, infection control, and endo categories</strong> — meaningfully under Henry Schein and Kent Express on a per-line basis. That isn't a marketing line; that's what every clinic running a comparison search on Dentago will see.</p>

<p>Two implications for Dental Sky:</p>

<ol>
  <li><strong>You will be the default winner of the cart.</strong> When a practice manager compares the same SKU across suppliers, the cheapest stocked option wins by default. The data we've already pulled says that's overwhelmingly you.</li>
  <li><strong>You get distribution to clinics who currently default to Henry Schein out of habit.</strong> UK practices stick with HS not because HS is cheapest — they're not — but because switching is friction. Dentago removes the friction.</li>
</ol>

<p>We're tracking toward <strong>£3M/month in GMV across the platform by Year 1 close</strong> (current pipeline + BDA conversation in progress). Based on the price comparison data, we expect the majority of that order flow to route to Dental Sky.</p>

<p>What I'd like from a 15-minute call:</p>
<ul>
  <li>Walk you through what we've built and the live pricing comparison vs. the rest of the market</li>
  <li>Discuss a founding catalogue partnership — direct CSV/API feed instead of public-page scraping, so your data on Dentago is always current and complete</li>
  <li>Talk about how we surface Dental Sky to clinics as the default supplier for the categories where you're strongest</li>
</ul>

<p>Free this week or next? Happy to come up to your office or do it on Teams/Zoom.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`;

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing from .env / .env.local");
    process.exit(1);
  }

  console.log(`From:    ${FROM}`);
  console.log(`To:      ${TO}`);
  console.log(`Cc:      ${CC}`);
  console.log(`Subject: ${SUBJECT}`);
  console.log(`---\n${TEXT.slice(0, 400)}...\n---`);

  if (DRY_RUN) {
    console.log("\nDRY RUN — not sending. Re-run without --dry-run to send.");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: FROM,
    to: TO,
    cc: CC,
    replyTo: REPLY_TO,
    subject: SUBJECT,
    text: TEXT,
    html: HTML,
  });

  if ((result as any).error) {
    console.error("\n[FAILED]", (result as any).error);
    process.exit(1);
  }
  console.log(`\n[SENT]  Resend message id: ${(result as any).data?.id}`);
}

main().catch(err => { console.error(err); process.exit(1); });
