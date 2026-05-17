/**
 * Follow-up after NHS framework mail + “send details” — EDI framing, proposes Friday slot.
 *
 * Run:  npx tsx scripts/send-accrington-edi-followup.ts
 * Dry:  npx tsx scripts/send-accrington-edi-followup.ts --dry-run
 */
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

const DRY_RUN = process.argv.includes("--dry-run");

const FROM = "Mercier <mercier@dentago.co.uk>";
const TO = "info@accringtonsurgical.co.uk";
const REPLY_TO = "mercier@dentago.co.uk";

/** Threads with NHS framework outreach batch where they replied send details */
const SUBJECT = "Re: Incremental practice orders — Dentago (catalogue connection)";

const TEXT = `Hi,

Thanks for coming back — as discussed, we'd want to ingest catalogue, pricing and stock via EDI where you already run it (standard, transport, trading partner refs, test vs prod), so there's a single clean handshake for your team rather than ad hoc spreadsheets.

For Accrington Surgical, the commercial angle is unchanged: we're additive — practices keep their existing accounts and negotiated pricing with you; we concentrate purchase intent at the comparison moment. Where your range spans many brands alongside consumables you'd prefer surfaced strongly (including lines such as Simply Dental alongside your broader surgical catalogue), we'd align on scope on the EDI feed so what's live matches what managers actually compare.

I'd like about 20 minutes to walk you through how your SKUs surface on Dentago and to hear how you prefer onboarding for EDI.

Would this Friday at 3pm UK work for a quick Teams / Google Meet? If not, just reply with a couple of times that suit you and I'll send an invite.

— Mercier
Founder, Dentago
mercier@dentago.co.uk
https://dentago.co.uk
`;

const HTML = `<p>Hi,</p>

<p>Thanks for coming back — as discussed, we'd want to ingest <strong>catalogue, pricing and stock</strong> via <strong>EDI</strong> where you already run it (standard, transport, trading partner refs, test vs prod), so there's a single clean handshake for your team rather than ad hoc spreadsheets.</p>

<p>For <strong>Accrington Surgical</strong>, the commercial angle is unchanged: we're <strong>additive</strong> — practices keep their existing accounts and negotiated pricing with you; we concentrate purchase intent at the comparison moment. Where your range spans many brands alongside consumables you'd prefer surfaced strongly (including lines such as <strong>Simply Dental</strong> alongside your broader surgical catalogue), we'd align on scope on the <strong>EDI</strong> feed so what's live matches what managers actually compare.</p>

<p>I'd like <strong>about 20 minutes</strong> to walk you through how your SKUs surface on Dentago and to hear how you prefer onboarding for <strong>EDI</strong>.</p>

<p><strong>Would this Friday at 3pm UK work</strong> for a quick Teams / Google Meet? If not, just reply with a couple of times that suit you and I'll send an invite.</p>

<p>— Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a><br>
<a href="https://dentago.co.uk">dentago.co.uk</a></p>`;

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

  const err = (result as { error?: unknown }).error;
  const data = (result as { data?: { id?: string } }).data;
  if (err) {
    console.error("\n[FAILED]", err);
    process.exit(1);
  }
  console.log(`\n[SENT]  Resend message id: ${data?.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
