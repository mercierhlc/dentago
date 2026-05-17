import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

// ── Config ────────────────────────────────────────────────────────────────────
const RESEND_API_KEY = "re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH";
const CH_API_KEY = process.env.CH_API_KEY || ""; // Set via: CH_API_KEY=your_key npx tsx scripts/send-outreach-companies-house.ts
const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";
const CSV_PATH = path.join(process.env.HOME!, "Downloads", "Companies-House-search-results.csv");
const PROGRESS_PATH = path.join(process.env.HOME!, "Downloads", "ch-outreach-progress.json");
const SENT_LOG_PATH = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");

const resend = new Resend(RESEND_API_KEY);

// ── CSV Parser ────────────────────────────────────────────────────────────────
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
    } else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((l) => l.trim());
  const firstLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCSVLine(firstLine);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.replace(/^\uFEFF/, "")] = (values[i] ?? "").trim(); });
    return row;
  });
}

// ── Email validation ──────────────────────────────────────────────────────────
const JUNK_EMAILS = new Set([
  "info@example.com", "test@test.com", "noreply@noreply.com", "admin@admin.com",
]);

function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@") || !email.includes(".")) return false;
  if (JUNK_EMAILS.has(email.toLowerCase())) return false;
  if (email.includes("..") || email.startsWith(".")) return false;
  if (email.length > 254) return false;
  return true;
}

// ── Companies House API ───────────────────────────────────────────────────────
interface CHCompany {
  website?: string;
  company_name?: string;
}

interface CHOfficer {
  name: string;
  officer_role: string;
  resigned_on?: string;
}

async function fetchCHCompany(companyNumber: string): Promise<CHCompany | null> {
  if (!CH_API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.company-information.service.gov.uk/company/${companyNumber}`,
      {
        headers: {
          Authorization: "Basic " + Buffer.from(CH_API_KEY + ":").toString("base64"),
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchCHOfficers(companyNumber: string): Promise<CHOfficer[]> {
  if (!CH_API_KEY) return [];
  try {
    const res = await fetch(
      `https://api.company-information.service.gov.uk/company/${companyNumber}/officers?items_per_page=10`,
      {
        headers: {
          Authorization: "Basic " + Buffer.from(CH_API_KEY + ":").toString("base64"),
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    const items: CHOfficer[] = data.items ?? [];
    // Return only active (non-resigned) directors/secretaries
    return items.filter(
      (o) => !o.resigned_on && ["director", "secretary", "llp-member", "llp-designated-member"].includes(o.officer_role)
    );
  } catch {
    return [];
  }
}

function extractFirstName(fullName: string): string {
  // CH names are typically "SURNAME, Firstname" or "Firstname Surname"
  if (fullName.includes(",")) {
    const parts = fullName.split(",");
    const firstPart = (parts[1] || "").trim();
    return firstPart.split(" ")[0];
  }
  return fullName.split(" ")[0];
}

// ── Website email scraping ────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  return res.text();
}

function extractEmailsFromHtml(html: string, domain: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = new Set<string>();
  let match;
  while ((match = emailRegex.exec(html)) !== null) {
    const email = match[0].toLowerCase();
    if (email.includes(".png") || email.includes(".jpg") || email.includes(".gif")) continue;
    if (email.includes("sentry") || email.includes("example") || email.includes("noreply")) continue;
    if (email.includes("schema.org") || email.includes("w3.org")) continue;
    found.add(email);
  }
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  while ((match = mailtoRegex.exec(html)) !== null) {
    found.add(match[1].toLowerCase());
  }
  const emails = Array.from(found);
  if (domain) {
    const domainPart = domain.replace(/^www\./, "").replace(/\/$/, "");
    const ownDomain = emails.filter((e) => e.includes(domainPart));
    if (ownDomain.length) return ownDomain;
  }
  const thirdParty = ["wix.com", "squarespace.com", "wordpress.com", "godaddy.com",
    "mailchimp", "hubspot", "google.com", "facebook.com", "dentallymail.co.uk"];
  return emails.filter((e) => !thirdParty.some((t) => e.includes(t))).slice(0, 3);
}

function getDomain(website: string): string {
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function findEmailFromWebsite(website: string): Promise<string | null> {
  const domain = getDomain(website);
  const base = website.replace(/\/$/, "");
  const urlsToTry = [base, `${base}/contact`, `${base}/contact-us`, `${base}/about-us`];
  for (const url of urlsToTry) {
    try {
      const html = await fetchWithTimeout(url);
      const emails = extractEmailsFromHtml(html, domain);
      if (emails.length) return emails[0];
    } catch { /* try next */ }
    await delay(150);
  }
  return null;
}

// ── Email template ────────────────────────────────────────────────────────────
function buildEmail(firstName: string, practiceName: string): { subject: string; html: string } {
  const name = firstName && firstName.length > 1 ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : "there";
  const subject = "Only open this if cutting supplies cost is a priority...";
  const html = `
<p>Hi ${name},</p>

<p>Most dental practices are spending hours every week logging into 4–5 supplier sites, comparing prices manually, and placing separate orders with each one.</p>

<p>Dentago fixes that. One place to search every supplier you already use, see prices side by side, and place one order. Takes 5 minutes to set up and it's completely free for practices. (Btw we integrate your existing supplier accounts to get your negotiated prices).</p>

<p>If saving on supply costs and cutting down admin time sounds useful, why not join the 200+ dental clinics that are already implementing Dentago? (May as well join the party and save thousands annually on supplies eh?)</p>

<p>Here's my WhatsApp — <strong>+447466 607116</strong>. Happy to get you set up as soon as you drop me a message!</p>

<p>No credit card required — we do NOT charge clinics. We take our fee from the suppliers we work with.</p>

<p>Mercier<br/>
Founder @ Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
<img src="https://www.dentago.co.uk/api/track/open?e=${encodeURIComponent(email)}&b=ch" width="1" height="1" style="display:none" />
`.trim();
  return { subject, html };
}

// ── Progress tracking ─────────────────────────────────────────────────────────
interface ProgressEntry {
  companyNumber: string;
  companyName: string;
  website?: string;
  directorName?: string;
  email?: string;
  emailSource: "director-scraped" | "website-scraped" | "none";
  sent: boolean;
  skipped?: string;
  processedAt: string;
}

function loadProgress(): Map<string, ProgressEntry> {
  if (!fs.existsSync(PROGRESS_PATH)) return new Map();
  try {
    const data: ProgressEntry[] = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
    return new Map(data.map((e) => [e.companyNumber, e]));
  } catch { return new Map(); }
}

function saveProgress(progress: Map<string, ProgressEntry>) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(Array.from(progress.values()), null, 2));
}

function loadSentEmails(): Set<string> {
  if (!fs.existsSync(SENT_LOG_PATH)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(SENT_LOG_PATH, "utf-8"));
    return new Set((data.sent ?? []).map((s: { email: string }) => s.email.toLowerCase()));
  } catch { return new Set(); }
}

function appendToSentLog(entry: { name: string; email: string; practice: string }) {
  const existing = fs.existsSync(SENT_LOG_PATH)
    ? JSON.parse(fs.readFileSync(SENT_LOG_PATH, "utf-8"))
    : { sent: [] };
  existing.sent.push({ ...entry, batch: "companies-house", sentAt: new Date().toISOString() });
  fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(existing, null, 2));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!CH_API_KEY) {
    console.error("❌ CH_API_KEY not set.");
    console.error("   Get a free key at: https://developer.company-information.service.gov.uk");
    console.error("   Then run: CH_API_KEY=your_key npx tsx scripts/send-outreach-companies-house.ts");
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(content);
  const activeRows = rows.filter((r) => r.company_status?.toLowerCase() === "active" && r.company_number);
  console.log(`📋 ${rows.length} total companies | ${activeRows.length} active\n`);

  const progress = loadProgress();
  const previouslySent = loadSentEmails();
  const seenEmails = new Set<string>(previouslySent);

  const todo = activeRows.filter((r) => !progress.has(r.company_number));
  const alreadyDone = activeRows.length - todo.length;
  console.log(`✅ ${alreadyDone} already processed (resuming) | 🔄 ${todo.length} remaining\n`);

  let sentCount = 0;
  let skippedCount = 0;
  let noEmailCount = 0;

  for (let i = 0; i < todo.length; i++) {
    const row = todo[i];
    const companyNumber = row.company_number;
    const companyName = row.company_name;

    process.stdout.write(`[${i + 1}/${todo.length}] ${companyName} (${companyNumber}) ... `);

    // 1. Fetch CH company profile (website) + officers (directors)
    const [chCompany, officers] = await Promise.all([
      fetchCHCompany(companyNumber),
      fetchCHOfficers(companyNumber),
    ]);

    const website = chCompany?.website?.trim() || "";
    const director = officers[0] ?? null;
    const directorFirstName = director ? extractFirstName(director.name) : "";

    // 2. Scrape website for email
    let email: string | null = null;
    let emailSource: ProgressEntry["emailSource"] = "none";

    if (website) {
      email = await findEmailFromWebsite(website);
      if (email) emailSource = "website-scraped";
    }

    // 3. Skip if no email found
    if (!email || !isValidEmail(email)) {
      process.stdout.write(`no email found\n`);
      progress.set(companyNumber, {
        companyNumber, companyName, website, directorName: director?.name,
        emailSource: "none", sent: false, skipped: "no email",
        processedAt: new Date().toISOString(),
      });
      noEmailCount++;
      if (i % 50 === 0) saveProgress(progress);
      await delay(100);
      continue;
    }

    // 4. Skip duplicates
    if (seenEmails.has(email.toLowerCase())) {
      process.stdout.write(`duplicate (${email})\n`);
      progress.set(companyNumber, {
        companyNumber, companyName, website, directorName: director?.name,
        email, emailSource, sent: false, skipped: "duplicate",
        processedAt: new Date().toISOString(),
      });
      skippedCount++;
      if (i % 50 === 0) saveProgress(progress);
      continue;
    }

    seenEmails.add(email.toLowerCase());

    // 5. Send
    const { subject, html } = buildEmail(directorFirstName, companyName);
    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: email,
        subject,
        html,
        replyTo: FROM,
      });
      process.stdout.write(`✅ sent to ${email}${directorFirstName ? ` (${directorFirstName})` : ""}\n`);
      progress.set(companyNumber, {
        companyNumber, companyName, website, directorName: director?.name,
        email, emailSource, sent: true, processedAt: new Date().toISOString(),
      });
      appendToSentLog({ name: directorFirstName || companyName, email, practice: companyName });
      sentCount++;
    } catch (err: any) {
      process.stdout.write(`❌ send failed: ${err?.message}\n`);
      progress.set(companyNumber, {
        companyNumber, companyName, website, directorName: director?.name,
        email, emailSource, sent: false, skipped: `send-error: ${err?.message}`,
        processedAt: new Date().toISOString(),
      });
    }

    // Save progress every 25 companies
    if (i % 25 === 0) saveProgress(progress);

    // Rate limit: CH API allows 600 req/min — 2 calls per company = ~300 companies/min
    // Adding scraping delay makes ~100ms total safe
    await delay(300);
  }

  // Final save
  saveProgress(progress);

  const allEntries = Array.from(progress.values());
  console.log(`\n📊 Done!`);
  console.log(`   ✅ Sent:        ${sentCount}`);
  console.log(`   ❌ No email:    ${noEmailCount}`);
  console.log(`   ⏭  Duplicates:  ${skippedCount}`);
  console.log(`   📁 Progress:    ${PROGRESS_PATH}`);
  console.log(`   📧 Sent log:    ${SENT_LOG_PATH}`);

  // Summary of what had websites vs not
  const withWebsite = allEntries.filter((e) => e.website).length;
  const withEmail = allEntries.filter((e) => e.email).length;
  console.log(`\n   🌐 Had website: ${withWebsite} / ${allEntries.length}`);
  console.log(`   📬 Email found: ${withEmail} / ${allEntries.length}`);
}

main().catch(console.error);
