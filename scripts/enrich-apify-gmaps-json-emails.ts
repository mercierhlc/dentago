/**
 * Fill missing `email` in Apify Google Maps JSON by scraping each practice `website`.
 *
 * Output: same filename with `_enriched` before .json (never overwrites source).
 *
 *   npx tsx scripts/enrich-apify-gmaps-json-emails.ts
 *   npx tsx scripts/enrich-apify-gmaps-json-emails.ts --file=~/Downloads/dataset_....json
 *   npx tsx scripts/enrich-apify-gmaps-json-emails.ts --limit=100 --delay-ms=400
 *   npx tsx scripts/enrich-apify-gmaps-json-emails.ts --dry-run
 */
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

const DOWNLOADS = path.join(process.env.HOME ?? "", "Downloads");
const DEFAULT_FILE = path.join(
  DOWNLOADS,
  "dataset_google-maps-scraper-with-emails_2026-05-05_20-35-36-355_not-messaged.json"
);

const EXCLUDE_TITLE_RE =
  /(accountant|accountancy|bookkeeping|marketing|\bseo\b|web design|consultancy|software|supplier|wholesale|training course|recruitment)/i;

const NON_HARVEST_HOST =
  /facebook\.com|fb\.com|instagram\.com|twitter\.com|tiktok\.com|linkedin\.com|youtube\.com|pinterest\.com|google\.com\/maps|maps\.google|g\.page|goo\.gl|wix\.com\/site|sites\.google\.com/i;

function expandHome(p: string): string {
  if (p.startsWith("~/")) return path.join(process.env.HOME ?? "", p.slice(2));
  return p;
}

function parseArgs() {
  let file = DEFAULT_FILE;
  let limit = 50_000;
  let dry = false;
  let delayMs = 320;
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") dry = true;
    else if (a.startsWith("--file=")) file = expandHome(a.slice("--file=".length).trim());
    else if (a.startsWith("--limit=")) {
      const n = parseInt(a.split("=")[1], 10);
      if (!Number.isNaN(n) && n > 0) limit = n;
    } else if (a.startsWith("--delay-ms=")) {
      const n = parseInt(a.split("=")[1], 10);
      if (!Number.isNaN(n) && n >= 0) delayMs = n;
    }
  }
  return { file, limit, dry, delayMs };
}

type JsonRow = {
  name?: string;
  email?: string | null;
  website?: string | null;
  category?: string;
  [k: string]: unknown;
};

function normalizeWebsite(raw: string | null | undefined): string | null {
  const w = String(raw ?? "").trim();
  if (!w) return null;
  if (/^https?:\/\//i.test(w)) return w;
  if (/^www\./i.test(w)) return `https://${w}`;
  try {
    if (new URL(`https://${w}`).hostname.includes(".")) return `https://${w}`;
  } catch {
    /* ignore */
  }
  return null;
}

function isHarvestableUrl(url: string): boolean {
  try {
    return !NON_HARVEST_HOST.test(url);
  } catch {
    return false;
  }
}

function extractEmails(html: string, domain: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = new Set<string>();
  let match;
  while ((match = emailRegex.exec(html)) !== null) {
    const email = match[0].toLowerCase();
    if (email.includes(".png") || email.includes(".jpg") || email.includes(".gif")) continue;
    if (email.includes(".webp") || email.includes(".svg") || email.includes(".ico")) continue;
    if (email.includes("sentry") || email.includes("example.com") || email.includes("noreply@")) continue;
    if (email.includes("schema.org") || email.includes("w3.org")) continue;
    found.add(email);
  }
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  while ((match = mailtoRegex.exec(html)) !== null) {
    const cleaned = match[1]!.toLowerCase().split("?")[0]!;
    if (/\.(webp|png|jpg|gif|svg|ico)$/i.test(cleaned.split("@")[1] ?? "")) continue;
    found.add(cleaned);
  }
  const emails = Array.from(found).filter((e) => {
    const dom = e.split("@")[1] ?? "";
    if (/\.(webp|png|jpg|gif|svg|ico|woff2?|ttf|eot)$/i.test(dom)) return false;
    if (!/\.[a-z]{2,}$/i.test(dom)) return false;
    return true;
  });
  if (domain) {
    const domainPart = domain.replace(/^www\./, "").replace(/\/$/, "");
    const ownDomain = emails.filter((e) => e.includes(domainPart));
    if (ownDomain.length) return ownDomain;
  }
  const thirdParty = [
    "wix.com",
    "squarespace.com",
    "wordpress.com",
    "weebly.com",
    "godaddy.com",
    "mailchimp",
    "hubspot",
    "google.com",
    "facebook.com",
    "instagram.com",
    "nhs.scot",
    "nhshighland",
    "dentallymail.co.uk",
  ];
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

async function fetchWithTimeout(url: string, timeoutMs = 12_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    const text = await res.text();
    clearTimeout(timer);
    return text;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function urlsToTry(website: string): string[] {
  const base = website.replace(/\/$/, "");
  return [
    base,
    `${base}/contact`,
    `${base}/contact-us`,
    `${base}/contactus`,
    `${base}/about`,
    `${base}/about-us`,
    `${base}/enquiry`,
    `${base}/enquiries`,
  ];
}

function hasEmail(row: JsonRow): boolean {
  const e = row.email;
  return typeof e === "string" && e.includes("@") && e.trim().length > 3;
}

/** Reject asset-like strings and placeholder / test domains from scraped HTML. */
function isPlausiblePracticeEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return false;
  const dom = e.split("@")[1] ?? "";
  if (!dom || !/\.[a-z]{2,}$/i.test(dom)) return false;
  if (/\.(webp|png|jpg|gif|svg|ico|woff2?|ttf|eot|js|css|json)$/i.test(dom)) return false;
  if (e.startsWith("//") || e.includes("..")) return false;
  if (/^flags@|^image@|^img@|^sprite@/i.test(e)) return false;
  if (/^(example|test|noreply|no-reply|mailer-daemon|postmaster|you|user|name)@/i.test(e))
    return false;
  if (/example\.com|test\.com|provider\.com|sentry\.|schema\.org|localhost$/i.test(dom))
    return false;
  return true;
}

function finalizeHarvestedEmail(raw: string): string | null {
  let e = raw.trim().toLowerCase();
  if (e.startsWith("%20")) e = e.slice(3).trim();
  try {
    if (/%[0-9a-f]{2}/i.test(e)) e = decodeURIComponent(e);
  } catch {
    /* keep */
  }
  e = e.trim().toLowerCase();
  if (!isPlausiblePracticeEmail(e)) return null;
  return e;
}

async function harvestFromWebsite(website: string): Promise<string | null> {
  if (!isHarvestableUrl(website)) return null;
  const domain = getDomain(website);
  for (const url of urlsToTry(website)) {
    try {
      const html = await fetchWithTimeout(url);
      const emails = extractEmails(html, domain);
      const pick = emails.map(finalizeHarvestedEmail).find(Boolean);
      if (pick) return pick;
    } catch {
      /* next path */
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { file, limit, dry, delayMs } = parseArgs();

  if (!fs.existsSync(file)) {
    console.error("File not found:", file);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as JsonRow[];
  if (!Array.isArray(raw)) {
    console.error("JSON must be an array");
    process.exit(1);
  }

  const outPath = file.includes("_enriched.json")
    ? file
    : file.replace(/\.json$/i, "_enriched.json");

  // Resume: keep emails from a previous partial run
  if (outPath !== file && fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, "utf8")) as JsonRow[];
      if (prev.length === raw.length) {
        let resumed = 0;
        for (let i = 0; i < raw.length; i++) {
          const pe = prev[i]?.email;
          const merged =
            typeof pe === "string" && pe.includes("@") ? finalizeHarvestedEmail(pe) : null;
          if (!hasEmail(raw[i]!) && merged) {
            raw[i] = { ...raw[i], email: merged } as JsonRow;
            resumed++;
          }
        }
        if (resumed) console.log(`♻️  Resumed ${resumed} emails from existing ${path.basename(outPath)}\n`);
      }
    } catch {
      /* ignore bad previous file */
    }
  }

  const targets: { index: number; row: JsonRow; website: string }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]!;
    const practice = String(row.name ?? "").trim();
    if (!practice || EXCLUDE_TITLE_RE.test(practice)) continue;
    if (hasEmail(row)) continue;
    const website = normalizeWebsite(row.website);
    if (!website || !website.startsWith("http")) continue;
    targets.push({ index: i, row, website });
    if (targets.length >= limit) break;
  }

  console.log(`\n📬 Enrich emails from websites`);
  console.log(`   Source: ${file}`);
  console.log(`   Rows missing email (capped): ${targets.length}`);
  console.log(`   Output: ${outPath}`);
  console.log(`   Delay:  ${delayMs}ms between practices\n`);

  if (dry) {
    targets.slice(0, 25).forEach((t, i) => {
      console.log(`   ${i + 1}. ${String(t.row.name).slice(0, 55)} → ${t.website}`);
    });
    if (targets.length > 25) console.log(`   ... +${targets.length - 25} more`);
    console.log("\nDRY RUN — no HTTP requests.");
    return;
  }

  let found = 0;
  let done = 0;
  for (const t of targets) {
    done++;
    const name = String(t.row.name ?? "").slice(0, 50);
    try {
      const email = await harvestFromWebsite(t.website);
      if (email) {
        raw[t.index] = { ...raw[t.index], email } as JsonRow;
        found++;
        console.log(`✅ [${done}/${targets.length}] ${name} → ${email}`);
      } else {
        console.log(`❌ [${done}/${targets.length}] ${name}`);
      }
    } catch (e) {
      console.log(`❌ [${done}/${targets.length}] ${name} (${e instanceof Error ? e.message : e})`);
    }
    await sleep(delayMs);
  }

  fs.writeFileSync(outPath, JSON.stringify(raw, null, 2));
  console.log(`\n💾 Wrote ${outPath}`);
  console.log(`📊 Enriched ${found} / ${targets.length} (file has ${raw.length} total rows)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
