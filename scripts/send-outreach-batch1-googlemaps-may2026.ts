/**
 * Google Maps outreach — CSV or contact-details JSON — demo-watch template (vault-aligned).
 * Dedupes by email inside the file. Skips only addresses logged with sentAt in the last 20 minutes.
 *
 * CSV:
 *   npx tsx scripts/send-outreach-batch1-googlemaps-may2026.ts --csv="..." --batch=2
 *
 * JSON (array with title + emails[] — vets / non-dental titles excluded):
 *   npx tsx scripts/send-outreach-batch1-googlemaps-may2026.ts --json="..." --batch=4 --summary-day=2026-05-01
 *
 * Optional: --template=..., --summary-day=YYYY-MM-DD (writes ~/Downloads/outreach-summary-{day}.json)
 */
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";
const DOWNLOADS = path.join(process.env.HOME ?? "", "Downloads");

const DEFAULT_CSV = path.join(
  DOWNLOADS,
  "dataset_google-maps-email-leads-fast-scraper_2026-05-01_17-13-57-336 (1).csv"
);

const LOG_PATH = path.join(DOWNLOADS, "dentago-sent-all.json");

/** Same inbox twice in one sitting only — historical batches / order emails may contact again later. */
const SEND_COOLDOWN_MS = 20 * 60 * 1000;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Match googlemaps-new.ts — dental clinics only when parsing noisy JSON exports */
const DENTAL_TITLE_RE =
  /(dental|dentist|orthodont|\bdmd\b|teeth|smile|oral surgery|implant|periodont|perio\b|endo\b|ortho\b|braces?)/i;

const EXCLUDE_TITLE_RE =
  /(accountant|accountancy|bookkeeping|marketing|seo\b|web design|consultancy|software|supplier|wholesale|training course|recruitment)/i;

const VET_TITLE_RE = /veterinar|veterinary|\bvets?\b/i;

interface JsonPlaceRow {
  title?: string;
  emails?: unknown;
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

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const firstLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCSVLine(firstLine);
  const rows: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    const vals = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h.replace(/^\uFEFF/, "").trim()] = (vals[i] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function isValidEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  if (!e || !e.includes("@")) return false;
  const domain = e.split("@")[1] ?? "";
  if (!domain.includes(".") && !/^(nhs\.net|nhs\.uk)$/i.test(domain))
    return false;
  if (!/\.[a-z]{2,}$/i.test(domain)) return false;
  if (e.startsWith("//") || e.includes("..")) return false;
  if (/\.(webp|png|jpg|gif|svg)$/i.test(domain)) return false;
  const junk = [
    "example.com",
    "test@",
    "noreply",
    "sentry",
    "schema.org",
    "w3.org",
    "nhswebsite.servicedesk",
  ];
  if (junk.some((j) => e.includes(j))) return false;
  if (e.endsWith("@webform.boxly.ai")) return false;
  return true;
}

/** Emails we already hit within SEND_COOLDOWN_MS (from log sentAt). */
function loadEmailsInCooldown(): Set<string> {
  if (!fs.existsSync(LOG_PATH)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as {
      sent?: { email?: string; sentAt?: string }[];
    };
    const cutoff = Date.now() - SEND_COOLDOWN_MS;
    const recent = new Set<string>();
    for (const entry of data.sent ?? []) {
      const email = String(entry.email ?? "").toLowerCase().trim();
      if (!email) continue;
      const sentAt = entry.sentAt ? Date.parse(entry.sentAt) : NaN;
      if (Number.isNaN(sentAt)) continue;
      if (sentAt >= cutoff) recent.add(email);
    }
    return recent;
  } catch {
    return new Set();
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shorten practice name for subject line (mobile inbox). */
function truncateSubjectPractice(name: string, max = 42): string {
  const n = name.trim();
  if (n.length <= max) return n;
  return n.slice(0, max - 1).trimEnd() + "…";
}

/** Scraped Maps CSV rarely has a real first name — default to "there". Only exception: initials.localpart e.g. a.kaczmarski@nhs.net → "Kaczmarski". */
function greetingFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").split("+")[0] ?? "";
  const m = local.match(/^([a-z])\./i);
  if (m && /^[a-z][a-z._-]*$/i.test(local)) {
    const rest = local.slice(2);
    const surname = rest.replace(/[^a-z]/gi, "");
    if (surname.length >= 3)
      return surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
  }
  return "there";
}

interface Lead {
  email: string;
  greeting: string;
  practice: string;
}

function buildEmailHtml(greeting: string): string {
  const html = `
<p>Hi ${escapeHtml(greeting)},</p>

<p>Cold emails usually mean someone wants <strong>money from the practice</strong> — fair assumption — so I'll say this first: <strong>Dentago is free for dental practices.</strong> No subscription, no card, nothing invoiced by us on the clinic side.</p>

<p>I'm writing because what we hear from managers isn't a minor tweak to ordering; it's <strong>meaningful weekly time</strong> burned across separate supplier portals, carts that don't line up, confirmations scattered across inboxes, and the nagging doubt someone already ordered the same SKU — plus spend that's harder to oversee than it should be. That competes directly with patient-facing work and proper financial control — not because teams are behind, but because almost nobody built tooling for multi-supplier dental buying.</p>

<p>If that resonates, Dentago is UK-built for exactly that: <strong>one workflow</strong> to search and check out across distributors you already use, with <strong>practice verification</strong> before orders go through — how UK clinics actually buy, not a generic consumer checkout.</p>

<p><strong>~2 minute walkthrough</strong>, no signup:</p>

<p><a href="https://www.dentago.co.uk/watch">https://www.dentago.co.uk/watch</a></p>

<p>If it doesn't match how you run procurement, ignore me; if it does, from there you'll be able to book a demo. And if even that takes too much time, just reply &quot;Yes&quot; and we'll get you onboarded via email.</p>

<p>Mercier<br/>
Founder, Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
<img src="https://www.dentago.co.uk/api/track/open?e=${encodeURIComponent(email)}&b=gm2026" width="1" height="1" style="display:none" />
`.trim();

  return html;
}

function parseArgs(): {
  dry: boolean;
  csvPath: string;
  jsonPath: string | null;
  batch: number;
  template: string;
  summaryDay: string;
} {
  let dry = false;
  let csvPath = DEFAULT_CSV;
  let jsonPath: string | null = null;
  let batch = 1;
  let templateOverride: string | null = null;
  let summaryDay = new Date().toISOString().slice(0, 10);
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") dry = true;
    else if (a.startsWith("--csv="))
      csvPath = a.slice("--csv=".length).replace(/^["']|["']$/g, "");
    else if (a.startsWith("--json="))
      jsonPath = a.slice("--json=".length).replace(/^["']|["']$/g, "");
    else if (a.startsWith("--batch=")) {
      const n = parseInt(a.split("=")[1], 10);
      if (!Number.isNaN(n) && n >= 1) batch = n;
    } else if (a.startsWith("--template="))
      templateOverride = a.slice("--template=".length).replace(/^["']|["']$/g, "");
    else if (a.startsWith("--summary-day="))
      summaryDay = a.slice("--summary-day=".length).replace(/^["']|["']$/g, "").slice(0, 10);
  }
  const template =
    templateOverride ??
    (jsonPath
      ? `Batch${batch}-GMapsContactDetailsJSON-2026-05-01`
      : `Batch${batch}-GoogleMaps-DemoWatch-2026-05-01`);
  return { dry, csvPath, jsonPath, batch, template, summaryDay };
}

function collectLeads(csvPath: string, cooldownEmails: Set<string>): Lead[] {
  const rows = parseCSV(csvPath);
  const seen = new Set<string>();
  const leads: Lead[] = [];

  for (const row of rows) {
    const practice = row.name?.trim() ?? "";
    const email = (row.email ?? "").trim().toLowerCase();
    if (!practice || !isValidEmail(email)) continue;
    if (cooldownEmails.has(email) || seen.has(email)) continue;
    seen.add(email);
    leads.push({
      email,
      greeting: greetingFromEmail(email),
      practice,
    });
  }
  return leads;
}

function collectLeadsFromJson(
  jsonPath: string,
  cooldownEmails: Set<string>
): Lead[] {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as JsonPlaceRow[];
  if (!Array.isArray(raw)) {
    throw new Error("JSON root must be an array");
  }
  const seen = new Set<string>();
  const leads: Lead[] = [];

  for (const row of raw) {
    const practice = String(row.title ?? "").trim();
    if (
      !practice ||
      VET_TITLE_RE.test(practice) ||
      EXCLUDE_TITLE_RE.test(practice) ||
      !DENTAL_TITLE_RE.test(practice)
    )
      continue;

    const emails = Array.isArray(row.emails) ? row.emails : [];
    let picked = "";
    for (const em of emails) {
      const email = String(em ?? "").trim().toLowerCase();
      if (!isValidEmail(email)) continue;
      picked = email;
      break;
    }
    if (!picked) continue;
    if (cooldownEmails.has(picked) || seen.has(picked)) continue;
    seen.add(picked);
    leads.push({
      email: picked,
      greeting: greetingFromEmail(picked),
      practice,
    });
  }
  return leads;
}

function writeDaySummary(dayPrefix: string) {
  if (!fs.existsSync(LOG_PATH)) return;
  try {
    const data = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as {
      sent?: Record<string, unknown>[];
    };
    const sent = data.sent ?? [];
    const daySends = sent.filter(
      (s) =>
        typeof s.sentAt === "string" &&
        (s.sentAt as string).startsWith(dayPrefix)
    );
    const byBatch: Record<string, number> = {};
    const byTemplate: Record<string, number> = {};
    for (const s of daySends) {
      const b = String(s.batch ?? "?");
      byBatch[b] = (byBatch[b] ?? 0) + 1;
      const t = String(s.template ?? "?");
      byTemplate[t] = (byTemplate[t] ?? 0) + 1;
    }
    const out = {
      generatedAt: new Date().toISOString(),
      dayUtcPrefix: dayPrefix,
      totalEmailsSentOnDay: daySends.length,
      byBatch,
      byTemplate,
      sends: daySends,
    };
    const outPath = path.join(DOWNLOADS, `outreach-summary-${dayPrefix}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log(
      `\n📊 Day summary: ${outPath} (${daySends.length} sends with sentAt starting ${dayPrefix})`
    );
  } catch (e) {
    console.warn("Could not write day summary:", e);
  }
}

async function main() {
  const { dry, csvPath, jsonPath, batch, template, summaryDay } = parseArgs();

  const sourceLabel = jsonPath ? "JSON" : "CSV";
  const sourcePath = jsonPath ?? csvPath;

  if (!fs.existsSync(sourcePath)) {
    console.error(`${sourceLabel} not found: ${sourcePath}`);
    process.exit(1);
  }

  if (!dry && !process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing in .env.local / .env");
    process.exit(1);
  }

  const cooldownEmails = loadEmailsInCooldown();
  const leads = jsonPath
    ? collectLeadsFromJson(jsonPath, cooldownEmails)
    : collectLeads(csvPath, cooldownEmails);

  console.log(`\n📧 Batch ${batch} — Google Maps ${sourceLabel} demo outreach`);
  console.log(`   Source: ${sourcePath}`);
  console.log(`   Template: ${template}`);
  console.log(
    `   Cooldown skips (sent in last ${SEND_COOLDOWN_MS / 60000} min): ${cooldownEmails.size}`
  );
  console.log(`   Recipients this run: ${leads.length}\n`);

  if (leads.length === 0) {
    console.log(
      "Nothing to send (empty file, filtered out, invalid emails, duplicate emails in file, or every address was mailed in the cooldown window)."
    );
    writeDaySummary(summaryDay);
    return;
  }

  if (dry) {
    leads.forEach((l, i) =>
      console.log(`${i + 1}. ${l.practice.slice(0, 55)} → ${l.email} (Hi ${l.greeting})`)
    );
    console.log("\nDRY RUN — no emails sent.");
    writeDaySummary(summaryDay);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const logged: Lead[] = [];
  let failed = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const practiceShort = truncateSubjectPractice(lead.practice);
    const html = buildEmailHtml(lead.greeting);
    const subject = `${practiceShort} — ordering week still = five tabs?`;

    try {
      const { error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: lead.email,
        subject,
        html,
        replyTo: FROM,
        headers: {
          "List-Unsubscribe": `<mailto:${FROM}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      logged.push(lead);
      console.log(
        `✅ [${logged.length}/${leads.length}] ${practiceShort.slice(0, 38)} → ${lead.email}`
      );
    } catch (e) {
      failed++;
      console.error(`❌ ${lead.email}:`, e);
    }
    await delay(220);
  }

  const existing = fs.existsSync(LOG_PATH)
    ? (JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as {
        sent: Record<string, unknown>[];
      })
    : { sent: [] };
  existing.sent = existing.sent ?? [];
  const ts = new Date().toISOString();
  for (const l of logged) {
    existing.sent.push({
      name: l.greeting,
      email: l.email,
      practice: l.practice,
      status: "Sent",
      batch,
      template,
      sentAt: ts,
      sourceCsv: path.basename(sourcePath),
    });
  }
  fs.writeFileSync(LOG_PATH, JSON.stringify(existing, null, 2));

  console.log(`\n💾 Logged ${logged.length} sends (failed: ${failed})`);
  console.log(`   Total on record: ${existing.sent.length}`);
  writeDaySummary(summaryDay);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
