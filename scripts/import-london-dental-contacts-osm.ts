/**
 * London dental clinics → CRM via OpenStreetMap (Overpass API). No Google key.
 *
 * Fetches amenity=dentist POIs in a Greater London bbox, reads contact:email / website
 * from OSM tags, harvests email from practice sites when missing.
 *
 * Skips:
 * - emails already in contacts
 * - practices already messaged (total_messages_sent > 0 or last_contacted_at)
 * - practice names / emails in ~/Downloads/dentago-sent-all.json
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: OVERPASS_API_URL (default https://overpass-api.de/api/interpreter)
 *
 *   npx tsx scripts/import-london-dental-contacts-osm.ts --target=200 --dry-run
 *   npx tsx scripts/import-london-dental-contacts-osm.ts --target=200
 *
 * For Google Maps + email via Apify (paid), use scripts/import-london-dental-contacts-apify.ts
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

/** Greater London bbox: south, west, north, east */
const LONDON_BBOX = [51.25, -0.55, 51.72, 0.35] as const;

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

function normalizeOsmEmail(raw: string): string | null {
  let e = raw.trim().replace(/^mailto:/i, "");
  const semi = e.indexOf(";");
  if (semi >= 0) e = e.slice(0, semi).trim();
  e = e.replace(/\s+/g, "");
  if (!isValidEmail(e)) return null;
  return e.toLowerCase();
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

function pickWebsite(tags: Record<string, string>): string | null {
  const w =
    tags.website ??
    tags["contact:website"] ??
    tags.url ??
    tags["website:appointment"] ??
    "";
  if (!w.trim()) return null;
  const first = w.split(/[;]/)[0].trim();
  if (!first) return null;
  return first;
}

function pickPhone(tags: Record<string, string>): string | null {
  const p = tags.phone ?? tags["contact:phone"] ?? tags["phone:mobile"] ?? "";
  const t = p.split(/[;/]/)[0].trim();
  return t || null;
}

function formatAddress(tags: Record<string, string>): string | null {
  const parts = [
    tags["addr:housenumber"] && tags["addr:street"]
      ? `${tags["addr:housenumber"]} ${tags["addr:street"]}`
      : tags["addr:street"],
    tags["addr:city"],
    tags["addr:postcode"],
    tags["addr:full"],
  ].filter(Boolean) as string[];
  const s = [...new Set(parts)].join(", ").trim();
  return s ? s.slice(0, 200) : null;
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function elementCoords(el: OverpassElement): { lat: number; lon: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

function buildOverpassQuery(south: number, west: number, north: number, east: number): string {
  return `[out:json][timeout:300];
(
  node["amenity"="dentist"](${south},${west},${north},${east});
  way["amenity"="dentist"](${south},${west},${north},${east});
  relation["amenity"="dentist"](${south},${west},${north},${east});
);
out center;`;
}

async function fetchOverpass(
  interpreterUrl: string,
  south: number,
  west: number,
  north: number,
  east: number
): Promise<OverpassElement[]> {
  const body = `data=${encodeURIComponent(buildOverpassQuery(south, west, north, east))}`;
  const res = await fetch(interpreterUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
      "User-Agent": "DentagoOSMImport/1.0 (+https://www.dentago.co.uk)",
    },
    body,
  });
  if (res.status === 429 || res.status === 504) {
    throw new Error(`Overpass ${res.status} — retry later or set OVERPASS_API_URL to another mirror.`);
  }
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  const data = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
  if (data.remark && /error/i.test(data.remark)) {
    throw new Error(`Overpass: ${data.remark}`);
  }
  return data.elements ?? [];
}

/** Split bbox into 4 quadrants if single query times out or returns overload */
async function fetchDentistsGrid(interpreterUrl: string): Promise<OverpassElement[]> {
  const [s, w, n, e] = LONDON_BBOX;
  try {
    const all = await fetchOverpass(interpreterUrl, s, w, n, e);
    if (all.length > 0) return all;
  } catch (err) {
    console.warn(`Whole-bbox Overpass failed (${(err as Error).message}), trying 2×2 grid...`);
  }
  const midLat = (s + n) / 2;
  const midLon = (w + e) / 2;
  const quads: [number, number, number, number][] = [
    [s, w, midLat, midLon],
    [s, midLon, midLat, e],
    [midLat, w, n, midLon],
    [midLat, midLon, n, e],
  ];
  const merged: OverpassElement[] = [];
  const seen = new Set<string>();
  for (const [qs, qw, qn, qe] of quads) {
    await sleep(2500);
    const part = await fetchOverpass(interpreterUrl, qs, qw, qn, qe);
    for (const el of part) {
      const k = `${el.type}/${el.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(el);
    }
  }
  return merged;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

async function loadCrmExclusions(supabase: ReturnType<typeof createClient>) {
  const allEmails = new Set<string>();
  const messagedEmails = new Set<string>();
  const messagedPractices = new Set<string>();

  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("contacts")
      .select("email, practice_name, total_messages_sent, last_contacted_at")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`contacts select: ${error.message}`);
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const em = row.email?.toLowerCase();
      if (em) allEmails.add(em);
      const messaged =
        (row.total_messages_sent ?? 0) > 0 || Boolean(row.last_contacted_at);
      if (messaged) {
        if (em) messagedEmails.add(em);
        if (row.practice_name) messagedPractices.add(normName(row.practice_name));
      }
    }
    offset += pageSize;
    if (rows.length < pageSize) break;
  }

  return { allEmails, messagedEmails, messagedPractices };
}

function parseArgs() {
  let target = 200;
  let dry = false;
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") dry = true;
    else if (a.startsWith("--target=")) {
      const n = parseInt(a.split("=")[1], 10);
      if (!Number.isNaN(n) && n > 0) target = n;
    }
  }
  return { target, dry };
}

async function main() {
  const { target, dry } = parseArgs();
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const overpassUrl =
    process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter";

  console.log(`\n🦷 London dental contacts → CRM via OSM/Overpass (target ${target})\n`);

  if (!sbUrl || !sbKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(sbUrl, sbKey);
  const sentLog = loadSentLog();
  const crm = await loadCrmExclusions(supabase);

  const skipEmail = new Set([...crm.allEmails, ...crm.messagedEmails, ...sentLog.emails]);
  const skipPractice = new Set([...crm.messagedPractices, ...sentLog.practices]);

  console.log(`CRM emails (any):        ${skipEmail.size}`);
  console.log(`Messaged practice names: ${skipPractice.size}`);
  console.log(`Sent-log extras:        ${sentLog.emails.size} emails, ${sentLog.practices.size} practices`);
  console.log(`Overpass:               ${overpassUrl}\n`);

  if (dry) {
    console.log("Dry-run: fetching OSM dentists (no CRM writes)...");
    const elements = await fetchDentistsGrid(overpassUrl);
    const withSite = elements.filter((el) => pickWebsite(el.tags ?? {}));
    const withTagMail = elements.filter(
      (el) =>
        normalizeOsmEmail(el.tags?.["contact:email"] ?? el.tags?.email ?? "") != null
    );
    console.log(`OSM dentists in bbox:    ${elements.length}`);
    console.log(`With website tag:        ${withSite.length}`);
    console.log(`With email in OSM tags:  ${withTagMail.length}`);
    return;
  }

  console.log("Fetching dentists from OpenStreetMap...");
  const elements = await fetchDentistsGrid(overpassUrl);
  console.log(`OSM candidates: ${elements.length}\n`);

  let scanned = 0;
  let skippedPractice = 0;
  let skippedEmailDupe = 0;
  let noWebsite = 0;
  let noEmail = 0;

  const rows: Array<{
    email: string;
    practice_name: string;
    phone: string | null;
    location: string | null;
    notes: string;
    source: string;
    tags: string[];
  }> = [];

  const candidates = shuffle(
    elements.filter((el) => {
      const tags = el.tags ?? {};
      const name = tags.name?.trim() ?? "";
      if (!name) return false;
      if (EXCLUDE_NAME_RE.test(name)) return false;
      return tags.amenity === "dentist";
    })
  );

  for (const el of candidates) {
    if (rows.length >= target) break;
    scanned++;
    const tags = el.tags ?? {};
    const name = tags.name!.trim();
    const nn = normName(name);
    if (skipPractice.has(nn)) {
      skippedPractice++;
      continue;
    }

    const website = pickWebsite(tags);
    if (!website) {
      noWebsite++;
      continue;
    }

    let email =
      normalizeOsmEmail(tags["contact:email"] ?? "") ??
      normalizeOsmEmail(tags.email ?? "");
    if (!email) {
      email = (await harvestEmailFromWebsite(website)) ?? "";
    }
    if (!email || !isValidEmail(email)) {
      noEmail++;
      continue;
    }
    const elEmail = email.toLowerCase();
    if (skipEmail.has(elEmail)) {
      skippedEmailDupe++;
      continue;
    }
    skipEmail.add(elEmail);

    const coords = elementCoords(el);
    const loc = formatAddress(tags) ?? (coords ? `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}` : null);
    const phone = pickPhone(tags);

    rows.push({
      email: elEmail,
      practice_name: name,
      phone,
      location: loc,
      notes: `Imported ${new Date().toISOString().slice(0, 10)}. osm:${el.type}/${el.id} website:${website}`,
      source: "osm_overpass_london",
      tags: ["london_import", "openstreetmap"],
    });
  }

  if (rows.length === 0) {
    console.log("No new rows to insert (all dupes, no website, or no harvestable email).");
    console.log({ scanned, skippedPractice, skippedEmailDupe, noWebsite, noEmail });
    return;
  }

  const chunk = 50;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await supabase.from("contacts").upsert(
      slice.map((r) => ({
        email: r.email,
        practice_name: r.practice_name,
        phone: r.phone,
        location: r.location,
        notes: r.notes,
        source: r.source,
        tags: r.tags,
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

  console.log(`\n✅ Inserted/updated ${rows.length} contacts`);
  console.log(`   Scanned (with name, shuffled): ${scanned}`);
  console.log(`   Skipped (messaged practice / sent log name): ${skippedPractice}`);
  console.log(`   Skipped (email already in CRM / sent): ${skippedEmailDupe}`);
  console.log(`   No website tag: ${noWebsite}`);
  console.log(`   No harvestable email: ${noEmail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});