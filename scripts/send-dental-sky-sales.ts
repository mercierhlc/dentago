/**
 * Partnership / commercial enquiry to Dental Sky sales inbox.
 *
 * Run:  npx tsx scripts/send-dental-sky-sales.ts
 * Dry:  npx tsx scripts/send-dental-sky-sales.ts --dry-run
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
const TO = "sales@dentalsky.com";
const REPLY_TO = "mercier@dentago.co.uk";

const SUBJECT = "Partnership enquiry — Dentago marketplace & Dental Sky catalogue data";

const TEXT = `Hi Dental Sky team,

I'm Mercier, founder of Dentago (dentago.co.uk). We run a free UK dental procurement platform: practices search once, see suppliers side-by-side with pricing/stock, and check out across baskets in one flow.

Dental Sky is already an important supplier on the platform. We're reaching out on the commercial side to discuss:

• A structured catalogue link-up (CSV, API, or whichever format you prefer) so your range, prices, and availability stay accurate for our mutual customers
• Any commercial or integration contact you use for marketplace or aggregation partners — if this inbox isn't the right place, a pointer would be appreciated

I've also been in touch with Joe separately; either way, we'd like to make sure we're aligned with whoever owns partner data at your end.

Happy to share a short deck or jump on a quick call at your convenience.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
dentago.co.uk
`;

const HTML = `<p>Hi Dental Sky team,</p>

<p>I'm Mercier, founder of <strong><a href="https://dentago.co.uk">Dentago</a></strong>. We run a free UK dental procurement platform: practices search once, see suppliers side-by-side with pricing/stock, and check out across baskets in one flow.</p>

<p>Dental Sky is already an important supplier on the platform. We're reaching out on the commercial side to discuss:</p>

<ul>
  <li>A structured catalogue link-up (CSV, API, or whichever format you prefer) so your range, prices, and availability stay accurate for our mutual customers</li>
  <li>Any commercial or integration contact you use for marketplace or aggregation partners — if this inbox isn't the right place, a pointer would be appreciated</li>
</ul>

<p>I've also been in touch with Joe separately; either way, we'd like to make sure we're aligned with whoever owns partner data at your end.</p>

<p>Happy to share a short deck or jump on a quick call at your convenience.</p>

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
