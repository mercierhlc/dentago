/**
 * Follow-up to Joe Earl (Dental Sky) after initial partnership outreach.
 *
 * Run:  npx tsx scripts/send-dental-sky-joe-followup.ts
 * Dry:  npx tsx scripts/send-dental-sky-joe-followup.ts --dry-run
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
const TO = "joe.earl@dentalsky.com";
const CC = "joe.earl9@googlemail.com";
const REPLY_TO = "mercier@dentago.co.uk";

const SUBJECT = "Re: Dentago — quick follow-up on catalogue partnership";

const TEXT = `Hi Joe,

Following up on my note about Dentago — the UK dental procurement marketplace where practices compare live catalogues side-by-side.

If timing wasn't right before, no problem. I'm still keen for 15 minutes whenever suits you: I can show exactly how Dental Sky ranks on our comparisons today and what a proper data feed (CSV/API) would change for accuracy versus scraped catalogue pages.

If someone else on your side handles commercial partnerships or supplier integrations, feel free to loop them in — happy to adapt.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
dentago.co.uk
`;

const HTML = `<p>Hi Joe,</p>

<p>Following up on my note about <strong>Dentago</strong> — the UK dental procurement marketplace where practices compare live catalogues side-by-side.</p>

<p>If timing wasn't right before, no problem. I'm still keen for <strong>15 minutes</strong> whenever suits you: I can show exactly how Dental Sky ranks on our comparisons today and what a proper data feed (CSV/API) would change for accuracy versus scraped catalogue pages.</p>

<p>If someone else on your side handles commercial partnerships or supplier integrations, feel free to loop them in — happy to adapt.</p>

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
  console.log(`---\n${TEXT}\n---`);

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
