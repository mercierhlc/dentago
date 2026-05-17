/**
 * New Google Maps dental outreach — dedupes against ~/Downloads/dentago-sent-all.json
 * Sources (in order): Apr 29 contact details → Apr 20 contact details → fast scraper Apr 16
 *
 *   npx tsx scripts/send-outreach-googlemaps-new.ts --limit=500
 *   npx tsx scripts/send-outreach-googlemaps-new.ts --limit=500 --dry-run
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

const BATCH = 12;
const TEMPLATE = "Batch12-GoogleMapsNew";

const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";
const DOWNLOADS = path.join(process.env.HOME ?? "", "Downloads");
const LOG_PATH = path.join(DOWNLOADS, "dentago-sent-all.json");

const FILES = {
  contactApr29: path.join(
    DOWNLOADS,
    "dataset_google-maps-with-contact-details_2026-04-29_18-24-58-902.csv"
  ),
  contactApr20: path.join(
    DOWNLOADS,
    "dataset_google-maps-with-contact-details_2026-04-20_00-35-35-834.csv"
  ),
  fastApr16: path.join(
    DOWNLOADS,
    "dataset_google-maps-email-leads-fast-scraper_2026-04-16_23-02-11-503.csv"
  ),
};

const DENTAL_TITLE_RE =
  /(dental|dentist|orthodont|\bdmd\b|teeth|smile|oral surgery|implant|periodont|perio\b|endo\b|ortho\b|braces?)/i;

/** Side businesses that mention "dentist" but aren't practices */
const EXCLUDE_TITLE_RE =
  /(accountant|accountancy|bookkeeping|marketing|seo\b|web design|consultancy|software|supplier|wholesale|training course|recruitment)/i;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  if (!fs.existsSync(filePath)) {
    console.warn(`Missing CSV (skip): ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const firstLine = lines[0].replace(/^\uFEFF/, "");
  const result: Record<string, string>[] = [];
  const headers = parseCSVLine(firstLine);
  for (const line of lines.slice(1)) {
    const vals = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h.replace(/^\uFEFF/, "")] = (vals[i] ?? "").trim();
    });
    result.push(row);
  }
  return result;
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
  ];
  if (junk.some((j) => e.includes(j))) return false;
  return true;
}

function loadSentEmails(): Set<string> {
  if (!fs.existsSync(LOG_PATH)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
    return new Set(
      (data.sent ?? []).map((s: { email: string }) =>
        String(s.email).toLowerCase()
      )
    );
  } catch {
    return new Set();
  }
}

interface Lead {
  email: string;
  name: string;
  practice: string;
}

function buildEmail(name: string): { subject: string; html: string } {
  const greeting =
    name && name.toLowerCase() !== "there" ? name : "there";
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
<img src="https://www.dentago.co.uk/api/track/open?e=${encodeURIComponent(email)}&b=gm" width="1" height="1" style="display:none" />
`.trim();
  return { subject, html };
}

function dentalFastRow(row: Record<string, string>): boolean {
  if (DENTAL_TITLE_RE.test(row.name ?? "")) return true;
  const cat = row.google_business_categories ?? "";
  return DENTAL_TITLE_RE.test(cat);
}

function collectLeads(limit: number, sent: Set<string>): Lead[] {
  const seen = new Set<string>();
  const leads: Lead[] = [];

  const push = (email: string, name: string, practice: string) => {
    const em = email.toLowerCase();
    if (!isValidEmail(em) || sent.has(em) || seen.has(em)) return;
    seen.add(em);
    leads.push({ email: em, name, practice });
  };

  const drainContact = (rows: Record<string, string>[]) => {
    for (const row of rows) {
      if (leads.length >= limit) return;
      const title = row.title ?? "";
      if (!DENTAL_TITLE_RE.test(title)) continue;
      if (EXCLUDE_TITLE_RE.test(title)) continue;
      for (let i = 0; i <= 11; i++) {
        const raw = row[`emails/${i}`]?.trim() ?? "";
        if (!raw) continue;
        const email = raw.toLowerCase();
        if (!isValidEmail(email)) continue;
        push(email, "there", title);
        break;
      }
    }
  };

  drainContact(parseCSV(FILES.contactApr29));
  drainContact(parseCSV(FILES.contactApr20));

  if (leads.length < limit) {
    const fastRows = parseCSV(FILES.fastApr16);
    for (const row of fastRows) {
      if (leads.length >= limit) break;
      const practice = row.name?.trim() ?? "";
      if (EXCLUDE_TITLE_RE.test(practice)) continue;
      if (!dentalFastRow(row)) continue;
      const email = (row.email ?? "").trim().toLowerCase();
      if (!isValidEmail(email)) continue;
      push(email, "there", practice);
    }
  }

  return leads.slice(0, limit);
}

function parseArgs() {
  let limit = 500;
  let dry = false;
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") dry = true;
    else if (a.startsWith("--limit=")) {
      const n = parseInt(a.split("=")[1], 10);
      if (!Number.isNaN(n) && n > 0) limit = n;
    }
  }
  return { limit, dry };
}

async function main() {
  const { limit, dry } = parseArgs();
  if (!dry && !process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing in .env.local / .env");
    process.exit(1);
  }

  const sent = loadSentEmails();
  const leads = collectLeads(limit, sent);

  console.log(
    `\n📧 Google Maps new outreach — up to ${limit} leads (batch ${BATCH})\n`
  );
  console.log(`Already in sent log: ${sent.size}`);
  console.log(`New leads to send:   ${leads.length}\n`);
  if (leads.length === 0) {
    console.log("Nothing to send.");
    return;
  }

  if (leads.length < limit) {
    console.warn(
      `⚠️  Only ${leads.length} untapped dental+email rows in current Google Maps CSVs (under ${limit}).`
    );
    console.warn(
      "    Import another Maps export into ~/Downloads to reach the limit.\n"
    );
  }

  if (dry) {
    leads.slice(0, 8).forEach((l, i) =>
      console.log(`[dry] ${i + 1}. ${l.practice} → ${l.email}`)
    );
    if (leads.length > 8) console.log(`[dry] ... +${leads.length - 8} more`);
    console.log("\nDRY RUN — no emails sent.");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const logged: Lead[] = [];
  let failed = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const { subject, html } = buildEmail(lead.name);
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
      if (logged.length % 25 === 0 || logged.length <= 5) {
        console.log(
          `✅ [${logged.length}/${leads.length}] ${lead.practice.slice(0, 40)} → ${lead.email}`
        );
      }
    } catch (e) {
      failed++;
      console.error(`❌ ${lead.email}:`, e);
    }
    await delay(220);
  }

  const existing = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as {
    sent: Record<string, unknown>[];
  };
  existing.sent = existing.sent ?? [];
  const ts = new Date().toISOString();
  for (const l of logged) {
    existing.sent.push({
      name: l.name,
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
