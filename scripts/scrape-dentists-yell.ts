import * as fs from "fs";
import * as path from "path";
import { Resend } from "resend";

const resend = new Resend("re_HhUc2mth_DjMxE6qwzpht5vBy6Hs14irH");
const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";

// ── UK cities to scrape ───────────────────────────────────────────────────────
const UK_CITIES = [
  "manchester", "birmingham", "leeds", "sheffield", "bristol",
  "liverpool", "nottingham", "leicester", "coventry", "bradford",
  "cardiff", "edinburgh", "glasgow", "belfast", "newcastle",
  "sunderland", "brighton", "plymouth", "portsmouth", "southampton",
  "oxford", "cambridge", "reading", "norwich", "derby",
  "wolverhampton", "swansea", "exeter", "gloucester", "york",
];

// ── Email extractor ───────────────────────────────────────────────────────────
function extractEmails(html: string, domain: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = new Set<string>();
  let match;
  while ((match = emailRegex.exec(html)) !== null) {
    const email = match[0].toLowerCase();
    if (email.includes(".png") || email.includes(".jpg")) continue;
    if (email.includes("sentry") || email.includes("example") || email.includes("noreply")) continue;
    if (email.includes("schema.org") || email.includes("w3.org") || email.includes("wix.com")) continue;
    found.add(email);
  }
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  while ((match = mailtoRegex.exec(html)) !== null) found.add(match[1].toLowerCase());

  const emails = Array.from(found);
  if (domain) {
    const domainPart = domain.replace(/^www\./, "").replace(/\/$/, "");
    const own = emails.filter((e) => e.includes(domainPart));
    if (own.length) return own;
  }
  const thirdParty = ["wix.com", "squarespace", "wordpress.com", "godaddy", "mailchimp",
    "hubspot", "google.com", "facebook.com", "nhs.scot", "dentallymail"];
  return emails.filter((e) => !thirdParty.some((t) => e.includes(t))).slice(0, 2);
}

function getDomain(website: string): string {
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "");
  } catch { return ""; }
}

async function fetchText(url: string, timeout = 8000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const text = await res.text();
    clearTimeout(timer);
    return text;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Parse Yell listings page ──────────────────────────────────────────────────
interface YellPractice {
  name: string;
  website: string;
  city: string;
}

function parseYellListings(html: string, city: string): YellPractice[] {
  const practices: YellPractice[] = [];

  // Extract business name + website from Yell listing cards
  // Yell uses data-attributes and structured HTML
  const businessRegex = /<h2[^>]*class="[^"]*businessCapsule--name[^"]*"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  const websiteRegex = /data-tracking-id="businessCapsule--websiteUrl"[^>]*href="([^"]+)"/gi;

  // Simpler: match listing blocks
  const blockRegex = /<article[^>]*class="[^"]*businessCapsule[^"]*"[\s\S]*?<\/article>/gi;
  let block;
  while ((block = blockRegex.exec(html)) !== null) {
    const blockHtml = block[0];

    // Extract name
    const nameMatch = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(blockHtml);
    const name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    if (!name) continue;

    // Extract website
    const websiteMatch = /data-tracking-id="businessCapsule--websiteUrl"[^>]*href="([^"]+)"/i.exec(blockHtml) ||
                         /href="(https?:\/\/(?!www\.yell\.com)[^"]+)"/i.exec(blockHtml);
    const website = websiteMatch ? websiteMatch[1].split("?")[0] : "";

    if (name && website && website.startsWith("http")) {
      practices.push({ name, website, city });
    }
  }

  // Fallback: try to extract from JSON-LD or other patterns
  if (practices.length === 0) {
    const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
    let ldMatch;
    while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(ldMatch[1]);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] === "LocalBusiness" || item["@type"] === "Dentist") {
            const name = item.name || "";
            const website = item.url || "";
            if (name && website) practices.push({ name, website, city });
          }
        }
      } catch { /* skip */ }
    }
  }

  return practices;
}

// ── Build email ───────────────────────────────────────────────────────────────
function buildEmail(name: string): { subject: string; html: string } {
  const subject = `Quick one for ${name}`;
  const html = `
<p>Hi there,</p>

<p>Quick one — supply prices across Henry Schein, Kent Express, and Dental Sky can vary 20–30% on the exact same items week to week.</p>

<p>Most practices don't notice because checking them all manually takes too long.</p>

<p>Dentago puts them side by side in one place, so you buy faster and don't overpay. It's free for clinics.</p>

<p>Worth a quick look, or not a priority right now?</p>

<p>– Mercier<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim();
  return { subject, html };
}

// ── Load previously sent emails to avoid duplicates ───────────────────────────
function loadSentEmails(): Set<string> {
  const logPath = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");
  if (!fs.existsSync(logPath)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    return new Set((data.sent ?? []).map((s: { email: string }) => s.email.toLowerCase()));
  } catch { return new Set(); }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const TARGET = 300;
  const previouslySent = loadSentEmails();
  const seenEmails = new Set<string>(previouslySent);
  console.log(`📧 ${previouslySent.size} emails already sent — will skip these\n`);

  const practices: YellPractice[] = [];

  // Step 1: Scrape Yell for dental practices across UK cities
  console.log("🔍 Step 1: Scraping Yell.com for dental practices...\n");
  for (const city of UK_CITIES) {
    if (practices.length >= TARGET * 3) break; // collect more than needed (many won't have emails)
    for (let page = 1; page <= 3; page++) {
      const url = `https://www.yell.com/ucs/UcsSearchAction.do?keywords=dental+practice&location=${city}&pageNum=${page}`;
      try {
        const html = await fetchText(url);
        const found = parseYellListings(html, city);
        practices.push(...found);
        console.log(`  ${city} p${page}: ${found.length} listings`);
        if (found.length === 0) break;
      } catch (e) {
        console.log(`  ${city} p${page}: failed`);
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Deduplicate by website
  const seenWebsites = new Set<string>();
  const uniquePractices = practices.filter(p => {
    const domain = getDomain(p.website);
    if (!domain || seenWebsites.has(domain)) return false;
    seenWebsites.add(domain);
    return true;
  });
  console.log(`\n✅ ${uniquePractices.length} unique practices found\n`);

  // Step 2: Scrape emails from their websites
  console.log("📨 Step 2: Scraping emails from practice websites...\n");

  const withEmails: { name: string; email: string; city: string; website: string }[] = [];

  for (const p of uniquePractices) {
    if (withEmails.length >= TARGET * 1.5) break;
    const domain = getDomain(p.website);
    const urlsToTry = [
      p.website,
      `${p.website.replace(/\/$/, "")}/contact`,
      `${p.website.replace(/\/$/, "")}/contact-us`,
    ];

    let emails: string[] = [];
    for (const url of urlsToTry) {
      try {
        const html = await fetchText(url);
        emails = extractEmails(html, domain);
        if (emails.length) break;
      } catch { /* try next */ }
      await new Promise(r => setTimeout(r, 100));
    }

    if (emails.length) {
      const email = emails[0].toLowerCase();
      if (!seenEmails.has(email)) {
        withEmails.push({ name: p.name, email, city: p.city, website: p.website });
        console.log(`  ✅ ${p.name} → ${email}`);
      } else {
        console.log(`  ↩️  ${p.name} — duplicate email`);
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n📊 ${withEmails.length} practices with emails found\n`);

  // Step 3: Send emails
  console.log("📤 Step 3: Sending emails...\n");
  const toSend = withEmails.slice(0, TARGET);
  const results: { name: string; email: string; city: string; status: string }[] = [];

  for (const p of toSend) {
    seenEmails.add(p.email);
    const { subject, html } = buildEmail(p.name);
    try {
      await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: p.email,
        subject,
        html,
        replyTo: FROM,
      });
      results.push({ ...p, status: "Sent" });
      console.log(`✅ ${p.name} → ${p.email}`);
    } catch (err) {
      results.push({ ...p, status: "Failed" });
      console.error(`❌ ${p.name}:`, err);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  const successCount = results.filter(r => r.status === "Sent").length;
  const failCount = results.filter(r => r.status === "Failed").length;

  console.log(`\n📊 Batch 4 complete: ${successCount} sent, ${failCount} failed`);
  console.log("\n=== SENT LOG ===");
  results.forEach((r, i) => console.log(`${i + 1}. ${r.name} | ${r.email} | ${r.city} | ${r.status}`));

  // Update all-time log
  const logPath = path.join(process.env.HOME!, "Downloads", "dentago-sent-all.json");
  const existing = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf-8"))
    : { sent: [] };
  existing.sent.push(...results.filter(r => r.status === "Sent").map(r => ({
    ...r, batch: 4, sentAt: new Date().toISOString(),
  })));
  fs.writeFileSync(logPath, JSON.stringify(existing, null, 2));
  console.log(`\n💾 Log updated — ${existing.sent.length} total emails on record`);
}

main().catch(console.error);
