/**
 * OS outreach — CRM contacts with no outbound email for ≥ N days (default 7).
 * Source of truth matches dentago/os Outreach tab (`contacts` in Supabase).
 *
 * HARD GUARD: Never email anyone on `clinic_accounts` or Supabase Auth (signup),
 * even if their CRM `contacts` row still says `lead` (e.g. after Resend sync).
 * Also skips CRM status client / demo_booked and type `clinic`.
 *
 * Each send updates: messages, contacts.last_contacted_at, and logs `events`
 * (`outreach_sent` per row + final `loop_completed` summary).
 *
 * Optional Resend reconcile: pulls recent outbound from Resend and builds a
 * "last emailed" hint by recipient (does not mutate DB). Helps when CRM
 * messages lag behind live Resend sends.
 *
 * Run:
 *   npx tsx scripts/os-outreach-contacts-stale.ts --dry-run
 *   npx tsx scripts/os-outreach-contacts-stale.ts
 *   npx tsx scripts/os-outreach-contacts-stale.ts --days=14
 *   npx tsx scripts/os-outreach-contacts-stale.ts --hint-resend  # merges Resend recency hints
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
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

const DRY_RUN = process.argv.includes("--dry-run");
const HINT_RESEND = process.argv.includes("--hint-resend");
const DAYS = (() => {
  const raw = process.argv.find((a) => a.startsWith("--days="))?.slice("--days=".length);
  const n = raw ? parseInt(raw, 10) : 7;
  return Number.isFinite(n) && n > 0 ? n : 7;
})();

const FROM = "mercier@dentago.co.uk";
const FROM_DISPLAY = "Mercier @ Dentago";
/** Logged per send + dedupe audits */
const TEMPLATE = "OS-RecontactStale7d-2026-04-30";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isValidEmail(email: string): boolean {
  if (!email?.includes("@")) return false;
  if (/%|\+{2}|\.{3}/i.test(email)) return false;
  const local = email.split("@")[0] ?? "";
  const domain = email.split("@")[1] ?? "";
  if (!domain.includes(".") && domain !== "nhs.net" && domain !== "nhs.uk") return false;
  if (/\.(webp|png|jpg|gif|svg)$/i.test(domain)) return false;
  if (email.includes("..") || local.startsWith(".")) return false;
  return true;
}

function parseIso(d: string | null | undefined): number | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
}

/** Last outbound touch used for staleness — max(CRM outbound messages, contacts.last_contacted_at) */
function effectiveLastSent(
  messagesAt: number | null,
  contactedAt: number | null,
  resendHint: number | null
): number | null {
  const candidates = [messagesAt, contactedAt, resendHint].filter(
    (x): x is number => x != null
  );
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function firstName(full: string | undefined, email: string): string {
  if (full && full.trim()) {
    const p = full.trim().split(/\s+/)[0] ?? "";
    if (p.length >= 2 && p.length <= 30) return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }
  const local = (email.split("@")[0] ?? "").split("+")[0] ?? "";
  if (local.length >= 3) return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
  return "there";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmail(greet: string, practiceHint: string): { subject: string; html: string; text: string } {
  const hint = practiceHint?.trim().slice(0, 52);
  const subject =
    hint.length >= 3 ? `${hint} — quick Dentago catch-up` : "Quick follow-up from Dentago";
  const html = `
<p>Hi ${escapeHtml(greet)},</p>

<p>I wanted to check in briefly — it's been over a week since we last emailed from this side.</p>

<p>If multi-supplier ordering is still a pain (separate portals, prices hard to compare), <strong>Dentago</strong> is free for UK practices: one workflow across distributors you already use. Here's a ~2&nbsp;minute walkthrough, no signup required:</p>

<p><a href="https://www.dentago.co.uk/watch">https://www.dentago.co.uk/watch</a></p>

<p>If the timing isn't right, no problem — reply "no thanks" and I won't chase.</p>

<p>Mercier<br/>
Founder, Dentago<br/>
<a href="https://www.dentago.co.uk">www.dentago.co.uk</a></p>
`.trim();
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { subject, html, text };
}

const SKIP_STATUS = new Set([
  "unsubscribed",
  "do_not_contact",
  "client",
  "demo_booked", // in active sales / booked — do not cold-blitz
]);

/** Non-prospects; "clinic" = verified / on-platform customer in CRM taxonomy */
const SKIP_TYPES = new Set(["supplier", "journalist", "investor", "clinic"]);

const BLOCK_EMAIL_DOMAINS = new Set([
  "dentago.co.uk",
  "bbc.co.uk",
  "aligntech.com",
  "straumann.com",
  "schottlander.co.uk",
  "wesleyan.co.uk",
  "zenyum.com",
  "andersonmoores.com",
  "dhb.co.uk",
  "medisave.co.uk",
  "trycare.co.uk",
  "henryschein.co.uk",
  "henryschein.com",
  "kentexpress.co.uk",
  "nphd.co.uk",
  "dentistry.co.uk",
  "ddgroup.com",
  "ddgroup.co.uk",
  "dwseal.com",
  "qmul.ac.uk",
  "uclan.ac.uk",
  "kcl.ac.uk",
]);

const EXCLUDE_CONTACT_NAME_RE =
  /(henry\s*schein|kent\s*express|medisave|trycare|national\s*dental\s*hub|supplier|manufacturer|university\s*of|bbc\b)/i;

function shouldSkipColdOutreach(contact: ContactRow, emailLower: string): string | null {
  if (emailLower.startsWith("editorial@")) return "editorial_media";
  const domain = emailLower.split("@")[1] ?? "";
  if (BLOCK_EMAIL_DOMAINS.has(domain)) return "blocked_domain";
  if (emailLower.endsWith(".ac.uk")) return "academic";
  const t = (contact.type ?? "").toLowerCase();
  if (t && SKIP_TYPES.has(t)) return "non_lead_type";
  const label = `${contact.practice_name ?? ""} ${contact.name ?? ""}`;
  if (EXCLUDE_CONTACT_NAME_RE.test(label)) return "supplier_or_misc_name";
  return null;
}

interface ContactRow {
  id: string;
  email: string | null;
  name?: string | null;
  practice_name?: string | null;
  status: string | null;
  type: string | null;
  last_contacted_at?: string | null;
  total_messages_sent?: number | null;
  marketing_opt_out?: boolean | null;
}

async function fetchAllContacts(supabase: ReturnType<typeof createClient>): Promise<ContactRow[]> {
  const PAGE = 1000;
  const out: ContactRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, email, name, practice_name, status, type, last_contacted_at, total_messages_sent, marketing_opt_out")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...(data as ContactRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

/** Max outbound email sent_at per contact_id */
async function buildLastOutboundEmailMap(
  supabase: ReturnType<typeof createClient>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("messages")
      .select("contact_id, sent_at")
      .eq("channel", "email")
      .eq("direction", "outbound")
      .neq("status", "failed")
      .order("sent_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data as { contact_id: string; sent_at: string }[]) {
      const cur = map.get(row.contact_id);
      if (!cur || parseIso(row.sent_at)! > parseIso(cur)!) map.set(row.contact_id, row.sent_at);
    }
    from += PAGE;
    if (data.length < PAGE) break;
  }
  return map;
}

async function fetchResendLastByEmail(daysLookback = 120): Promise<Map<string, string>> {
  const key = process.env.RESEND_API_KEY!;
  const map = new Map<string, string>();
  let cursor: string | null = null;
  const cutoff = Date.now() - daysLookback * 86400000;
  for (let guard = 0; guard < 500; guard++) {
    const q = cursor
      ? `?limit=100&after=${encodeURIComponent(cursor)}`
      : "?limit=100";
    const res = await fetch(`https://api.resend.com/emails${q}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.warn("Resend list API:", res.status, await res.text());
      break;
    }
    const json = (await res.json()) as {
      data?: { id: string; to?: string[]; created_at?: string }[];
      has_more?: boolean;
    };
    const rows = json.data ?? [];
    let allOlderThanCutoff = true;
    for (const r of rows) {
      const to = Array.isArray(r.to) ? r.to[0]?.toLowerCase().trim() : "";
      const ts = r.created_at ?? "";
      const ms = parseIso(ts);
      if (!to || ms == null) continue;
      if (ms >= cutoff) {
        allOlderThanCutoff = false;
        const cur = map.get(to);
        if (!cur || parseIso(ts)! > parseIso(cur)!) map.set(to, ts);
      }
    }
    if (!json.has_more || rows.length === 0 || allOlderThanCutoff) break;
    cursor = rows[rows.length - 1]?.id ?? null;
    if (!cursor) break;
    await delay(80);
  }
  return map;
}

async function logEventDb(
  supabase: ReturnType<typeof createClient>,
  row: {
    event_type: string;
    entity_type?: string | null;
    entity_id?: string | null;
    payload?: Record<string, unknown>;
    source?: string;
  }
) {
  const { error } = await supabase.from("events").insert({
    event_type: row.event_type,
    entity_type: row.entity_type ?? null,
    entity_id: row.entity_id ?? null,
    payload: row.payload ?? {},
    metrics: {},
    kpi_impact: {},
    source: row.source ?? "script:os-outreach-contacts-stale",
  });
  if (error) console.error("[events]", error.message);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srv) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }
  if (HINT_RESEND && !process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY required when using --hint-resend.");
    process.exit(1);
  }
  if (!DRY_RUN && !process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing.");
    process.exit(1);
  }

  const supabase = createClient(url, srv);
  const threshold = Date.now() - DAYS * 86400000;

  console.log(`\nOS stale outreach — CRM contacts · silence ≥ ${DAYS} days\n`);

  console.log("Loading registered clinic / auth emails (never cold-email)…");
  const excludedEmails = await fetchColdMarketingExcludedEmails(supabase, url, srv);
  console.log(`   Excluded (signups + CRM marketing_opt_out): ${excludedEmails.size}\n`);

  console.log("Loading outbound email map…");
  const outboundMap = await buildLastOutboundEmailMap(supabase);

  let resendByEmail = new Map<string, string>();
  if (HINT_RESEND) {
    if (!process.env.RESEND_API_KEY) console.warn("(skip Resend hints — no RESEND_API_KEY)");
    else {
      console.log("Fetching Resend send history hints…");
      resendByEmail = await fetchResendLastByEmail(180);
      console.log(`   Resend unique recipient hints: ${resendByEmail.size}`);
    }
  }

  const contacts = await fetchAllContacts(supabase);
  const eligible: ContactRow[] = [];

  for (const c of contacts) {
    const email = (c.email ?? "").toLowerCase().trim();
    if (!email || !isValidEmail(email)) continue;
    if (SKIP_STATUS.has((c.status ?? "").toLowerCase())) continue;
    const skipReason = shouldSkipColdOutreach(c, email);
    if (skipReason) continue;
    if (c.marketing_opt_out) continue;
    if (excludedEmails.has(email)) continue;

    const lm = outboundMap.get(c.id) ?? null;
    const resendTs = resendByEmail.get(email) ?? null;
    const eff = effectiveLastSent(parseIso(lm), parseIso(c.last_contacted_at ?? null), parseIso(resendTs));

    if (eff != null && eff > threshold) continue;
    eligible.push({ ...c, email });
  }

  console.log(`Total CRM contacts fetched: ${contacts.length}`);
  console.log(`Eligible (silent ≥ ${DAYS}d · not client/signup/clinic-type/unsub/etc.): ${eligible.length}\n`);

  if (eligible.length === 0) {
    await logEventDb(supabase, {
      event_type: "loop_completed",
      payload: {
        loop: "os_outreach_contacts_stale",
        days: DAYS,
        template: TEMPLATE,
        eligible: 0,
        dry_run: DRY_RUN,
      },
      source: "script:os-outreach-contacts-stale",
    });
    return;
  }

  if (DRY_RUN) {
    console.log("DRY RUN — first 25:");
    eligible.slice(0, 25).forEach((c, i) => {
      const greet = firstName((c.name ?? c.practice_name) ?? "", c.email!);
      const { subject } = buildEmail(greet, c.practice_name ?? c.name ?? "");
      console.log(`  ${i + 1}. ${c.email} | ${subject.slice(0, 55)}`);
    });
    if (eligible.length > 25) console.log(`  … +${eligible.length - 25} more`);
    console.log("\nRun without --dry-run to send + log to OS.\n");

    await logEventDb(supabase, {
      event_type: "loop_completed",
      payload: {
        loop: "os_outreach_contacts_stale",
        phase: "dry_run",
        days: DAYS,
        template: TEMPLATE,
        would_send: eligible.length,
      },
      source: "script:os-outreach-contacts-stale",
    });
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < eligible.length; i++) {
    const c = eligible[i];
    const email = c.email!;
    const greet = firstName((c.name ?? c.practice_name) ?? "", email);
    const { subject, html, text } = buildEmail(greet, c.practice_name ?? c.name ?? "");

    try {
      const { data, error } = await resend.emails.send({
        from: `${FROM_DISPLAY} <${FROM}>`,
        to: email,
        subject,
        html,
        text,
        replyTo: FROM,
        headers: {
          "List-Unsubscribe": `<mailto:${FROM}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      if (error) throw new Error(JSON.stringify(error));

      const resendId = data?.id ?? null;
      const nowIso = new Date().toISOString();

      await supabase.from("messages").insert({
        contact_id: c.id,
        channel: "email",
        direction: "outbound",
        subject,
        body: text,
        body_html: html,
        status: "sent",
        metadata: { resend_id: resendId, template: TEMPLATE },
        sent_at: nowIso,
      });

      await supabase
        .from("contacts")
        .update({
          last_contacted_at: nowIso,
          last_message_preview: subject.slice(0, 140),
          total_messages_sent: (c.total_messages_sent ?? 0) + 1,
          updated_at: nowIso,
        })
        .eq("id", c.id);

      await logEventDb(supabase, {
        event_type: "outreach_sent",
        entity_type: "contact",
        entity_id: c.id,
        payload: {
          email,
          subject,
          template: TEMPLATE,
          resend_id: resendId,
          stale_days_gate: DAYS,
        },
      });

      sent++;
      if (sent <= 10 || sent % 50 === 0) console.log(`✅ [${sent}/${eligible.length}] ${email}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${email}:`, e);
    }

    await delay(230);
    c.total_messages_sent = (c.total_messages_sent ?? 0) + 1;
  }

  await logEventDb(supabase, {
    event_type: "loop_completed",
    payload: {
      loop: "os_outreach_contacts_stale",
      days: DAYS,
      template: TEMPLATE,
      sent,
      failed,
      total_targets: eligible.length,
      hint_resend: HINT_RESEND,
    },
    source: "script:os-outreach-contacts-stale",
    metrics: { sent, failed },
  });

  console.log(`\n=== OS log complete ===\nSent: ${sent}\nFailed: ${failed}\nEvents: outreach_sent × ${sent} + loop_completed summary`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
