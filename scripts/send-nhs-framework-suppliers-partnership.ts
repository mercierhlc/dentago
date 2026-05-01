/**
 * NHS Supply Chain Dental Technologies framework — partnership outreach batch.
 *
 * Run:   npx tsx scripts/send-nhs-framework-suppliers-partnership.ts
 * Dry:   npx tsx scripts/send-nhs-framework-suppliers-partnership.ts --dry-run
 *
 * Loads RESEND_API_KEY from .env.local / .env (never hardcode keys).
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
const REPLY_TO = "mercier@dentago.co.uk";
const WHATSAPP = "+44 7466 607116";
const SITE_URL = "https://dentago.co.uk";
const SITE_PLAIN = "dentago.co.uk";

const SUBJECT = "Incremental practice orders — Dentago (catalogue connection)";

type Row = { greeting: string; to: string; note?: string };

/** One row per send; duplicate `to` addresses merged manually below. */
const RECIPIENTS: Row[] = [
  { greeting: "Dental Sky team", to: "sales@dentalsky.com" },
  { greeting: "AG Dental Equipment team", to: "enquiries@agdental.co.uk" },
  { greeting: "Hulbert Imaging / Alterior team", to: "sales.uk@medraygroup.com" },
  { greeting: "Anglian Dental team", to: "info@angliandental.co.uk" },
  { greeting: "BDSI team", to: "sales@bdsi-ltd.co.uk" },
  { greeting: "Clark Dental team", to: "info@clarkdental.co.uk" },
  { greeting: "DB Dental Equipment team", to: "sales@dbdental.co.uk" },
  { greeting: "DB Orthodontics team", to: "sales@dbortho.com" },
  { greeting: "DD team", to: "sales@ddgroup.com" },
  { greeting: "DMI team", to: "info@dmi.co.uk" },
  {
    greeting: "Dentsply Sirona UK team",
    to: "customerserviceuk@dentsplysirona.com",
    note: "Covers NHS framework entries Dentsply IH Ltd & Sirona Dental Systems",
  },
  { greeting: "Eclipse Dental team", to: "enquiries@eclipse-dental.com" },
  {
    greeting: "FUJIFILM Healthcare UK team",
    to: "medicalsales_uk@fujifilm.com",
  },
  { greeting: "KaVo Dental UK team", to: "info@kavo.co.uk" },
  { greeting: "McKillop Dental team", to: "enquiries@mckillopdental.co.uk" },
  {
    greeting: "Oral Care Innovations team",
    to: "sales@oralcareinnovations.co.uk",
  },
  { greeting: "Probo Medical UK team", to: "sales@probomedical.co.uk" },
  { greeting: "RIS Products team", to: "sales@risproducts.co.uk" },
  { greeting: "RPA Dental Equipment team", to: "info@rpadental.net" },
  {
    greeting: "Accrington Surgical team",
    to: "info@accringtonsurgical.co.uk",
    note: "Listed on NHS supplier matrix as Surgical Instruments — confirm legal entity.",
  },
  { greeting: "Swift Dental Laboratories team", to: "info@swiftdental.co.uk" },
  {
    greeting: "The Dental Imaging Company team",
    to: "info@thedentalimagingcompany.co.uk",
  },
  { greeting: "The Orthodontic Company team", to: "info@tocdental.com" },
  { greeting: "Vernacare team", to: "info@vernacare.com" },
  {
    greeting: "Wolverson X-Ray team",
    to: "sales@wolversonx-ray.co.uk",
  },
  {
    greeting: "Wrights / Wright Health Group team",
    to: "info@wright-cottrell.co.uk",
  },
  { greeting: "Xograph Healthcare team", to: "sales@xograph.com" },
];

function buildBodies(greeting: string) {
  const text = `Hi ${greeting},

I'm Mercier, founder of Dentago. We're building the neutral procurement layer UK practices use to search, compare, and checkout dental supplies and equipment in one place — without replacing their existing supplier relationships or pricing model. We're not intermediating the account; we're eliminating the tab-juggling that happens right before they order.

What that means for you: we put purchase-ready practices in front of your catalogue at the moment they're building a basket. That's effectively incremental GMV without funding another marketing programme — no blast campaigns, no paid reach, no brand-awareness spend to manufacture intent. The intent is already there; we concentrate it.

To turn that traffic into reliable wins for you (not noisy estimates), we need a simple catalogue feed / connection so your SKUs and prices show cleanly when practices compare — otherwise they guess, and guesses don't convert.

If you own commercial partnerships or digital trading, reply "send details" and I'll follow up with exactly what we need on your side (we're built to start lightweight).

WhatsApp: ${WHATSAPP}

Mercier
Dentago — ${SITE_PLAIN}
mercier@dentago.co.uk`;

  const html = `<p>Hi ${greeting},</p>

<p>I'm Mercier, founder of <strong>Dentago</strong>. We're building the neutral procurement layer UK practices use to <strong>search, compare, and checkout</strong> dental supplies and equipment in one place — without replacing their existing supplier relationships or pricing model. We're not intermediating the account; we're eliminating the <strong>tab-juggling</strong> that happens right before they order.</p>

<p><strong>What that means for you:</strong> we put <strong>purchase-ready practices</strong> in front of your catalogue at the moment they're building a basket. That's effectively <strong>incremental GMV</strong> without funding another marketing programme — no blast campaigns, no paid reach, no brand-awareness spend to manufacture intent. The intent is already there; we concentrate it.</p>

<p>To turn that traffic into <strong>reliable wins for you</strong> (not noisy estimates), we need a simple <strong>catalogue feed / connection</strong> so your SKUs and prices show cleanly when practices compare — otherwise they guess, and guesses don't convert.</p>

<p>If you own <strong>commercial partnerships or digital trading</strong>, reply <strong>"send details"</strong> and I'll follow up with exactly what we need on your side (we're built to start lightweight).</p>

<p>WhatsApp: <strong><a href="https://wa.me/447466607116">${WHATSAPP}</a></strong></p>

<p>Mercier<br>
<strong>Dentago</strong> — <a href="${SITE_URL}">${SITE_PLAIN}</a><br>
<a href="mailto:mercier@dentago.co.uk">mercier@dentago.co.uk</a></p>`;

  return { text, html };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!DRY_RUN && !process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing from .env.local or .env");
    process.exit(1);
  }

  const seen = new Set<string>();
  const deduped: Row[] = [];
  for (const r of RECIPIENTS) {
    const k = r.to.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }

  console.log(
    `${DRY_RUN ? "DRY RUN — " : ""}Sending to ${deduped.length} addresses:\n`,
  );
  for (const r of deduped) {
    console.log(`  • ${r.to} (${r.greeting})${r.note ? ` — ${r.note}` : ""}`);
  }

  if (DRY_RUN) {
    console.log("\nNo emails sent (--dry-run).");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < deduped.length; i++) {
    const r = deduped[i];
    const { text, html } = buildBodies(r.greeting);
    try {
      const result = await resend.emails.send({
        from: FROM,
        to: r.to,
        replyTo: REPLY_TO,
        subject: SUBJECT,
        text,
        html,
      });
      if ((result as { error?: unknown }).error) {
        console.error(`❌ ${r.to}`, (result as { error: unknown }).error);
        fail++;
      } else {
        const id = (result as { data?: { id?: string } }).data?.id;
        console.log(`✅ [${i + 1}/${deduped.length}] ${r.to}  id=${id}`);
        ok++;
      }
    } catch (e) {
      console.error(`❌ ${r.to}`, e);
      fail++;
    }
    await delay(550);
  }

  console.log(`\nDone: ${ok} sent, ${fail} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
