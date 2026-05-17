/**
 * Send the "demo-watch" template to every non-client in dentago-sent-all.json.
 *
 * Filters out:
 *   - Emails already sent THIS template (template tag: DemoWatch-AllOutreach-2026-05-01)
 *   - Suppliers (Schottlander, Align Technology, Straumann, Wesleyan, Zenyum, etc.)
 *   - Universities / academic (.ac.uk, specific domains)
 *   - Veterinary practices
 *   - Non-dental companies (BACD is borderline but included as they engage clinics)
 *   - Existing Supabase clinic_profiles users (already signed up)
 *
 * Run:
 *   npx tsx scripts/send-demowatch-followup-all.ts --dry-run
 *   npx tsx scripts/send-demowatch-followup-all.ts
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

const FROM = "mercier@dentago.co.uk";
const FROM_NAME = "Mercier @ Dentago";
const TEMPLATE_TAG = "DemoWatch-AllOutreach-2026-05-01";
const DOWNLOADS = path.join(process.env.HOME ?? "", "Downloads");
const LOG_PATH = path.join(DOWNLOADS, "dentago-sent-all.json");

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Exclusion lists ────────────────────────────────────────────────────────

/** Email domains to exclude (universities, irrelevant B2B) */
const EXCLUDE_DOMAINS = new Set([
  "qmul.ac.uk",
  "uclan.ac.uk",
  "kcl.ac.uk",
  "aligntech.com",       // Align Technology — manufacturer/supplier
  "straumann.com",       // Straumann — manufacturer/supplier
  "schottlander.co.uk",  // Schottlander — manufacturer/supplier
  "wesleyan.co.uk",      // Wesleyan — financial services
  "zenyum.com",          // Zenyum — dental tech company
  "andersonmoores.com",  // Veterinary
]);

/** Company/practice name fragments that indicate supplier, university, or non-clinic */
const EXCLUDE_PRACTICE_RE =
  /(straumann|align tech|schottlander|wesleyan|zenyum|anderson moores|veterinar|university|college|uclan|qmul|king's college)/i;

/** .ac.uk catch-all for any remaining academic emails */
function isAcademic(email: string): boolean {
  return email.endsWith(".ac.uk");
}


interface SentRecord {
  email?: string;
  template?: string;
  sentAt?: string;
  name?: string;
  practice?: string;
  batch?: number | string;
  status?: string;
}

function loadLog(): { sent: SentRecord[] } {
  if (!fs.existsSync(LOG_PATH)) return { sent: [] };
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as {
      sent: SentRecord[];
    };
  } catch {
    return { sent: [] };
  }
}

/** All unique emails that already received THIS template */
function alreadySentThisTemplate(log: { sent: SentRecord[] }): Set<string> {
  const sent = new Set<string>();
  for (const r of log.sent) {
    if (r.template === TEMPLATE_TAG && r.email) {
      sent.add(r.email.toLowerCase().trim());
    }
  }
  return sent;
}

/** All unique emails in the sent log (for dedup — we want exactly one address per person) */
function allSentEmails(log: { sent: SentRecord[] }): {
  email: string;
  name: string;
  practice: string;
}[] {
  // Build a deduped map: email → best record (prefer ones with a real name)
  const map = new Map<string, { email: string; name: string; practice: string }>();
  for (const r of log.sent) {
    const email = (r.email ?? "").toLowerCase().trim();
    if (!email) continue;
    const existing = map.get(email);
    const name = r.name ?? "";
    const practice = r.practice ?? "";
    if (!existing || (name && !existing.name)) {
      map.set(email, { email, name, practice });
    }
  }
  return Array.from(map.values());
}

// ─── Template ───────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function greeting(name: string, email: string): string {
  const firstName = name?.split(" ")[0]?.trim();
  if (firstName && firstName.length >= 2 && firstName.length <= 30) {
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }
  // Try to extract from email: j.smith@clinic.com → Smith
  const local = (email.split("@")[0] ?? "").split("+")[0] ?? "";
  const m = local.match(/^([a-z])\./i);
  if (m) {
    const rest = local.slice(2).replace(/[^a-z]/gi, "");
    if (rest.length >= 3)
      return rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase();
  }
  return "there";
}

function buildSubject(practice: string): string {
  const trimmed = (practice ?? "").trim();
  if (!trimmed || trimmed.length < 3) return "ordering week still = five tabs?";
  const max = 42;
  const label = trimmed.length > max ? trimmed.slice(0, max - 1).trimEnd() + "…" : trimmed;
  return `${label} — ordering week still = five tabs?`;
}

function buildHtml(greet: string): string {
  return `
<p>Hi ${escapeHtml(greet)},</p>

<p>Cold emails usually mean someone wants <strong>money from the practice</strong> — fair assumption — so I'll say this first: <strong>Dentago is free for dental practices.</strong> No subscription, no card, nothing invoiced by us on the clinic side.</p>

<p>I'm writing because what we hear from managers isn't a minor tweak to ordering; it's <strong>meaningful weekly time</strong> burned across separate supplier portals, carts that don't line up, confirmations scattered across inboxes, and the nagging doubt someone already ordered the same SKU — plus spend that's harder to oversee than it should be. That competes directly with patient-facing work and proper financial control — not because teams are behind, but because almost nobody built tooling for multi-supplier dental buying.</p>

<p>If that resonates, Dentago is UK-built for exactly that: <strong>one workflow</strong> to search and check out across distributors you already use, with <strong>practice verification</strong> before orders go through — how UK clinics actually buy, not a generic consumer checkout.</p>

<p><strong>~2 minute walkthrough</strong>, no signup:</p>

<p><a href="https://www.dentago.co.uk/watch">https://www.dentago.co.uk/watch</a></p>

<p>If it doesn't match how you run procurement, ignore me; if it does, from there you'll be able to book a demo. And if even that takes too much time, just reply &quot;Yes&quot; and we'll get you onboarded via email.</p>

<p>Mercier<br/>
Founder, Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dry = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srk) {
    console.warn("⚠️  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — client dedup disabled");
  }

  if (!dry && !process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing in .env.local / .env");
    process.exit(1);
  }

  console.log("\n📬 Loading sent log…");
  const log = loadLog();
  const alreadySent = alreadySentThisTemplate(log);
  const allContacts = allSentEmails(log);

  console.log(`   Total unique emails in log: ${allContacts.length}`);
  console.log(`   Already sent this template: ${alreadySent.size}`);

  console.log("\n🔍 Fetching marketing exclusions (signups + CRM flag)…");
  const clientEmails =
    url && srk
      ? await fetchColdMarketingExcludedEmails(createClient(url, srk), url, srk)
      : new Set<string>();
  console.log(`   Existing clients: ${clientEmails.size}`);

  // Filter
  const toSend: { email: string; name: string; practice: string }[] = [];
  const skipReasons: Record<string, number> = {
    already_sent_template: 0,
    existing_client: 0,
    supplier: 0,
    academic: 0,
    invalid_email: 0,
  };

  for (const c of allContacts) {
    const email = c.email.toLowerCase().trim();
    if (!email || !email.includes("@")) {
      skipReasons.invalid_email++;
      continue;
    }
    if (alreadySent.has(email)) {
      skipReasons.already_sent_template++;
      continue;
    }
    if (clientEmails.has(email)) {
      skipReasons.existing_client++;
      continue;
    }
    const domain = email.split("@")[1] ?? "";
    if (EXCLUDE_DOMAINS.has(domain) || isAcademic(email)) {
      skipReasons.academic++;
      continue;
    }
    if (EXCLUDE_PRACTICE_RE.test(c.practice)) {
      skipReasons.supplier++;
      continue;
    }
    toSend.push(c);
  }

  console.log(`\n📊 Filter results:`);
  for (const [reason, count] of Object.entries(skipReasons)) {
    if (count > 0) console.log(`   Skip (${reason}): ${count}`);
  }
  console.log(`   → Sending to: ${toSend.length}\n`);

  if (toSend.length === 0) {
    console.log("Nothing to send.");
    return;
  }

  if (dry) {
    console.log("DRY RUN — first 20 recipients:");
    toSend.slice(0, 20).forEach((c, i) =>
      console.log(`  ${i + 1}. ${(c.practice || "—").slice(0, 45)} → ${c.email} (Hi ${greeting(c.name, c.email)})`)
    );
    if (toSend.length > 20) console.log(`  … and ${toSend.length - 20} more`);
    console.log("\nRun without --dry-run to send.");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const logged: typeof toSend = [];
  let failed = 0;
  const ts = new Date().toISOString();

  for (let i = 0; i < toSend.length; i++) {
    const c = toSend[i];
    const greet = greeting(c.name, c.email);
    const subject = buildSubject(c.practice);
    const html = buildHtml(greet);

    try {
      const { error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM}>`,
        to: c.email,
        subject,
        html,
        replyTo: FROM,
        headers: {
          "List-Unsubscribe": `<mailto:${FROM}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      if (error) throw new Error(JSON.stringify(error));
      logged.push(c);
      if (logged.length <= 10 || logged.length % 100 === 0) {
        console.log(`✅ [${logged.length}/${toSend.length}] ${c.email}`);
      }
    } catch (e) {
      failed++;
      console.error(`❌ ${c.email}:`, e);
    }

    await delay(220);
  }

  // Append to log
  for (const c of logged) {
    log.sent.push({
      name: c.name,
      email: c.email,
      practice: c.practice,
      status: "Sent",
      batch: "demowatch-followup-all",
      template: TEMPLATE_TAG,
      sentAt: ts,
    });
  }
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

  console.log(`\n✅ Done`);
  console.log(`   Sent:   ${logged.length}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total in log: ${log.sent.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
