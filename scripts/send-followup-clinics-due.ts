/**
 * Send Follow-Up 1 to outreach batches configured as "due" (default: Batches 8–12 + Companies House).
 * Dedupes: skips emails that already have a *-FU1 template in dentago-sent-all.json.
 *
 * Run:  npx tsx scripts/send-followup-clinics-due.ts
 * Dry:  npx tsx scripts/send-followup-clinics-due.ts --dry-run
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
const FROM = "mercier@dentago.co.uk";
const FROM_DISPLAY = "Mercier @ Dentago";
const LOG_PATH = path.join(process.env.HOME ?? "", "Downloads", "dentago-sent-all.json");

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Initial outreach batches eligible for Clinic FU1 (after first touch) */
const DEFAULT_NUM_BATCHES = [8, 9, 10, 11, 12] as const;
const CH_BATCH = "companies-house-scrape";

type SentRow = {
  name?: string;
  email: string;
  practice?: string;
  status?: string;
  batch: number | string;
  template?: string;
  sentAt?: string;
};

function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const local = email.split("@")[0] ?? "";
  const domain = email.split("@")[1] ?? "";
  if (!domain.includes(".") && domain !== "nhs.net" && domain !== "nhs.uk") return false;
  if (/\.(webp|png|jpg|gif|svg)$/i.test(domain)) return false;
  if (email.includes("..") || local.startsWith(".")) return false;
  return true;
}

function firstName(full: string | undefined): string {
  if (!full || full.toLowerCase() === "there") return "there";
  return full.trim().split(/\s+/)[0] ?? "there";
}

function buildFuClinics(name: string): { subject: string; html: string } {
  const n = firstName(name);
  const greet = n === "there" ? "there" : n;
  return {
    subject: greet === "there" ? "Quick follow-up — Dentago for your practice" : `${greet}, still worth 2 minutes?`,
    html: `
<p>Hi ${greet},</p>

<p>Dropping you a quick follow-up on <strong>Dentago</strong> — the free tool that lets UK dental practices search all their suppliers in one place and compare prices instantly.</p>

<p>Since I last emailed, we've expanded live catalogues further (including major UK suppliers). Most practices find they're overpaying on at least a few lines once they compare side-by-side.</p>

<p>Takes a few minutes to connect your existing supplier accounts. Zero cost to the practice.</p>

<p>If it's useful, WhatsApp me on <strong>+447466 607116</strong> and I'll get you sorted.</p>

<p>Best,<br/>
Mercier<br/>
Founder, Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim(),
  };
}

function buildFuCompaniesHouse(practice: string): { subject: string; html: string } {
  const sub = practice ? `Re: Quick question for ${practice}` : "Re: Quick question";
  return {
    subject: sub,
    html: `<p>Hi there,</p>
<p>Just wanted to follow up on my last email.</p>
<p>We've had a lot of dental practices join Dentago this week — it lets you search all your suppliers in one place, compare prices, and place one order instead of logging into 4–5 separate sites.</p>
<p>It's completely free for practices and takes 5 minutes to set up. We connect your existing supplier accounts so you get your negotiated prices.</p>
<p>If it's of interest, drop me a message on WhatsApp — <strong>+447466 607116</strong> — and I'll get you sorted straight away.</p>
<p>Mercier<br/>Founder @ Dentago<br/><a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>`,
  };
}

function templateFu1(batch: number | string): string {
  if (batch === CH_BATCH) return "CompaniesHouse-FU1";
  return `Batch${batch}-FU1`;
}

function loadTargets(): { row: SentRow; fuTemplate: string }[] {
  if (!fs.existsSync(LOG_PATH)) throw new Error(`Missing ${LOG_PATH}`);

  const data = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as { sent: SentRow[] };
  const sent = data.sent ?? [];

  const alreadyFu = new Set(
    sent
      .filter((s) => String(s.template ?? "").endsWith("-FU1"))
      .map((s) => s.email.toLowerCase())
  );

  const wantBatches = new Set<number | string>([...DEFAULT_NUM_BATCHES, CH_BATCH]);

  const out: { row: SentRow; fuTemplate: string }[] = [];
  for (const row of sent) {
    if (!wantBatches.has(row.batch)) continue;
    if (row.status && row.status !== "Sent") continue;
    const em = row.email?.toLowerCase().trim();
    if (!em || !isValidEmail(em) || alreadyFu.has(em)) continue;
    out.push({ row, fuTemplate: templateFu1(row.batch) });
  }

  return out;
}

async function main() {
  if (!DRY_RUN && !process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing in .env.local / .env");
    process.exit(1);
  }

  const targets = loadTargets();
  console.log(`\n📤 Follow-Up 1 — ${targets.length} clinics (batches ${[...DEFAULT_NUM_BATCHES].join(", ")} + CH)\n`);

  if (targets.length === 0) {
    console.log("Nothing to send (already FU1 or no rows).");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY ?? "re_dry_run");

  let ok = 0;
  let fail = 0;
  const newLogRows: SentRow[] = [];

  for (let i = 0; i < targets.length; i++) {
    const { row, fuTemplate } = targets[i];
    const isCh = row.batch === CH_BATCH;
    const { subject, html } = isCh
      ? buildFuCompaniesHouse(row.practice || row.name || "")
      : buildFuClinics(row.name ?? "");

    if (DRY_RUN) {
      if (i < 3) console.log(`[dry] ${row.email} | ${subject.slice(0, 50)}...`);
      ok++;
      continue;
    }

    try {
      const { error } = await resend.emails.send({
        from: `${FROM_DISPLAY} <${FROM}>`,
        to: row.email,
        subject,
        html,
        replyTo: FROM,
        headers: {
          "List-Unsubscribe": `<mailto:${FROM}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      ok++;
      newLogRows.push({
        name: row.name,
        email: row.email,
        practice: row.practice,
        batch: row.batch,
        template: fuTemplate,
        status: "Sent",
        sentAt: new Date().toISOString(),
      });
      if (ok % 25 === 0 || ok <= 5) {
        console.log(`✅ [${ok}/${targets.length}] ${row.email}`);
      }
    } catch (e: unknown) {
      fail++;
      console.error(`❌ ${row.email}:`, e);
    }

    await delay(200);
  }

  if (!DRY_RUN && newLogRows.length > 0) {
    const data = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as { sent: SentRow[] };
    data.sent = [...(data.sent ?? []), ...newLogRows];
    fs.writeFileSync(LOG_PATH, JSON.stringify(data, null, 2));
    console.log(`\n📝 Appended ${newLogRows.length} rows to dentago-sent-all.json`);
  }

  console.log(`\n=== Done ===\nSent: ${ok}\nFailed: ${fail}${DRY_RUN ? "\n(dry-run — no emails sent, log unchanged)" : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
