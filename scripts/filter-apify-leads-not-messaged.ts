/**
 * Filter an Apify Google Maps + emails JSON export: drop rows Dentago has already messaged.
 *
 * Removes if:
 * - email was in outbound CRM messages, sent log, or contact has total_messages_sent > 0 / last_contacted_at
 * - normalised practice name matches a previously messaged practice (CRM + sent log)
 *
 * Usage:
 *   npx tsx scripts/filter-apify-leads-not-messaged.ts ~/Downloads/dataset_....json
 *
 * Writes: same directory, suffix _not-messaged.json (+ _messaged-removed.json audit)
 */
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

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
const SENT_LOG = path.join(DOWNLOADS, "dentago-sent-all.json");

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadSentLog(): { emails: Set<string>; practices: Set<string> } {
  const emails = new Set<string>();
  const practices = new Set<string>();
  if (!fs.existsSync(SENT_LOG)) return { emails, practices };
  try {
    const data = JSON.parse(fs.readFileSync(SENT_LOG, "utf8")) as {
      sent?: { practice?: string; email?: string }[];
    };
    for (const row of data.sent ?? []) {
      if (row.email) emails.add(String(row.email).toLowerCase());
      if (row.practice) practices.add(normName(row.practice));
    }
  } catch {
    /* ignore */
  }
  return { emails, practices };
}

async function loadMessagedEmailsFromCrm(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  const emails = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("contacts")
      .select("email, total_messages_sent, last_contacted_at")
      .not("email", "is", null)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`contacts: ${error.message}`);
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const messaged =
        (row.total_messages_sent ?? 0) > 0 || Boolean(row.last_contacted_at);
      const em = row.email?.toLowerCase();
      if (messaged && em) emails.add(em);
    }
    offset += pageSize;
    if (rows.length < pageSize) break;
  }
  return emails;
}

async function loadMessagedPracticeNames(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  const names = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("contacts")
      .select("practice_name, total_messages_sent, last_contacted_at")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`contacts: ${error.message}`);
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const messaged =
        (row.total_messages_sent ?? 0) > 0 || Boolean(row.last_contacted_at);
      if (messaged && row.practice_name) names.add(normName(row.practice_name));
    }
    offset += pageSize;
    if (rows.length < pageSize) break;
  }
  return names;
}

async function loadEmailsWithOutboundMessages(
  supabase: ReturnType<typeof createClient>
): Promise<Set<string>> {
  const contactIds = new Set<string>();
  let offset = 0;
  const lim = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("messages")
      .select("contact_id")
      .eq("direction", "outbound")
      .range(offset, offset + lim - 1);
    if (error) throw new Error(`messages: ${error.message}`);
    const batch = data ?? [];
    if (batch.length === 0) break;
    for (const r of batch) {
      if (r.contact_id) contactIds.add(r.contact_id);
    }
    offset += lim;
    if (batch.length < lim) break;
  }
  const emails = new Set<string>();
  const ids = [...contactIds];
  const chunk = 300;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await supabase.from("contacts").select("email").in("id", slice);
    if (error) throw new Error(`contacts batch: ${error.message}`);
    for (const r of data ?? []) {
      const e = r.email?.toLowerCase();
      if (e) emails.add(e);
    }
  }
  return emails;
}

type LeadRow = {
  name?: string;
  email?: string | null;
  phone?: string;
  website?: string;
  address?: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  category?: string;
  [k: string]: unknown;
};

type RemovalReason = "email_messaged" | "practice_messaged";

async function main() {
  const inPath = process.argv[2];
  if (!inPath || !fs.existsSync(inPath)) {
    console.error("Usage: npx tsx scripts/filter-apify-leads-not-messaged.ts /path/to/dataset.json");
    process.exit(1);
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!sbUrl || !sbKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(sbUrl, sbKey);
  const sentLog = loadSentLog();
  const [crmMessagedEmails, outboundEmails, messagedPractices] = await Promise.all([
    loadMessagedEmailsFromCrm(supabase),
    loadEmailsWithOutboundMessages(supabase),
    loadMessagedPracticeNames(supabase),
  ]);

  const messagedEmails = new Set<string>([
    ...crmMessagedEmails,
    ...outboundEmails,
    ...sentLog.emails,
  ]);
  const messagedPracticeNames = new Set<string>([...messagedPractices, ...sentLog.practices]);

  console.log(`Messaged emails (CRM activity + outbound + sent log): ${messagedEmails.size}`);
  console.log(`Messaged practice names (CRM + sent log):           ${messagedPracticeNames.size}\n`);

  const raw = JSON.parse(fs.readFileSync(inPath, "utf8")) as LeadRow[];
  if (!Array.isArray(raw)) {
    console.error("Expected JSON array");
    process.exit(1);
  }

  const kept: LeadRow[] = [];
  const removed: Array<{ row: LeadRow; reason: RemovalReason; detail?: string }> = [];

  for (const row of raw) {
    const name = String(row.name ?? "").trim();
    const nn = normName(name);
    const emailRaw = row.email != null ? String(row.email).trim().toLowerCase() : "";
    let drop: RemovalReason | null = null;
    let detail: string | undefined;

    if (emailRaw && messagedEmails.has(emailRaw)) {
      drop = "email_messaged";
      detail = emailRaw;
    } else if (nn && messagedPracticeNames.has(nn)) {
      drop = "practice_messaged";
      detail = name;
    }

    if (drop) removed.push({ row, reason: drop, detail });
    else kept.push(row);
  }

  const dir = path.dirname(inPath);
  const base = path.basename(inPath, path.extname(inPath));
  const outKept = path.join(dir, `${base}_not-messaged.json`);
  const outRemoved = path.join(dir, `${base}_messaged-removed.json`);

  fs.writeFileSync(outKept, JSON.stringify(kept, null, 2), "utf8");
  fs.writeFileSync(
    outRemoved,
    JSON.stringify(
      removed.map((r) => ({
        reason: r.reason,
        detail: r.detail,
        name: r.row.name,
        email: r.row.email,
        website: r.row.website,
      })),
      null,
      2
    ),
    "utf8"
  );

  console.log(`Input rows:    ${raw.length}`);
  console.log(`Kept:          ${kept.length} → ${outKept}`);
  console.log(`Removed:       ${removed.length} → ${outRemoved}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
