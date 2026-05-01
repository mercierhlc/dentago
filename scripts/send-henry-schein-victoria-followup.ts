/**
 * Follow-up to Victoria Goodall (MD, Henry Schein UK & Ireland).
 *
 * Original outreach: 26 Apr 2026 via scripts/send-supplier-outreach.ts
 *   Subject: "Partnership opportunity — Dentago"
 *
 * This is nudge #1 (Day 3). Same From, "Re:" subject so Gmail threads it.
 * Work email only — no personal addresses.
 *
 * Run:  npx tsx scripts/send-henry-schein-victoria-followup.ts
 * Dry:  npx tsx scripts/send-henry-schein-victoria-followup.ts --dry-run
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

const FROM = "Mercier @ Dentago <mercier@dentago.co.uk>";
const TO = "victoria.goodall@henryschein.co.uk";
const REPLY_TO = "mercier@dentago.co.uk";

// "Re:" prefix + identical original subject so Gmail threads under the 26 Apr msg.
const SUBJECT = "Re: Partnership opportunity — Dentago";

const TEXT = `Hi Victoria,

Following up on the note I sent on Saturday. Quick update on what's happened since:

We've now indexed the full public catalogues of Dental Sky, DHB, and a couple of the smaller UK suppliers — comparison search is live across them. Henry Schein products are the obvious gap. Clinics on Dentago will see your competitors but not you, and that's the wrong outcome for both of us.

The way it works for Henry Schein doesn't require anything from your side: clinics use their own existing Henry Schein logins to surface their negotiated pricing inside Dentago. No API integration, no commercial commitment, no exclusivity, no change to their account or pricing relationship. Whatever they get from you today, they keep. We're just the comparison and ordering layer on top.

15 minutes this week or next to talk it through? Even if it ends with "no thanks," I'd rather you know what's being built than find out from a customer.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+44 7466 607116
`;

const HTML = `<p>Hi Victoria,</p>

<p>Following up on the note I sent on Saturday. Quick update on what's happened since:</p>

<p>We've now indexed the full public catalogues of <strong>Dental Sky, DHB</strong>, and a couple of the smaller UK suppliers — comparison search is live across them. Henry Schein products are the obvious gap. Clinics on Dentago will see your competitors but not you, and that's the wrong outcome for both of us.</p>

<p>The way it works for Henry Schein doesn't require anything from your side: clinics use their own existing Henry Schein logins to surface their negotiated pricing inside Dentago. <strong>No API integration, no commercial commitment, no exclusivity, no change to their account or pricing relationship.</strong> Whatever they get from you today, they keep. We're just the comparison and ordering layer on top.</p>

<p>15 minutes this week or next to talk it through? Even if it ends with "no thanks," I'd rather you know what's being built than find out from a customer.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +44 7466 607116</p>`;

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing");
    process.exit(1);
  }

  console.log(`From:    ${FROM}`);
  console.log(`To:      ${TO}`);
  console.log(`Subject: ${SUBJECT}`);
  console.log(`---\n${TEXT.slice(0, 400)}...\n---`);

  if (DRY_RUN) {
    console.log("\nDRY RUN — not sending.");
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

  if ((result as any).error) {
    console.error("\n[FAILED]", (result as any).error);
    process.exit(1);
  }
  console.log(`\n[SENT]  Resend message id: ${(result as any).data?.id}`);
}

main().catch(err => { console.error(err); process.exit(1); });
