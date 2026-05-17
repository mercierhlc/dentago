/**
 * YC Template outreach — merged leads + Hunter 39 leads (May 2026).
 *
 * Handles two CSV formats:
 *   - Merged Google Maps / Apollo format  (dentago-merged-leads-2026-05-12.csv)
 *   - Hunter format                       (39-leads-2026-05-12.csv)
 *
 * Usage:
 *   npx tsx scripts/send-outreach-yc-merged-2026-05-12.ts --dry-run
 *   npx tsx scripts/send-outreach-yc-merged-2026-05-12.ts --dry-run --csv=~/Downloads/39-leads-2026-05-12.csv
 *   npx tsx scripts/send-outreach-yc-merged-2026-05-12.ts --send
 *   npx tsx scripts/send-outreach-yc-merged-2026-05-12.ts --send --csv=~/Downloads/39-leads-2026-05-12.csv
 *   npx tsx scripts/send-outreach-yc-merged-2026-05-12.ts --send --to=you@example.com   (single test)
 */

import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── env ──────────────────────────────────────────────────────────────────────

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.resolve(__dirname, "..", ".env.local"));
loadEnv(path.resolve(__dirname, "..", ".env"));

// ── constants ─────────────────────────────────────────────────────────────────

const FROM      = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";
const CALENDLY  = "https://calendly.com/rnsv/dentago-introduction?month=2026-05";
const SITE      = "https://www.dentago.co.uk/";
const TEMPLATE  = "yc-template-2026-05-12";

const DOWNLOADS = path.join(os.homedir(), "Downloads");

const DEFAULT_CSV       = path.join(DOWNLOADS, "dentago-merged-leads-2026-05-12.csv");
const SENT_MAIN_LOG     = path.join(DOWNLOADS, "dentago-sent-all.json");
const SENT_HUNTER_LOG   = path.join(DOWNLOADS, "dentago-sent-hunter-39-may2026.json");
const SENT_YC_LOG       = path.join(DOWNLOADS, "dentago-sent-yc-merged-2026-05-12.json");

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── args ──────────────────────────────────────────────────────────────────────

function parseArgs() {
  const argv = process.argv.slice(2);
  let dry = true;
  let csvPath = DEFAULT_CSV;
  let testTo: string | null = null;
  let limit = Infinity;
  for (const a of argv) {
    if (a === "--send")            dry = false;
    if (a.startsWith("--csv="))    csvPath = a.slice(6).replace(/^~/, os.homedir());
    if (a.startsWith("--to="))     testTo = a.slice(5).trim();
    if (a.startsWith("--limit="))  limit = parseInt(a.slice(8), 10);
  }
  return { dry, csvPath, testTo, limit };
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

type Row = Record<string, string>;

function parseCSV(filePath: string): Row[] {
  if (!fs.existsSync(filePath)) { console.error(`Missing CSV: ${filePath}`); return []; }
  const content = fs.readFileSync(filePath, "utf-8");
  const lines   = content.split("\n").filter((l) => l.trim());
  const headers = parseCSVLine(lines[0].replace(/^\uFEFF/, ""));
  return lines.slice(1).map((line) => {
    const vals: string[] = parseCSVLine(line);
    if (vals.every((v) => !v.trim())) return null;
    const row: Row = {};
    headers.forEach((h, i) => { row[h.replace(/^\uFEFF/, "").trim()] = (vals[i] ?? "").trim(); });
    return row;
  }).filter(Boolean) as Row[];
}

// ── normalise rows from both CSV formats ──────────────────────────────────────

interface Lead {
  email:     string;
  firstName: string;
  company:   string;
  jobTitle:  string;
  city:      string;
  website:   string;
  extra:     Record<string, string>;   // parsed from extra_columns_json if present
}

function normaliseLead(row: Row): Lead | null {
  // Merged format uses snake_case; Hunter format uses "Title Case"
  const email =
    (row["email"] || row["Email address"] || row["Email"] || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;

  const firstName =
    (row["first_name"] || row["First name"] || row["Full name"]?.split(" ")[0] || "").trim();

  const company =
    (row["company_name"] || row["Company"] || "your practice").trim();

  const jobTitle =
    (row["job_title"] || row["Job title"] || "").trim();

  const rawCity = (row["city"] || row["City"] || "").trim().split(",")[0].trim();
  // UK postcodes (e.g. "W1G 6JD") are not useful as city labels — drop them
  const city = /^[A-Z]{1,2}\d[\d A-Z]?\s*\d[A-Z]{2}$/i.test(rawCity) ? "" : rawCity;

  const website =
    (row["website"] || row["Website"] || "").trim();

  let extra: Record<string, string> = {};
  try {
    if (row["extra_columns_json"]) extra = JSON.parse(row["extra_columns_json"]) as Record<string, string>;
  } catch { /* ignore */ }

  return { email, firstName, company, jobTitle, city, website, extra };
}

const UK_COUNTRY_VALUES = new Set([
  "", "united kingdom", "uk", "gb", "gbr", "england", "scotland", "wales", "northern ireland",
  "gb-eng", "gb-sct", "gb-wls", "gb-nir",
]);

function shouldSkip(row: Row): string | null {
  const email = (row["email"] || row["Email address"] || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return "no email";

  // Non-UK leads
  const country = (row["country"] || row["Company Country"] || "").trim().toLowerCase();
  if (!UK_COUNTRY_VALUES.has(country)) return `non-UK (${country || "unknown"})`;

  // Hunter verification field
  const v = (row["Verification status"] || "").toLowerCase().trim();
  if (v === "invalid") return "verification invalid";

  // Hunter confidence score
  const confidence = parseInt(row["Confidence score"] || "100", 10);
  if (!isNaN(confidence) && confidence < 70) return `low confidence (${confidence})`;

  return null;
}

// ── personalisation ───────────────────────────────────────────────────────────

function buildOpeningLine(lead: Lead): string {
  const { company, jobTitle, city, website, extra } = lead;
  const job   = jobTitle.toLowerCase();
  const loc   = city.length > 1 ? ` in ${city}` : "";
  const score = parseFloat(extra["review_score"] || "0");
  const ig    = (extra["instagram"] || "").trim();
  const fb    = (extra["facebook"] || "").trim();
  const desc  = (extra["companyDescription"] || "").trim();
  const size  = (extra["companySize"] || extra["Company size"] || "").trim();

  // High review score — lead with proof of quality
  if (score >= 4.7) {
    return `I noticed ${company}${loc} has a ${score}-star Google rating — a practice that takes patient experience that seriously almost always feels the procurement admin pain more acutely than most.`;
  }
  if (score >= 4.4) {
    return `I came across ${company}${loc} on Google — ${score} stars is solid and it's clear the team cares about doing things right, which is exactly why the procurement side tends to feel like a poor relation.`;
  }

  // Active social
  if (ig && ig.includes("instagram")) {
    return `I spotted ${company}'s Instagram${loc} — you clearly put real effort into patient communication, which makes it all the more frustrating when the procurement side is still spread across five portals.`;
  }
  if (fb && fb.includes("facebook")) {
    return `I came across ${company}${loc} online — the practice has a clear identity, which makes the procurement side feel even more disjointed by comparison.`;
  }

  // Company description from Apollo — only use if it reads like a UK practice
  const descClean = desc.replace(/\s+/g, " ");
  const descIsUsable = desc.length > 40 && !/serbia|germany|france|spain|usa|india|dubai|uae|canada|australia/i.test(descClean);
  if (descIsUsable) {
    const snippet = descClean.slice(0, 120).replace(/\s+\S*$/, "");
    return `I read about ${company}${loc} — "${snippet}…" — it lines up with what we hear everywhere: the patient side gets the attention, and procurement ends up split across too many portals.`;
  }

  // Large group
  const sizeNum = parseInt(size, 10);
  if (!isNaN(sizeNum) && sizeNum >= 51) {
    return `I came across ${company}${loc} — at your scale, the procurement chaos grows with every new site: more logins, more invoices, less visibility on where the best net basket actually is.`;
  }

  // Role-based fallbacks
  if (/finance|cfo|financial controller/i.test(job)) {
    return `I came across ${company}${loc} and your role as ${jobTitle} — with spend split across multiple supplier portals, getting one honest view of what the practice actually pays is harder than it should be.`;
  }
  if (/clinical|dentist|bds|principal|implant|orthodont|managing partner|owner|ceo|co-founder|founder/i.test(job)) {
    return `I came across ${company}${loc} and your work as ${jobTitle} — between patient lists the team is still splitting procurement across multiple supplier sites, which is the work nobody has headspace for mid-week.`;
  }
  if (/operations|director|practice manager|commercial/i.test(job)) {
    return `I noticed ${company}${loc} and your ${jobTitle} remit — most practices we speak to are running clinical, reception, and "which supplier had the cheaper gloves?" in parallel, with no single basket.`;
  }

  // Generic fallback
  return `I came across ${company}${loc} while mapping UK dental practices — it lines up with what we hear everywhere: too many supplier logins, pricing spread across portals, and nobody with time to chase the best net basket every week.`;
}

function buildEmail(lead: Lead): string {
  const name      = lead.firstName || "there";
  const company   = lead.company;
  const opening   = buildOpeningLine(lead);

  // Avoid repeating the pain line if it's already in the opening
  const painSuffix = opening.includes("too many supplier logins") ? "" :
    "\n\nThat matches what we hear everywhere: too many supplier logins, pricing spread across portals, and nobody with time to chase the best net basket every week.";

  return `Hello ${name},

${opening}${painSuffix}

I'm Mercier, founder of Dentago — we're building a FREE procurement layer for UK dental clinics: one search and cart across your real supplier accounts, with live prices from the accounts you already have, plus spend and savings visibility so the team isn't guessing in three portals.

We're not replacing your relationships, we're making them legible in one place.

For practices that place a first order through Dentago, we're offering £50 in free credits. If you take a short demo and it's not a fit, we'll still send a £50 Amazon gift card as a thank-you for your time.

I would love to find some time to show you a demo of what we're building? Would sometime on Friday work? If it's easier, feel free to choose a time here: ${CALENDLY}

Many thanks,
Mercier
${SITE}`;
}

function subjectFor(lead: Lead): string {
  return `Quick note on procurement at ${lead.company}`;
}

// ── dedup / send log ──────────────────────────────────────────────────────────

function loadSentSet(): Set<string> {
  const emails = new Set<string>();
  for (const file of [SENT_MAIN_LOG, SENT_HUNTER_LOG, SENT_YC_LOG]) {
    if (!fs.existsSync(file)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(file, "utf8")) as { emails?: string[] };
      (j.emails ?? []).forEach((e) => emails.add(e.toLowerCase()));
    } catch { /* ignore */ }
  }
  return emails;
}

function appendToYCLog(email: string) {
  let emails: string[] = [];
  if (fs.existsSync(SENT_YC_LOG)) {
    try { emails = (JSON.parse(fs.readFileSync(SENT_YC_LOG, "utf8")) as { emails?: string[] }).emails ?? []; } catch { /* */ }
  }
  emails.push(email.toLowerCase());
  fs.writeFileSync(SENT_YC_LOG, JSON.stringify({ emails, updatedAt: new Date().toISOString() }, null, 2));
}

// ── test helper ───────────────────────────────────────────────────────────────

function syntheticLead(email: string): Lead {
  return { email, firstName: "Mercier", company: "Dentago Test Practice", jobTitle: "Founder", city: "London", website: "dentago.co.uk", extra: { review_score: "4.8" } };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dry, csvPath, testTo, limit } = parseArgs();

  let leads: Lead[];

  if (testTo) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
      console.error(`Invalid --to= address: ${testTo}`);
      process.exit(1);
    }
    leads = [syntheticLead(testTo)];
    console.log(`Single test send → ${testTo}`);
  } else {
    const rows = parseCSV(csvPath);
    const skippedBad: { email: string; reason: string }[] = [];
    const already = loadSentSet();
    const toSend: Lead[] = [];

    for (const row of rows) {
      const reason = shouldSkip(row);
      if (reason) { skippedBad.push({ email: row["email"] || row["Email address"] || "(none)", reason }); continue; }
      const lead = normaliseLead(row);
      if (!lead) { skippedBad.push({ email: "(no email parsed)", reason: "normalise failed" }); continue; }
      if (already.has(lead.email)) { skippedBad.push({ email: lead.email, reason: "already sent" }); continue; }
      toSend.push(lead);
    }

    console.log(`CSV: ${csvPath}`);
    console.log(`Rows: ${rows.length} | to send: ${toSend.length} | skipped: ${skippedBad.length}`);
    skippedBad.slice(0, 10).forEach((s) => console.log(`  skip ${s.email}: ${s.reason}`));
    if (skippedBad.length > 10) console.log(`  ... +${skippedBad.length - 10} more`);

    leads = limit < Infinity ? toSend.slice(0, limit) : toSend;
    if (leads.length !== toSend.length) console.log(`Capped at ${limit} sends.`);
  }

  if (dry) {
    console.log("\n--- DRY RUN (first 3 emails) ---\n");
    for (const lead of leads.slice(0, 3)) {
      console.log("TO:     ", lead.email);
      console.log("SUBJECT:", subjectFor(lead));
      console.log(buildEmail(lead));
      console.log("\n---\n");
    }
    console.log(`DRY RUN complete — would send ${leads.length} emails. Run with --send to deliver.`);
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing — add to .env.local then re-run.");
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let ok = 0, fail = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    try {
      const { error } = await resend.emails.send({
        from:    `${FROM_NAME} <${FROM}>`,
        to:      lead.email,
        subject: subjectFor(lead),
        text:    buildEmail(lead),
        replyTo: FROM,
        headers: {
          "List-Unsubscribe":      `<mailto:${FROM}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      if (error) throw new Error(JSON.stringify(error));

      ok++;
      if (!testTo) appendToYCLog(lead.email);

      try {
        const { logEvent } = await import("../lib/events");
        await logEvent({
          event_type: "outreach_sent",
          entity_type: "lead",
          entity_id: lead.email,
          payload: { template: TEMPLATE, company: lead.company, first_name: lead.firstName, subject: subjectFor(lead), test_send: Boolean(testTo) },
          source: "scripts/send-outreach-yc-merged-2026-05-12.ts",
        });
      } catch { /* OS log is optional */ }

      console.log(`[${ok}/${leads.length}] ${lead.email} — ${lead.company}`);
    } catch (e) {
      fail++;
      console.error(`FAIL ${lead.email}:`, e);
    }

    if (i < leads.length - 1) await delay(3500);
  }

  console.log(`\nDone. Sent: ${ok}, failed: ${fail}${testTo ? " (test only)" : `, log: ${SENT_YC_LOG}`}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
