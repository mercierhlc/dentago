/**
 * Send cold outreach from Apify "google-maps-scraper-with-emails" JSON export.
 *
 * Skips (default):
 * - rows without usable email
 * - emails already in ~/Downloads/dentago-sent-all.json
 * - fetchColdMarketingExcludedEmails (registered clinics + CRM marketing_opt_out)
 * - contacts with status unsubscribed | do_not_contact
 *
 *   --ignore-local-blocks  Skip sent log + marketing/CRM blocks; send every row in
 *                          the file (deduped within file only). Uses relaxed email
 *                          checks (need @); Resend rejects bad addresses.
 *
 *   npx tsx scripts/send-outreach-apify-dataset-json.ts --file=~/Downloads/dataset_..._not-messaged.json --dry-run
 *   npx tsx scripts/send-outreach-apify-dataset-json.ts --file=... --limit=100
 *   npx tsx scripts/send-outreach-apify-dataset-json.ts --ignore-local-blocks
 */
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { fetchColdMarketingExcludedEmails } from "../lib/marketing-exclusions";

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

const BATCH = 13;
const TEMPLATE = "Batch13-ApifyGmapsMay2026";

const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";
const DOWNLOADS = path.join(process.env.HOME ?? "", "Downloads");
const LOG_PATH = path.join(DOWNLOADS, "dentago-sent-all.json");

const DEFAULT_FILE = path.join(
  DOWNLOADS,
  "dataset_google-maps-scraper-with-emails_2026-05-05_20-35-36-355_not-messaged.json"
);

const EXCLUDE_TITLE_RE =
  /(accountant|accountancy|bookkeeping|marketing|\bseo\b|web design|consultancy|software|supplier|wholesale|training course|recruitment)/i;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function expandHome(p: string): string {
  if (p.startsWith("~/")) return path.join(process.env.HOME ?? "", p.slice(2));
  return p;
}

function normalizeEmail(raw: string): string {
  let e = raw.trim().toLowerCase();
  if (e.startsWith("%20")) e = e.slice(3).trim();
  try {
    if (/%[0-9a-f]{2}/i.test(e)) e = decodeURIComponent(e);
  } catch {
    /* keep e */
  }
  return e.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  if (!e || !e.includes("@")) return false;
  const domain = e.split("@")[1] ?? "";
  if (!domain.includes(".") && !/^(nhs\.net|nhs\.uk)$/i.test(domain)) return false;
  if (!/\.[a-z]{2,}$/i.test(domain)) return false;
  if (e.startsWith("//") || e.includes("..")) return false;
  if (/\.(webp|png|jpg|gif|svg)$/i.test(domain)) return false;
  const junk = [
    "example.com", "test@", "noreply", "sentry", "schema.org", "w3.org",
    "wixpress.com", "squarespace.com",
  ];
  if (junk.some((j) => e.includes(j))) return false;
  return true;
}

/** Single @ with non-empty local + domain — use with --ignore-local-blocks when Resend should validate the rest. */
function isValidEmailRelaxed(email: string): boolean {
  const e = normalizeEmail(email);
  if (!e || !e.includes("@")) return false;
  const parts = e.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (local.includes("..") || domain.includes("..")) return false;
  return true;
}

function loadSentEmails(): Set<string> {
  if (!fs.existsSync(LOG_PATH)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
    return new Set(
      (data.sent ?? []).map((s: { email?: string }) => String(s.email ?? "").toLowerCase())
    );
  } catch {
    return new Set();
  }
}

function extractGreeting(practiceName: string): string {
  const t = practiceName.trim();
  if (!t) return "there";
  const first = t.split(/\s+/)[0] ?? "";
  if (first.length < 2) return "there";
  return first.replace(/[^a-zA-Z.'-]/g, "") || "there";
}

function buildEmail(greeting: string, pixelEmail: string): { subject: string; html: string } {
  const subject = "Only open this if cutting supplies cost is a priority...";
  const html = `
<p>Hi ${greeting},</p>

<p>Most dental practices are spending hours every week logging into 4–5 supplier sites, comparing prices manually, and placing separate orders with each one.</p>

<p>Dentago fixes that. One place to search every supplier you already use, see prices side by side, and place one order. Takes 5 minutes to set up and it's completely free for practices. (Btw we integrate your existing supplier accounts to get your negotiated prices).</p>

<p>If saving on supply costs and cutting down admin time sounds useful, why not join the 200+ dental clinics that are already implementing Dentago? (May as well join the party and save thousands annually on supplies eh?)</p>

<p>Here's my WhatsApp — <strong>+447466 607116</strong>. Happy to get you set up as soon as you drop me a message!</p>

<p>No credit card required — we do NOT charge clinics. We take our fee from the suppliers we work with.</p>

<p>Mercier<br/>
Founder @ Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
<img src="https://www.dentago.co.uk/api/track/open?e=${encodeURIComponent(pixelEmail)}&b=apify${BATCH}" width="1" height="1" style="display:none" alt="" />
`.trim();
  return { subject, html };
}

type JsonRow = {
  name?: string;
  email?: string | null;
  category?: string;
  [k: string]: unknown;
};

async function loadBlockedStatuses(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  const out = new Set<string>();
  const page = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("contacts")
      .select("email")
      .in("status", ["unsubscribed", "do_not_contact"])
      .not("email", "is", null)
      .range(offset, offset + page - 1);
    if (error) {
      console.warn("contacts blocked status:", error.message);
      break;
    }
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const r of rows) {
      const e = r.email?.toLowerCase();
      if (e) out.add(e);
    }
    offset += page;
    if (rows.length < page) break;
  }
  return out;
}

function parseArgs() {
  let file = DEFAULT_FILE;
  let limit = 10_000;
  let dry = false;
  let ignoreLocalBlocks = false;
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") dry = true;
    else if (a === "--ignore-local-blocks") ignoreLocalBlocks = true;
    else if (a.startsWith("--file=")) file = expandHome(a.slice("--file=".length).trim());
    else if (a.startsWith("--limit=")) {
      const n = parseInt(a.split("=")[1], 10);
      if (!Number.isNaN(n) && n > 0) limit = n;
    }
  }
  return { file, limit, dry, ignoreLocalBlocks };
}

interface Lead {
  email: string;
  practice: string;
  greeting: string;
}

async function main() {
  const { file, limit, dry, ignoreLocalBlocks } = parseArgs();

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!dry && !process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing in .env.local / .env");
    process.exit(1);
  }
  if (!ignoreLocalBlocks && (!sbUrl || !sbKey)) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or pass --ignore-local-blocks)");
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    console.error("File not found:", file);
    process.exit(1);
  }

  let sent = new Set<string>();
  let marketingBlocked = new Set<string>();
  let statusBlocked = new Set<string>();
  if (ignoreLocalBlocks) {
    sent = loadSentEmails();
    console.warn(
      "\n⚠️  --ignore-local-blocks: not skipping sent log / marketing / CRM unsub — sending every row in file (file dedupe only).\n"
    );
  } else {
    const supabase = createClient(sbUrl, sbKey);
    [sent, marketingBlocked, statusBlocked] = await Promise.all([
      Promise.resolve(loadSentEmails()),
      fetchColdMarketingExcludedEmails(supabase, sbUrl, sbKey),
      loadBlockedStatuses(supabase),
    ]);
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as JsonRow[];
  if (!Array.isArray(raw)) {
    console.error("JSON must be an array");
    process.exit(1);
  }

  const leads: Lead[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (leads.length >= limit) break;
    const practice = String(row.name ?? "").trim();
    if (!practice || EXCLUDE_TITLE_RE.test(practice)) continue;
    const em = normalizeEmail(String(row.email ?? ""));
    const emailOk = ignoreLocalBlocks ? isValidEmailRelaxed(em) : isValidEmail(em);
    if (!emailOk) continue;
    if (!ignoreLocalBlocks) {
      if (sent.has(em) || seen.has(em)) continue;
      if (marketingBlocked.has(em) || statusBlocked.has(em)) continue;
    } else if (seen.has(em)) {
      continue;
    }
    seen.add(em);
    leads.push({
      email: em,
      practice,
      greeting: extractGreeting(practice),
    });
  }

  console.log(`\n📧 Apify JSON outreach (batch ${BATCH} — ${TEMPLATE})\n`);
  console.log(`File:      ${file}`);
  if (ignoreLocalBlocks) {
    console.log(`Mode:      ignore local blocks (sent log has ${sent.size} rows on disk)`);
  } else {
    console.log(`Sent log:  ${sent.size} emails`);
    console.log(`Mkt block: ${marketingBlocked.size}`);
    console.log(`Status block (unsub/dnc): ${statusBlocked.size}`);
  }
  console.log(`To send:   ${leads.length}\n`);

  if (leads.length === 0) {
    console.log("Nothing to send.");
    return;
  }

  if (dry) {
    leads.slice(0, 15).forEach((l, i) => console.log(`[dry] ${i + 1}. ${l.practice.slice(0, 50)} → ${l.email}`));
    if (leads.length > 15) console.log(`[dry] ... +${leads.length - 15} more`);
    console.log("\nDRY RUN — no emails sent.");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const logged: Lead[] = [];
  let failed = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]!;
    const { subject, html } = buildEmail(lead.greeting, lead.email);
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
      if (logged.length <= 5 || logged.length % 25 === 0) {
        console.log(`✅ [${logged.length}/${leads.length}] ${lead.practice.slice(0, 40)} → ${lead.email}`);
      }
    } catch (e) {
      failed++;
      console.error(`❌ ${lead.email}:`, e);
    }
    await delay(220);
  }

  const existing = JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) as {
    sent: Record<string, unknown>[];
  };
  existing.sent = existing.sent ?? [];
  const ts = new Date().toISOString();
  for (const l of logged) {
    existing.sent.push({
      name: l.greeting,
      email: l.email,
      practice: l.practice,
      status: "Sent",
      batch: BATCH,
      template: TEMPLATE,
      sentAt: ts,
    });
  }
  fs.writeFileSync(LOG_PATH, JSON.stringify(existing, null, 2));

  console.log(`\n💾 Logged ${logged.length} sends (failed: ${failed})`);
  console.log(`   Total on record: ${existing.sent.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
