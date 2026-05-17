/**
 * Clinic outreach — Wahab S., Owner/Practice Principal, Museum Dental Suites
 * Run:  npx tsx scripts/send-wahab-museum-dental.ts
 * Dry:  npx tsx scripts/send-wahab-museum-dental.ts --dry-run
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
const TO = "wahab@museumdentalsuites.co.uk";
const REPLY_TO = "mercier@dentago.co.uk";
const SUBJECT = "Cutting your supply costs without switching suppliers — Dentago";

const TEXT = `Hi Wahab,

I'm Mercier, founder of Dentago — a free procurement platform built specifically for UK dental practices.

The idea is simple: instead of going to Henry Schein, Kent Express, Dental Sky, and everyone else separately, you search once on Dentago and see all of them side-by-side with live pricing. You order from multiple suppliers in one cart. No accounts to juggle, no separate invoices to chase.

Most practice owners who run the comparison for the first time find they've been overpaying on at least a handful of high-volume lines — gloves, masks, composites, endo — just because switching felt like effort. Dentago makes the comparison instant and the switch frictionless.

It's completely free for practices. We earn a small commission from suppliers when an order completes — so there's no cost to Museum Dental Suites and no commitment required.

If you want to see what your current basket looks like against the full market, you can search at dentago.co.uk right now — or I'm happy to walk you through it on a quick call.

Best,
Mercier
Founder, Dentago
mercier@dentago.co.uk
+447466 607116
dentago.co.uk`;

const HTML = `<p>Hi Wahab,</p>

<p>I'm Mercier, founder of <strong>Dentago</strong> — a free procurement platform built specifically for UK dental practices.</p>

<p>The idea is simple: instead of going to Henry Schein, Kent Express, Dental Sky, and everyone else separately, you search once on Dentago and see all of them side-by-side with live pricing. You order from multiple suppliers in one cart. No accounts to juggle, no separate invoices to chase.</p>

<p>Most practice owners who run the comparison for the first time find they've been overpaying on at least a handful of high-volume lines — gloves, masks, composites, endo — just because switching felt like effort. Dentago makes the comparison instant and the switch frictionless.</p>

<p>It's completely free for practices. We earn a small commission from suppliers when an order completes — so there's no cost to Museum Dental Suites and no commitment required.</p>

<p>If you want to see what your current basket looks like against the full market, you can search at <a href="https://dentago.co.uk">dentago.co.uk</a> right now — or I'm happy to walk you through it on a quick call.</p>

<p>Best,<br>
Mercier<br>
Founder, Dentago<br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a> · +447466 607116 · <a href="https://dentago.co.uk">dentago.co.uk</a></p>`;

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing");
    process.exit(1);
  }

  console.log(`To:      ${TO}`);
  console.log(`Subject: ${SUBJECT}`);

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
    console.error("[FAILED]", (result as any).error);
    process.exit(1);
  }
  console.log(`[SENT] id: ${(result as any).data?.id}`);
}

main().catch(err => { console.error(err); process.exit(1); });
