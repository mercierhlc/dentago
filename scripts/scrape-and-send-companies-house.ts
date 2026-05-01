import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

// ── Config ────────────────────────────────────────────────────────────────────
const RESEND_API_KEY = "re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH";
const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";
const COMPANIES_PATH = path.join(process.env.HOME!, "Downloads", "companies-cleaned.json");
const PROGRESS_PATH = path.join(process.env.HOME!, "Downloads", "ch-scrape-progress.json");
const SENT_LOG_PATH = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");

const resend = new Resend(RESEND_API_KEY);
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Email validation ──────────────────────────────────────────────────────────
const JUNK_EMAILS = new Set([
  "info@example.com", "test@test.com", "noreply@noreply.com", "admin@admin.com",
  "no-reply@no-reply.com", "donotreply@donotreply.com",
]);
const JUNK_DOMAINS = [
  "wix.com", "squarespace.com", "wordpress.com", "godaddy.com", "mailchimp.com",
  "hubspot.com", "google.com", "facebook.com", "dentallymail.co.uk", "sentry.io",
  "nhs.scot", "nhshighland.scot.nhs.uk", "example.com", "w3.org", "schema.org",
];

function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@") || !email.includes(".")) return false;
  if (JUNK_EMAILS.has(email.toLowerCase())) return false;
  if (email.includes("..") || email.startsWith(".") || email.length > 254) return false;
  if (JUNK_DOMAINS.some((d) => email.includes(d))) return false;
  return true;
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchHtml(url: string, timeoutMs = 8000): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    redirect: "follow",
  });
  return res.text();
}

// ── Find website via domain guessing ─────────────────────────────────────────
function guessDomainsFromName(name: string): string[] {
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);

  // Full name joined
  const full = words.join("");
  // Full name hyphenated
  const hyphenated = words.join("-");
  // Strip noise words, keep meaningful ones
  const noise = new Set(["the", "and", "of", "a", "an", "for", "at", "in"]);
  const meaningful = words.filter((w) => !noise.has(w));
  const slug = meaningful.join("");
  const slugHyphen = meaningful.join("-");

  const candidates = new Set<string>();
  for (const base of [slug, slugHyphen, full, hyphenated]) {
    if (!base || base.length < 4) continue;
    candidates.add(`https://www.${base}.co.uk`);
    candidates.add(`https://${base}.co.uk`);
    candidates.add(`https://www.${base}.com`);
  }
  return Array.from(candidates);
}

async function findWebsite(companyName: string): Promise<string | null> {
  for (const url of guessDomainsFromName(companyName)) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36" },
        redirect: "follow",
      });
      if (res.status < 400) return url;
    } catch { /* try next */ }
  }
  return null;
}

// ── Extract emails from HTML ──────────────────────────────────────────────────
function extractEmails(html: string, domain: string): string[] {
  const found = new Set<string>();
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  let match;

  while ((match = emailRegex.exec(html)) !== null) {
    const e = match[0].toLowerCase();
    if (!e.includes(".png") && !e.includes(".jpg") && !e.includes(".gif")) found.add(e);
  }
  while ((match = mailtoRegex.exec(html)) !== null) found.add(match[1].toLowerCase());

  const emails = Array.from(found).filter(isValidEmail);

  // Prioritise own-domain emails
  if (domain) {
    const own = emails.filter((e) => e.includes(domain.replace(/^www\./, "")));
    if (own.length) return own;
  }
  return emails.slice(0, 3);
}

function getDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch { return ""; }
}

// ── Scrape website for email ──────────────────────────────────────────────────
async function scrapeEmail(website: string): Promise<string | null> {
  const domain = getDomain(website);
  const base = website.replace(/\/$/, "");
  const urls = [base, `${base}/contact`, `${base}/contact-us`, `${base}/about-us`];

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      const emails = extractEmails(html, domain);
      if (emails.length) return emails[0];
    } catch { /* try next */ }
    await delay(150);
  }
  return null;
}

// ── Email template ────────────────────────────────────────────────────────────
function buildEmail(practiceName: string): { subject: string; html: string } {
  const subject = "Only open this if cutting supplies cost is a priority...";
  const html = `
<p>Hi there,</p>

<p>Most dental practices are spending hours every week logging into 4–5 supplier sites, comparing prices manually, and placing separate orders with each one.</p>

<p>Dentago fixes that. One place to search every supplier you already use, see prices side by side, and place one order. Takes 5 minutes to set up and it's completely free for practices. (Btw we integrate your existing supplier accounts to get your negotiated prices).</p>

<p>If saving on supply costs and cutting down admin time sounds useful, why not join the 200+ dental clinics that are already implementing Dentago? (May as well join the party and save thousands annually on supplies eh?)</p>

<p>Here's my WhatsApp — <strong>+447466 607116</strong>. Happy to get you set up as soon as you drop me a message!</p>

<p>No credit card required — we do NOT charge clinics. We take our fee from the suppliers we work with.</p>

<p>Mercier<br/>
Founder @ Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim();
  return { subject, html };
}

// ── Progress & sent log ───────────────────────────────────────────────────────
interface ProgressEntry {
  company: string;
  website?: string;
  email?: string;
  sent: boolean;
  skipped?: string;
  processedAt: string;
}

function loadProgress(): Map<string, ProgressEntry> {
  if (!fs.existsSync(PROGRESS_PATH)) return new Map();
  try {
    const data: ProgressEntry[] = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
    return new Map(data.map((e) => [e.company, e]));
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
  existing.sent.push({ ...entry, batch: "companies-house-scrape", sentAt: new Date().toISOString() });
  fs.writeFileSync(SENT_LOG_PATH, JSON.stringify(existing, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const companies: string[] = JSON.parse(fs.readFileSync(COMPANIES_PATH, "utf-8"));
  console.log(`📋 ${companies.length} companies loaded\n`);

  const progress = loadProgress();
  const sentEmails = loadSentEmails();
  const seenEmails = new Set<string>(sentEmails);

  const todo = companies.filter((c) => !progress.has(c));
  console.log(`✅ ${companies.length - todo.length} already processed | 🔄 ${todo.length} remaining\n`);

  let sentCount = 0;
  let noEmailCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < todo.length; i++) {
    const company = todo[i];
    process.stdout.write(`[${i + 1}/${todo.length}] ${company} ... `);

    // 1. Find website via DuckDuckGo
    const website = await findWebsite(company);

    if (!website) {
      process.stdout.write(`no website found\n`);
      progress.set(company, { company, sent: false, skipped: "no website", processedAt: new Date().toISOString() });
      noEmailCount++;
      if (i % 25 === 0) saveProgress(progress);
      continue;
    }

    // 2. Scrape website for email
    const email = await scrapeEmail(website);

    if (!email) {
      process.stdout.write(`no email found (${website})\n`);
      progress.set(company, { company, website, sent: false, skipped: "no email", processedAt: new Date().toISOString() });
      noEmailCount++;
      if (i % 25 === 0) saveProgress(progress);
      continue;
    }

    // 3. Skip duplicates
    if (seenEmails.has(email.toLowerCase())) {
      process.stdout.write(`already sent (${email})\n`);
      progress.set(company, { company, website, email, sent: false, skipped: "duplicate", processedAt: new Date().toISOString() });
      skippedCount++;
      if (i % 25 === 0) saveProgress(progress);
      continue;
    }

    seenEmails.add(email.toLowerCase());

    // 4. Send
    const { subject, html } = buildEmail(company);
    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: email,
        subject,
        html,
        replyTo: FROM,
      });
      process.stdout.write(`✅ sent → ${email}\n`);
      progress.set(company, { company, website, email, sent: true, processedAt: new Date().toISOString() });
      appendToSentLog({ name: company, email, practice: company });
      sentCount++;
    } catch (err: any) {
      process.stdout.write(`❌ send failed: ${err?.message}\n`);
      progress.set(company, { company, website, email, sent: false, skipped: `send-error: ${err?.message}`, processedAt: new Date().toISOString() });
    }

    if (i % 25 === 0) saveProgress(progress);
    await delay(100);
  }

  saveProgress(progress);

  console.log(`\n📊 Complete`);
  console.log(`   ✅ Sent:       ${sentCount}`);
  console.log(`   ❌ No email:   ${noEmailCount}`);
  console.log(`   ⏭  Skipped:   ${skippedCount}`);
  console.log(`   📁 Progress:   ${PROGRESS_PATH}`);

  // Final summary
  const all = Array.from(progress.values());
  console.log(`\n   🌐 Website found: ${all.filter(e => e.website).length} / ${all.length}`);
  console.log(`   📬 Email found:   ${all.filter(e => e.email).length} / ${all.length}`);
}

main().catch(console.error);
