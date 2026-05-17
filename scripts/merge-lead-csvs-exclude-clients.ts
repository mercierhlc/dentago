/**
 * Merge multiple Hunter / Apify / Apollo / Maps CSV exports into one deduped sheet,
 * excluding registered Dentago clinic + auth user emails when Supabase env is set.
 *
 *   npx tsx scripts/merge-lead-csvs-exclude-clients.ts
 *   npx tsx scripts/merge-lead-csvs-exclude-clients.ts --out=~/Downloads/out.csv
 *   npx tsx scripts/merge-lead-csvs-exclude-clients.ts --inputs=/a.csv,/b.csv
 *
 * Env (optional): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → loads
 * `fetchRegisteredClinicEmailSet` to skip existing tenants.
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { fetchRegisteredClinicEmailSet } from "../lib/registered-clinic-emails";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

type RawRow = Record<string, string>;

type Unified = {
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  job_title: string;
  company_name: string;
  website: string;
  phone: string;
  city: string;
  country: string;
  linkedin_url: string;
  google_place_id: string;
  address: string;
  source_files: string[];
  extras: RawRow;
  score: number;
};

function expandHome(p: string): string {
  if (p.startsWith("~/")) return path.join(process.env.HOME ?? "", p.slice(2));
  return p;
}

/** RFC 4180-ish parser: newlines inside quotes, optional delimiter `,` or `;`. */
function parseDelimited(content: string, delimiter: "," | ";"): RawRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const len = content.length;
  for (let i = 0; i < len; i++) {
    const c = content[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < len && content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && i + 1 < len && content[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  if (rows.length === 0) return [];
  const headers = rows[0]!.map((h) => h.replace(/^\uFEFF/, "").trim());
  const out: RawRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const vals = rows[r]!;
    if (!vals || vals.every((v) => !String(v).trim())) continue;
    const rec: RawRow = {};
    headers.forEach((h, j) => {
      rec[h] = (vals[j] ?? "").trim();
    });
    out.push(rec);
  }
  return out;
}

function detectDelimiter(firstLine: string): "," | ";" {
  const q = (firstLine.match(/"/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  if (semis > commas && q < 2) return ";";
  return ",";
}

function parseCSVFile(filePath: string): RawRow[] {
  const abs = expandHome(filePath);
  if (!fs.existsSync(abs)) {
    console.warn(`[skip] missing file: ${abs}`);
    return [];
  }
  const content = fs.readFileSync(abs, "utf-8");
  const firstLine = content.split(/\r?\n/)[0] ?? "";
  const delim = detectDelimiter(firstLine);
  return parseDelimited(content, delim);
}

function normEmail(e: string): string | null {
  let raw = e.trim();
  try {
    raw = decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    /* keep raw */
  }
  const x = raw.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) return null;
  if (x.endsWith("@dentago.co.uk")) return null;
  return x;
}

function collectEmailsFromRow(row: RawRow): string[] {
  const found = new Set<string>();
  for (const [k, v] of Object.entries(row)) {
    if (!v) continue;
    const key = k.toLowerCase();
    if (key.includes("email")) {
      const m = v.match(EMAIL_RE);
      if (m) for (const e of m) {
        const n = normEmail(e);
        if (n) found.add(n);
      }
    }
  }
  if (found.size === 0) {
    const blob = Object.values(row).join(" ");
    for (const m of blob.matchAll(EMAIL_RE)) {
      const n = normEmail(m[0]!);
      if (n) found.add(n);
    }
  }
  return [...found];
}

function pickFirst(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    const t = (v ?? "").trim();
    if (t) return t;
  }
  return "";
}

function rowToUnified(email: string, row: RawRow, sourceFile: string): Unified {
  const first = pickFirst(
    row["First name"],
    row["first_name"],
    row["firstName"],
  );
  const last = pickFirst(row["Last name"], row["last_name"], row["lastName"]);
  let full = pickFirst(
    row["Full name"],
    row["full_name"],
    row["fullName"],
    row["fullName"],
  );
  if (!full && (first || last)) full = `${first} ${last}`.trim();
  const job = pickFirst(
    row["Job title"],
    row["job_title"],
    row["title"],
    row["position"],
    row["headline"],
  );
  const company = pickFirst(row["Company"], row["company_name"], row["companyName"], row["name"]);
  const website = pickFirst(
    row["Website"],
    row["website"],
    row["website_url"],
    row["company_website"],
    row["url"],
  );
  const phone = pickFirst(
    row["Phone number"],
    row["phone"],
    row["phone_number"],
    row["mobile_number"],
    row["company_phone"],
  );
  const city = pickFirst(row["City"], row["city"], row["company_city"], row["personCity"]);
  const country = pickFirst(
    row["Country"],
    row["Country"],
    row["country"],
    row["country_code"],
    row["company_country"],
    row["personCountry"],
  );
  const linkedin = pickFirst(row["LinkedIn URL"], row["linkedin"], row["linkedinUrl"], row["linkedin_url"]);
  const placeId = pickFirst(row["google_place_id"], row["Google place id"], row["place_id"]);
  const address = pickFirst(
    row["formatted_address"],
    row["street"],
    row["company_full_address"],
    row["company_street_address"],
    row["registered_office_address"],
  );

  const extras: RawRow = { ...row };
  const dropKeys = new Set([
    "First name",
    "Last name",
    "Full name",
    "first_name",
    "last_name",
    "full_name",
    "firstName",
    "lastName",
    "fullName",
    "Job title",
    "job_title",
    "title",
    "position",
    "headline",
    "Company",
    "company_name",
    "companyName",
    "name",
    "Website",
    "website",
    "website_url",
    "company_website",
    "url",
    "Email address",
    "email",
    "Phone number",
    "phone",
    "phone_number",
    "mobile_number",
    "company_phone",
    "City",
    "city",
    "company_city",
    "personCity",
    "Country",
    "country",
    "country_code",
    "company_country",
    "personCountry",
    "LinkedIn URL",
    "linkedin",
    "linkedinUrl",
    "linkedin_url",
    "google_place_id",
  ]);
  for (const k of Object.keys(extras)) {
    if (dropKeys.has(k) || /^emails?\//i.test(k)) {
      delete extras[k];
    }
  }

  let score = 0;
  if (full) score += 4;
  if (first || last) score += 2;
  if (job) score += 3;
  if (company) score += 2;
  if (website) score += 1;
  if (linkedin) score += 1;

  return {
    email: normEmail(email)!,
    first_name: first,
    last_name: last,
    full_name: full,
    job_title: job,
    company_name: company,
    website,
    phone,
    city,
    country,
    linkedin_url: linkedin,
    google_place_id: placeId,
    address,
    source_files: [path.basename(sourceFile)],
    extras,
    score,
  };
}

function mergeUnified(a: Unified, b: Unified): Unified {
  const pick = (x: string, y: string) => (x.trim() ? x : y);
  const better = a.score >= b.score ? a : b;
  const worse = a.score >= b.score ? b : a;
  const sf = [...new Set([...better.source_files, ...worse.source_files])];
  const extras = { ...worse.extras, ...better.extras };
  return {
    email: better.email,
    first_name: pick(better.first_name, worse.first_name),
    last_name: pick(better.last_name, worse.last_name),
    full_name: pick(better.full_name, worse.full_name),
    job_title: pick(better.job_title, worse.job_title),
    company_name: pick(better.company_name, worse.company_name),
    website: pick(better.website, worse.website),
    phone: pick(better.phone, worse.phone),
    city: pick(better.city, worse.city),
    country: pick(better.country, worse.country),
    linkedin_url: pick(better.linkedin_url, worse.linkedin_url),
    google_place_id: pick(better.google_place_id, worse.google_place_id),
    address: pick(better.address, worse.address),
    source_files: sf,
    extras,
    score: Math.max(a.score, b.score),
  };
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const DEFAULT_INPUTS = [
  path.join(process.env.HOME ?? "", "Downloads", "39-leads-2026-05-12.csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_google-maps-email-leads-fast-scraper_2026-05-01_17-18-39-938.csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_google-maps-email-leads-fast-scraper_2026-05-01_17-13-57-336 (1).csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_google-maps-email-leads-fast-scraper_2026-05-01_17-13-57-336.csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_google-maps-with-contact-details_2026-04-29_18-24-58-902.csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_google-maps-email-leads-fast-scraper_2026-04-16_23-02-11-503.csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_leads-finder_2026-04-27_13-59-42-501.csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_contact-details-enricher_2026-04-27_13-55-34-392.csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_leads-finder_2026-04-26_12-22-41-573.csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_lead-scraper-apollo-zoominfo-lusha_2026-04-25_08-15-08-115.csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_lead-scraper-apollo-zoominfo-lusha_2026-04-25_08-11-37-449.csv"),
  path.join(
    process.env.HOME ?? "",
    "Library",
    "Mobile Documents",
    "com~apple~Numbers",
    "Documents",
    "CPH Results 1k.csv",
  ),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_lead-scraper-apollo-zoominfo-lusha_2026-04-23_03-20-48-523.csv"),
  path.join(process.env.HOME ?? "", "Downloads", "dataset_google-maps-with-contact-details_2026-04-20_00-35-35-834.csv"),
];

function parseArgs() {
  const argv = process.argv.slice(2);
  let out: string | null = null;
  let inputs: string[] | null = null;
  for (const a of argv) {
    if (a.startsWith("--out=")) out = expandHome(a.slice("--out=".length));
    if (a.startsWith("--inputs=")) {
      inputs = a
        .slice("--inputs=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return { out, inputs };
}

async function main() {
  const { out: outArg, inputs: inputsArg } = parseArgs();
  const inputs = inputsArg ?? DEFAULT_INPUTS;
  const outPath =
    outArg ??
    path.join(
      process.env.HOME ?? "",
      "Downloads",
      `dentago-merged-leads-${new Date().toISOString().slice(0, 10)}.csv`,
    );

  let exclude = new Set<string>();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key);
    exclude = await fetchRegisteredClinicEmailSet(sb, url, key);
    console.log(`Loaded ${exclude.size} registered clinic/auth emails to exclude.`);
  } else {
    console.warn("No Supabase env — skip registered-clinic filter (set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
  }

  const byEmail = new Map<string, Unified>();

  for (const filePath of inputs) {
    const rows = parseCSVFile(filePath);
    const base = path.basename(filePath);
    console.log(`Read ${rows.length} rows from ${base}`);
    for (const row of rows) {
      const emails = collectEmailsFromRow(row);
      if (emails.length === 0) continue;
      for (const email of emails) {
        if (exclude.has(email)) continue;
        const u = rowToUnified(email, row, filePath);
        const prev = byEmail.get(email);
        if (!prev) byEmail.set(email, u);
        else byEmail.set(email, mergeUnified(prev, u));
      }
    }
  }

  const list = [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
  const header = [
    "email",
    "first_name",
    "last_name",
    "full_name",
    "job_title",
    "company_name",
    "website",
    "phone",
    "city",
    "country",
    "linkedin_url",
    "google_place_id",
    "address",
    "source_files",
    "extra_columns_json",
  ];

  const lines = [
    header.join(","),
    ...list.map((r) =>
      [
        csvEscape(r.email),
        csvEscape(r.first_name),
        csvEscape(r.last_name),
        csvEscape(r.full_name),
        csvEscape(r.job_title),
        csvEscape(r.company_name),
        csvEscape(r.website),
        csvEscape(r.phone),
        csvEscape(r.city),
        csvEscape(r.country),
        csvEscape(r.linkedin_url),
        csvEscape(r.google_place_id),
        csvEscape(r.address),
        csvEscape(r.source_files.join("|")),
        csvEscape(JSON.stringify(r.extras)),
      ].join(","),
    ),
  ];

  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`\n✅ Wrote ${list.length} unique emails → ${outPath}`);
  console.log(`   Excluded (registered): ${exclude.size} addresses in filter set`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
