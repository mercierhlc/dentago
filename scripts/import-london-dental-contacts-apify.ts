/**
 * UK dental clinics → CRM via Apify (Google Maps + website email extraction).
 *
 * Default actor: pheidias0/google-maps-scraper-with-emails (paid; uses your Apify credits).
 *
 * Fetches leads, then only adds contacts you have **not** emailed before:
 * - Skips emails already in `contacts` (already on the list)
 * - Skips emails in ~/Downloads/dentago-sent-all.json
 * - Skips emails that have any **outbound** row in `messages`
 * - Skips practice names previously messaged (CRM + sent log)
 *
 * Multi-region: runs the actor across major UK cities until `--target` net-new rows
 * are queued (or regions exhausted). Use `--location="X"` for a single area only.
 *
 * Env:
 *   APIFY_API_TOKEN        — required (.env.local)
 *   APIFY_ACTOR_ID         — optional, default pheidias0~google-maps-scraper-with-emails
 *   APIFY_MAX_PER_CELL     — max places per grid cell (default 80 if target≥1000 else 45)
 *   APIFY_LOCATION_QUERY   — if set and no --location flag, single-region mode only
 *
 *   npx tsx scripts/import-london-dental-contacts-apify.ts --dry-run
 *   npx tsx scripts/import-london-dental-contacts-apify.ts --target=2000
 *   npx tsx scripts/import-london-dental-contacts-apify.ts --target=500 --location="Manchester, UK"
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

const DEFAULT_ACTOR = "pheidias0~google-maps-scraper-with-emails";

/** Conurbations / cities — one Apify run each (uses credits per run). */
const DEFAULT_UK_REGIONS = [
  "Greater London, UK",
  "Birmingham, UK",
  "Manchester, UK",
  "Leeds, UK",
  "Glasgow, UK",
  "Edinburgh, UK",
  "Liverpool, UK",
  "Bristol, UK",
  "Sheffield, UK",
  "Leicester, UK",
  "Coventry, UK",
  "Cardiff, UK",
  "Belfast, UK",
  "Newcastle upon Tyne, UK",
  "Nottingham, UK",
  "Southampton, UK",
  "Brighton, UK",
  "Kingston upon Hull, UK",
  "Plymouth, UK",
  "Stoke-on-Trent, UK",
  "Wolverhampton, UK",
  "Derby, UK",
  "Portsmouth, UK",
  "Northampton, UK",
  "Reading, UK",
  "Swansea, UK",
  "Oxford, UK",
  "Cambridge, UK",
  "York, UK",
  "Norwich, UK",
  "Exeter, UK",
  "Aberdeen, UK",
  "Dundee, UK",
];

const EXCLUDE_NAME_RE =
  /(accountant|accountancy|marketing|\bseo\b|digital agency|web design|software|supplier|wholesale|dental lab|laboratory|training course|recruitment|insurance|solicitor)/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  if (!e || !e.includes("@")) return false;
  const domain = e.split("@")[1] ?? "";
  if (!domain.includes(".") && !/^(nhs\.net|nhs\.uk)$/i.test(domain)) return false;
  if (!/\.[a-z]{2,}$/i.test(domain)) return false;
  if (e.startsWith("//") || e.includes("..")) return false;
  if (/\.(webp|png|jpg|gif|svg)$/i.test(domain)) return false;
  const junk = [
    "example.com", "test@", "noreply", "sentry", "schema.org", "w3.org",
    "wixpress.com", "squarespace.com", "google.com", "facebook.com", "instagram.com",
    "twitter.com", "linkedin.com", "youtube.com", "pinterest.com", "tiktok.com",
  ];
  if (junk.some((j) => e.includes(j))) return false;
  return true;
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

function fallbackDomainEmail(website: string): string | null {
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    let host = u.hostname.replace(/^www\./, "");
    if (!host.includes(".")) return null;
    for (const local of ["reception", "info", "enquiries", "hello", "contact", "office", "team"]) {
      const em = `${local}@${host}`;
      if (isValidEmail(em)) return em;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function harvestEmailFromWebsite(website: string): Promise<string | null> {
  if (!website?.trim()) return null;
  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return fallbackDomainEmail(url);
    const html = await res.text();
    for (const m of html.matchAll(/mailto:([^"'>\s]+)/gi)) {
      const raw = decodeURIComponent(m[1].split("?")[0].trim());
      if (isValidEmail(raw)) return raw.toLowerCase();
    }
    const seen = new Set<string>();
    for (const m of html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
      const e = m[0].toLowerCase();
      if (seen.has(e)) continue;
      seen.add(e);
      if (!isValidEmail(e)) continue;
      if (/\.(png|jpg|gif|webp)$/i.test(e)) continue;
      return e;
    }
  } catch {
    /* timeout / blocked */
  }
  return fallbackDomainEmail(url);
}

function pickEmailFromRow(row: Record<string, unknown>): string | null {
  const bag = [row.email, row.primaryEmail, row.contactEmail, row.contact_email, row.Emails, row.emails];
  for (const v of bag) {
    if (typeof v === "string") {
      for (const part of v.split(/[,;\s]+/)) {
        const e = part.trim().toLowerCase();
        if (isValidEmail(e)) return e;
      }
    }
    if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x !== "string") continue;
        const e = x.trim().toLowerCase();
        if (isValidEmail(e)) return e;
      }
    }
  }
  return null;
}

function pickName(row: Record<string, unknown>): string {
  const n = row.title ?? row.name ?? row.placeName ?? row.place_name ?? "";
  return String(n ?? "").trim();
}

function pickPhone(row: Record<string, unknown>): string | null {
  const p = row.phone ?? row.phoneNumber ?? row.phoneUnformatted ?? "";
  const s = String(p ?? "").trim().split(/[;/]/)[0]?.trim();
  return s || null;
}

function pickAddress(row: Record<string, unknown>): string | null {
  const str =
    row.addressString ?? row.fullAddress ?? (typeof row.address === "string" ? row.address : null);
  if (typeof str === "string" && str.trim()) return str.trim().slice(0, 200);
  const addr = row.address;
  if (addr && typeof addr === "object") {
    const o = addr as Record<string, string>;
    const bits = [o.street, o.city, o.postalCode].filter(Boolean);
    if (bits.length) return bits.join(", ").slice(0, 200);
  }
  return null;
}

function pickWebsite(row: Record<string, unknown>): string | null {
  const w = row.website ?? row.url ?? "";
  const s = String(w ?? "").trim().split(/[;]/)[0]?.trim();
  return s || null;
}

async function loadCrmContactEmails(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  const emails = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("contacts")
      .select("email")
      .not("email", "is", null)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`contacts select: ${error.message}`);
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const em = row.email?.toLowerCase();
      if (em) emails.add(em);
    }
    offset += pageSize;
    if (rows.length < pageSize) break;
  }
  return emails;
}

async function loadMessagedPracticeNames(
  supabase: ReturnType<typeof createClient>
): Promise<Set<string>> {
  const names = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("contacts")
      .select("practice_name, total_messages_sent, last_contacted_at")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`contacts select: ${error.message}`);
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
    if (error) throw new Error(`messages select: ${error.message}`);
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
    if (error) throw new Error(`contacts id batch: ${error.message}`);
    for (const r of data ?? []) {
      const e = r.email?.toLowerCase();
      if (e) emails.add(e);
    }
  }
  return emails;
}

async function apifyGet<T>(path: string, token: string): Promise<T> {
  const u = new URL(path);
  u.searchParams.set("token", token);
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Apify ${res.status}: ${t.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

async function apifyPostJson<T>(path: string, token: string, body: object): Promise<T> {
  const u = new URL(path);
  u.searchParams.set("token", token);
  const res = await fetch(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Apify ${res.status}: ${t.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

async function startActorRun(
  token: string,
  actorId: string,
  input: Record<string, unknown>
): Promise<string> {
  const enc = encodeURIComponent(actorId);
  const j = await apifyPostJson<{ data: { id: string } }>(
    `https://api.apify.com/v2/acts/${enc}/runs`,
    token,
    input
  );
  const id = j.data?.id;
  if (!id) throw new Error("Apify: no run id in response");
  return id;
}

async function waitForRun(
  token: string,
  runId: string,
  maxWaitMs: number
): Promise<{ defaultDatasetId: string }> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const j = await apifyGet<
      { data: { status: string; defaultDatasetId?: string; statusMessage?: string } }
    >(`https://api.apify.com/v2/actor-runs/${runId}`, token);
    const st = j.data?.status;
    if (st === "SUCCEEDED" && j.data.defaultDatasetId)
      return { defaultDatasetId: j.data.defaultDatasetId };
    if (st === "FAILED" || st === "ABORTED" || st === "TIMED-OUT")
      throw new Error(`Apify run ${st}: ${j.data?.statusMessage ?? ""}`);
    await sleep(10_000);
  }
  throw new Error(`Apify run ${runId} did not finish within ${maxWaitMs}ms`);
}

async function fetchDatasetItems(token: string, datasetId: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const u = new URL(`https://api.apify.com/v2/datasets/${datasetId}/items`);
    u.searchParams.set("token", token);
    u.searchParams.set("format", "json");
    u.searchParams.set("clean", "1");
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("offset", String(offset));
    const res = await fetch(u.toString());
    if (!res.ok) throw new Error(`Dataset HTTP ${res.status}`);
    const batch = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    offset += batch.length;
    if (batch.length < limit) break;
  }
  return out;
}

function parseArgs() {
  let target = 2000;
  let dry = false;
  let singleLocation: string | null = null;
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") dry = true;
    else if (a.startsWith("--target=")) {
      const n = parseInt(a.split("=")[1], 10);
      if (!Number.isNaN(n) && n > 0) target = n;
    } else if (a.startsWith("--location=")) {
      singleLocation = a.slice("--location=".length).trim() || null;
    }
  }
  return { target, dry, singleLocation };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type LeadRow = {
  email: string;
  practice_name: string;
  phone: string | null;
  location: string | null;
  notes: string;
  source: string;
  tags: string[];
};

async function ingestApifyItems(params: {
  items: Record<string, unknown>[];
  runId: string;
  target: number;
  existingRows: LeadRow[];
  skipEmail: Set<string>;
  skipPractice: Set<string>;
}): Promise<{
  rows: LeadRow[];
  scanned: number;
  stats: {
    skippedPractice: number;
    skippedEmailDupe: number;
    noWebsite: number;
    noEmail: number;
    duplicatePlace: number;
  };
}> {
  const { items, runId, target, existingRows, skipEmail, skipPractice } = params;
  const rows = [...existingRows];
  let scanned = 0;
  let skippedPractice = 0;
  let skippedEmailDupe = 0;
  let noWebsite = 0;
  let noEmail = 0;
  let duplicatePlace = 0;
  const seenPlace = new Set<string>();

  for (const raw of shuffle(items)) {
    if (rows.length >= target) break;
    scanned++;
    const row = raw as Record<string, unknown>;
    const placeId = row.placeId ?? row.place_id ?? row.googlePlaceId;
    const dedupeKey =
      typeof placeId === "string"
        ? placeId
        : `${pickName(row)}|${pickAddress(row) ?? ""}`;
    if (seenPlace.has(dedupeKey)) {
      duplicatePlace++;
      continue;
    }
    seenPlace.add(dedupeKey);

    const name = pickName(row);
    if (!name || EXCLUDE_NAME_RE.test(name)) continue;

    const nn = normName(name);
    if (skipPractice.has(nn)) {
      skippedPractice++;
      continue;
    }

    let email = pickEmailFromRow(row);
    const website = pickWebsite(row);
    if (!email && website) {
      email = (await harvestEmailFromWebsite(website)) ?? "";
      await sleep(120);
    }
    if (!email || !isValidEmail(email)) {
      if (!website) noWebsite++;
      else noEmail++;
      continue;
    }

    const el = email.toLowerCase();
    if (skipEmail.has(el)) {
      skippedEmailDupe++;
      continue;
    }
    skipEmail.add(el);

    rows.push({
      email: el,
      practice_name: name,
      phone: pickPhone(row),
      location: pickAddress(row),
      notes: `Imported ${new Date().toISOString().slice(0, 10)}. apify_run:${runId} website:${website ?? ""}`,
      source: "apify_google_maps_uk",
      tags: ["uk_import", "apify"],
    });
  }

  return {
    rows,
    scanned,
    stats: { skippedPractice, skippedEmailDupe, noWebsite, noEmail, duplicatePlace },
  };
}

function resolveRegions(singleLocation: string | null): string[] {
  if (singleLocation) return [singleLocation];
  const envSingle = process.env.APIFY_LOCATION_QUERY?.trim();
  if (envSingle) return [envSingle];
  return DEFAULT_UK_REGIONS;
}

async function main() {
  const { target, dry, singleLocation } = parseArgs();
  const token = process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN ?? "";
  const actorId = process.env.APIFY_ACTOR_ID ?? DEFAULT_ACTOR;
  const maxPerCell = parseInt(
    process.env.APIFY_MAX_PER_CELL ?? (target >= 1000 ? "80" : "45"),
    10
  );
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const regions = resolveRegions(singleLocation);

  console.log(`\n🦷 UK dental leads → CRM via Apify (target ${target} net-new)\n`);
  console.log(`Actor: ${actorId}`);
  console.log(`Regions: ${regions.length}${regions.length > 3 ? "" : ` — ${regions.join(", ")}`}`);
  console.log(`maxCrawledPlacesPerSearch: ${maxPerCell}\n`);

  if (!sbUrl || !sbKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (!token) {
    console.error("Missing APIFY_API_TOKEN (or APIFY_TOKEN) in environment.");
    process.exit(1);
  }

  const supabase = createClient(sbUrl, sbKey);
  const sentLog = loadSentLog();
  const [crmEmails, messagedPractices, outboundEmails] = await Promise.all([
    loadCrmContactEmails(supabase),
    loadMessagedPracticeNames(supabase),
    loadEmailsWithOutboundMessages(supabase),
  ]);

  const skipEmail = new Set<string>([...crmEmails, ...sentLog.emails, ...outboundEmails]);
  const skipPractice = new Set([...messagedPractices, ...sentLog.practices]);

  console.log(`Existing CRM emails:      ${crmEmails.size}`);
  console.log(`Outbound-msg emails:       ${outboundEmails.size}`);
  console.log(`Sent-log emails:           ${sentLog.emails.size}`);
  console.log(`Combined skip (email):     ${skipEmail.size}`);
  console.log(`Skip messaged practices:   ${skipPractice.size}\n`);
  console.log(
    `Rule: add only if email not in CRM, not in sent log, and no outbound messages for that address.\n`
  );

  if (dry) {
    try {
      const me = await apifyGet<{ data?: { username?: string } }>(
        "https://api.apify.com/v2/users/me",
        token
      );
      console.log(
        `Dry-run: Apify OK (${me.data?.username ?? "?"}). No runs, no DB writes. Would scan up to ${regions.length} region(s).`
      );
    } catch (e) {
      console.error("Dry-run: Apify token failed:", (e as Error).message);
      process.exit(1);
    }
    return;
  }

  const runWaitMs = target >= 1500 ? 95 * 60 * 1000 : 55 * 60 * 1000;
  let allRows: LeadRow[] = [];
  let totalScanned = 0;
  const aggStats = {
    skippedPractice: 0,
    skippedEmailDupe: 0,
    noWebsite: 0,
    noEmail: 0,
    duplicatePlace: 0,
  };

  for (let r = 0; r < regions.length; r++) {
    if (allRows.length >= target) break;
    const region = regions[r]!;
    const remaining = target - allRows.length;
    console.log(
      `\n── Region ${r + 1}/${regions.length}: ${region} — need ${remaining} more net-new ──\n`
    );

    const runInput = {
      searchStringsArray: ["dental clinic", "dentist", "dental practice"],
      locationQuery: region,
      maxCrawledPlacesPerSearch: maxPerCell,
      scrapeEmails: true,
      skipClosedPlaces: true,
      language: "en",
      maxConcurrency: 5,
    };

    console.log("Starting Apify actor (minutes per region, uses credits)…");
    const runId = await startActorRun(token, actorId, runInput);
    console.log(`Run: https://console.apify.com/actors/runs/${runId}`);
    const { defaultDatasetId } = await waitForRun(token, runId, runWaitMs);
    console.log(`Dataset ${defaultDatasetId}`);
    const items = await fetchDatasetItems(token, defaultDatasetId);
    console.log(`Rows from Apify: ${items.length}`);

    const { rows, scanned, stats } = await ingestApifyItems({
      items,
      runId,
      target,
      existingRows: allRows,
      skipEmail,
      skipPractice,
    });
    allRows = rows;
    totalScanned += scanned;
    aggStats.skippedPractice += stats.skippedPractice;
    aggStats.skippedEmailDupe += stats.skippedEmailDupe;
    aggStats.noWebsite += stats.noWebsite;
    aggStats.noEmail += stats.noEmail;
    aggStats.duplicatePlace += stats.duplicatePlace;
    console.log(`Accumulated net-new queued: ${allRows.length}/${target}`);

    if (r < regions.length - 1 && allRows.length < target) await sleep(5000);
  }

  if (allRows.length === 0) {
    console.log("\nNo new rows (all filtered or empty datasets).");
    console.log(aggStats);
    return;
  }

  const chunk = 50;
  for (let i = 0; i < allRows.length; i += chunk) {
    const slice = allRows.slice(i, i + chunk);
    const { error } = await supabase.from("contacts").upsert(
      slice.map((row) => ({
        email: row.email,
        practice_name: row.practice_name,
        phone: row.phone,
        location: row.location,
        notes: row.notes,
        source: row.source,
        tags: row.tags,
        type: "lead",
        status: "cold",
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "email" }
    );
    if (error) {
      console.error(`Upsert chunk ${i}:`, error.message);
      process.exit(1);
    }
  }

  console.log(`\n✅ Upserted ${allRows.length} contacts (net-new emails for your CRM)`);
  console.log(`   Raw place rows scanned (all regions): ${totalScanned}`);
  if (allRows.length < target) {
    console.log(
      `   ⚠️  Short of ${target}: increase APIFY_MAX_PER_CELL, add regions, or many leads were already in CRM/sent log.`
    );
  }
  console.log(`   Skipped practice (messaged): ${aggStats.skippedPractice}`);
  console.log(`   Skipped email (in CRM / sent / outbound): ${aggStats.skippedEmailDupe}`);
  console.log(`   No website when email missing: ${aggStats.noWebsite}`);
  console.log(`   No harvestable email: ${aggStats.noEmail}`);
  console.log(`   Duplicate place keys: ${aggStats.duplicatePlace}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
