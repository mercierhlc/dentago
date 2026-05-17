/**
 * One-off: personalised cold email from Hunter CSV (39 leads, May 2026).
 *
 *   npx tsx scripts/send-outreach-hunter-39-may2026.ts --dry-run
 *   npx tsx scripts/send-outreach-hunter-39-may2026.ts --send
 *
 * Default CSV: ~/Downloads/39-leads-2026-05-12.csv  (override with --csv=/path)
 *
 * One-off test to yourself:
 *   npx tsx scripts/send-outreach-hunter-39-may2026.ts --send --to=you@example.com
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

const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";
const CALENDLY = "https://calendly.com/rnsv/dentago-introduction";
const SITE = "https://www.dentago.co.uk/";
const TEMPLATE = "Hunter-39-May2026-procurement-intro";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const argv = process.argv.slice(2);
  let dry = true;
  let csvPath = path.join(process.env.HOME ?? "", "Downloads", "39-leads-2026-05-12.csv");
  let testTo: string | null = null;
  for (const a of argv) {
    if (a === "--send") dry = false;
    if (a.startsWith("--csv=")) csvPath = a.slice("--csv=".length);
    if (a.startsWith("--to=")) testTo = a.slice("--to=".length).trim();
  }
  return { dry, csvPath, testTo };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

type Row = Record<string, string>;

function parseCSV(filePath: string): Row[] {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing CSV: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const firstLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCSVLine(firstLine);
  const result: Row[] = [];
  for (const line of lines.slice(1)) {
    const vals = parseCSVLine(line);
    if (vals.every((v) => !v.trim())) continue;
    const row: Row = {};
    headers.forEach((h, i) => {
      row[h.replace(/^\uFEFF/, "").trim()] = (vals[i] ?? "").trim();
    });
    result.push(row);
  }
  return result;
}

function firstName(row: Row): string {
  const n = (row["First name"] || row["Full name"] || "there").trim();
  return n || "there";
}

/** One specific opening line — no fake blog posts; uses company, city, role. */
function openingParagraph(row: Row): string {
  const company = row["Company"] || "your practice";
  const job = (row["Job title"] || "").trim();
  const jobLower = job.toLowerCase();
  const city = (row["City"] || "").trim();
  const loc = city.length > 1 ? ` in ${city}` : "";

  if (/finance|cfo|financial controller/i.test(jobLower)) {
    return `I had a quick look at ${company}${loc} — with you as ${job}, you’ll know how hard it is to get one honest view of supplier spend when every order still starts in a different portal.`;
  }
  if (/clinical|dentist|bds|principal|implant|orthodont|managing partner|owner|ceo|chief executive|co-founder|founder/i.test(jobLower)) {
    return `I came across ${company}${loc} and your work as ${job} — between patient lists the team is still splitting procurement across multiple supplier sites, which is the work nobody has headspace for mid-week.`;
  }
  if (/operations|director of operations|practice manager|business director|m\s*&\s*a|commercial director|sales and operations/i.test(jobLower)) {
    return `I noticed ${company}${loc} and your ${job} remit — most groups we speak to are running clinical, reception, and “which supplier had the cheaper gloves?” in parallel, with no single basket.`;
  }
  if (/marketing|hr|human resources|recruitment|payroll|patient experience|reception|coordinator/i.test(jobLower)) {
    return `I spotted ${company}${loc} while mapping UK practices — as ${job}, you’ll see how often “can someone order X?” still means five logins and a WhatsApp thread before anything lands in a cart.`;
  }
  return `I came across ${company}${loc} and your role as ${job} — it lines up with what we hear from UK practices: too many supplier logins, pricing spread across portals, and nobody with time to chase the best net basket every week.`;
}

function painBridge(): string {
  return "That matches what we hear everywhere: too many supplier logins, pricing spread across portals, and nobody with time to chase the best net basket every week.";
}

function buildBody(row: Row): string {
  const name = firstName(row);
  const open = openingParagraph(row);
  const bridge = open.includes("too many supplier logins") ? "" : `\n\n${painBridge()}`;

  return `Hello ${name},

${open}${bridge}

I'm Mercier, founder of Dentago — we're building a free procurement layer for UK dental clinics: one search and cart across your real supplier accounts, with live prices from the accounts you already have, plus spend and savings visibility so the team isn't guessing in three portals.

We're not replacing your relationships, we're making them legible in one place.

For practices that place a first order through Dentago, we're offering £50 in free credits. If you take a short demo and it's not a fit, we'll still send a £50 Amazon gift card as a thank-you for your time.

I would love to find some time to show you a demo of what we're building — would sometime on Friday work? If it's easier, feel free to choose a time here: ${CALENDLY}

Many thanks,
Mercier
${SITE}`;
}

function subjectFor(row: Row): string {
  const company = row["Company"] || "your practice";
  return `Quick note on procurement at ${company}`;
}

function shouldSkip(row: Row): string | null {
  const email = (row["Email address"] || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return "no email";
  const v = (row["Verification status"] || "").toLowerCase().trim();
  if (v === "invalid") return "verification invalid";
  return null;
}

const LOG_PATH = path.join(process.env.HOME ?? "", "Downloads", "dentago-sent-hunter-39-may2026.json");

function loadSent(): Set<string> {
  if (!fs.existsSync(LOG_PATH)) return new Set();
  try {
    const j = JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) as { emails?: string[] };
    return new Set((j.emails ?? []).map((e) => e.toLowerCase()));
  } catch {
    return new Set();
  }
}

function appendSent(email: string) {
  const emails = loadSent();
  emails.add(email.toLowerCase());
  fs.writeFileSync(LOG_PATH, JSON.stringify({ emails: [...emails], updatedAt: new Date().toISOString() }, null, 2));
}

function syntheticTestRow(to: string): Row {
  return {
    "First name": "Mercier",
    Company: "Dentago",
    City: "London",
    "Job title": "Founder",
    "Email address": to,
    "Verification status": "valid",
  };
}

async function main() {
  const { dry, csvPath, testTo } = parseArgs();

  let rows: Row[];
  if (testTo) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
      console.error(`Invalid --to= address: ${testTo}`);
      process.exit(1);
    }
    rows = [syntheticTestRow(testTo)];
    console.log(`Single test send → ${testTo}`);
  } else {
    rows = parseCSV(csvPath);
    if (rows.length === 0) {
      console.error("No rows parsed.");
      process.exit(1);
    }
  }

  const already = loadSent();
  const toSend: Row[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const row of rows) {
    const email = (row["Email address"] || "").trim().toLowerCase();
    const skip = shouldSkip(row);
    if (skip) {
      skipped.push({ email: email || "(none)", reason: skip });
      continue;
    }
    if (already.has(email) && !testTo) {
      skipped.push({ email, reason: "already in send log" });
      continue;
    }
    toSend.push(row);
  }

  if (!testTo) console.log(`CSV: ${csvPath}`);
  console.log(`Rows: ${rows.length} | to send: ${toSend.length} | skipped: ${skipped.length}`);
  skipped.slice(0, 15).forEach((s) => console.log(`  skip ${s.email}: ${s.reason}`));
  if (skipped.length > 15) console.log(`  ... +${skipped.length - 15} more skips`);

  if (dry) {
    console.log("\n--- DRY RUN (first 3 bodies) ---\n");
    for (const row of toSend.slice(0, 3)) {
      console.log("SUBJECT:", subjectFor(row));
      console.log(buildBody(row));
      console.log("\n---\n");
    }
    console.log(`DRY RUN — would send ${toSend.length} emails. Run with --send to deliver.`);
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing — add to .env.local then re-run with --send");
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < toSend.length; i++) {
    const row = toSend[i];
    const email = row["Email address"].trim();
    const subject = subjectFor(row);
    const text = buildBody(row);

    try {
      const { error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: email,
        subject,
        text,
        replyTo: FROM,
        headers: {
          "List-Unsubscribe": `<mailto:${FROM}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      ok++;
      if (!testTo) appendSent(email);
      try {
        const { logEvent } = await import("../lib/events");
        await logEvent({
          event_type: "outreach_sent",
          entity_type: "lead",
          entity_id: email,
          payload: {
            template: TEMPLATE,
            company: row["Company"],
            first_name: row["First name"],
            subject,
            test_send: Boolean(testTo),
          },
          source: "scripts/send-outreach-hunter-39-may2026.ts",
        });
      } catch {
        /* OS log optional if Supabase env missing */
      }
      console.log(`[${ok}/${toSend.length}] ${email}`);
    } catch (e) {
      fail++;
      console.error(`FAIL ${email}:`, e);
    }
    if (i < toSend.length - 1) await delay(3500);
  }

  console.log(`\nDone. Sent: ${ok}, failed: ${fail}${testTo ? " (test send — not appended to hunter log)" : `, log: ${LOG_PATH}`}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
