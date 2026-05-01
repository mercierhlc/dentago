/**
 * Partnership / commercial enquiry to Henry Schein sales inbox.
 *
 * Run:  npx tsx scripts/send-henry-schein-sales.ts
 * Dry:  npx tsx scripts/send-henry-schein-sales.ts --dry-run
 */
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

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
const TO = "sales@henryschein.co.uk";
const REPLY_TO = "mercier@dentago.co.uk";

const SUBJECT = "Partnership enquiry — Dentago marketplace & Henry Schein catalogue integration";

const TEXT = `Hi Henry Schein team,

I'm Mercier, founder of Dentago (dentago.co.uk). We operate a UK dental procurement platform where practices compare suppliers in one search, see pricing and availability, and consolidate checkout.

Henry Schein is already part of our supplier set. We're writing to the sales/commercial side to explore:

• A structured way to keep your catalogue, pricing, and stock status current for practices using Dentago (e.g. CSV, API, or your preferred partner format)
• The right contact for marketplace, aggregation, or B2B integration partnerships if this inbox should be routed elsewhere

We're onboarding UK practices now and want supply-side relationships to be accurate and low-friction for both sides.

Happy to share a short overview or book a brief call at your convenience.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
dentago.co.uk
`;

const HTML = `<p>Hi Henry Schein team,</p>

<p>I'm Mercier, founder of <strong><a href="https://dentago.co.uk">Dentago</a></strong>. We operate a UK dental procurement platform where practices compare suppliers in one search, see pricing and availability, and consolidate checkout.</p>

<p>Henry Schein is already part of our supplier set. We're writing to the sales/commercial side to explore:</p>

<ul>
  <li>A structured way to keep your catalogue, pricing, and stock status current for practices using Dentago (e.g. CSV, API, or your preferred partner format)</li>
  <li>The right contact for marketplace, aggregation, or B2B integration partnerships if this inbox should be routed elsewhere</li>
</ul>

<p>We're onboarding UK practices now and want supply-side relationships to be accurate and low-friction for both sides.</p>

<p>Happy to share a short overview or book a brief call at your convenience.</p>

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
  console.log(`Subject: ${SUBJECT}`);
  console.log(`---\n${TEXT}\n---`);

  if (DRY_RUN) {
    console.log("\nDRY RUN — not sending. Re-run without --dry-run to send.");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: FROM,
    to: TO,
    replyTo: REPLY_TO,
    subject: SUBJECT,
    text: TEXT,
    html: HTML,
  });

  if ((result as { error?: unknown }).error) {
    console.error("\n[FAILED]", (result as { error: unknown }).error);
    process.exit(1);
  }
  console.log(`\n[SENT]  Resend message id: ${(result as { data?: { id: string } }).data?.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
