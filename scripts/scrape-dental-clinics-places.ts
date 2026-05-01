/**
 * Discover UK dental *clinics* via Google Places API (Text Search + Place Details)
 * and export a CSV for your Apify / contact-enricher pipeline (Places does not return email).
 *
 * Prefers clinics you have not emailed: drops rows whose normalised practice name
 * matches an entry in ~/Downloads/dentago-sent-all.json, and optional place_id history file.
 *
 * Setup:
 *   1. Enable "Places API" in Google Cloud for your project
 *   2. Add GOOGLE_MAPS_API_KEY to dentago/.env.local
 *
 * Run:
 *   npx tsx scripts/scrape-dental-clinics-places.ts --max=300
 *   npx tsx scripts/scrape-dental-clinics-places.ts --max=100 --dry-run
 *   npx tsx scripts/scrape-dental-clinics-places.ts --out=~/Downloads/my-clinics.csv
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
const SENT_LOG = path.join(DOWNLOADS, "dentago-sent-all.json");
const PLACE_HISTORY = path.join(DOWNLOADS, "dentago-google-place-ids.json");

/** Side businesses that are not patient-facing clinics */
const EXCLUDE_NAME_RE =
  /(accountant|accountancy|marketing|\bseo\b|digital agency|web design|software|supplier|wholesale|dental lab|laboratory|training course|recruitment|insurance|solicitor)/i;

const UK_CITIES = [
  "London",
  "Birmingham",
  "Manchester",
  "Glasgow",
  "Liverpool",
  "Leeds",
  "Sheffield",
  "Edinburgh",
  "Bristol",
  "Cardiff",
  "Belfast",
  "Newcastle upon Tyne",
  "Nottingham",
  "Southampton",
  "Portsmouth",
  "Brighton",
  "Leicester",
  "Coventry",
  "Sunderland",
  "Stoke-on-Trent",
  "Wolverhampton",
  "Plymouth",
  "Reading",
  "Aberdeen",
  "Derby",
  "Dundee",
  "Preston",
  "Swansea",
  "York",
  "Oxford",
  "Cambridge",
  "Norwich",
  "Exeter",
  "Peterborough",
  "Bournemouth",
  "Middlesbrough",
  "Blackpool",
  "Bolton",
  "Ipswich",
  "Telford",
];

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

function loadSentPracticeNames(): Set<string> {
  const set = new Set<string>();
  if (!fs.existsSync(SENT_LOG)) return set;
  try {
    const data = JSON.parse(fs.readFileSync(SENT_LOG, "utf8")) as {
      sent?: { practice?: string; email?: string }[];
    };
    for (const row of data.sent ?? []) {
      if (row.practice) set.add(normName(row.practice));
    }
  } catch {
    /* ignore */
  }
  return set;
}

function loadKnownPlaceIds(): Set<string> {
  const set = new Set<string>();
  if (!fs.existsSync(PLACE_HISTORY)) return set;
  try {
    const data = JSON.parse(fs.readFileSync(PLACE_HISTORY, "utf8")) as {
      ids?: string[];
    };
    for (const id of data.ids ?? []) set.add(id);
  } catch {
    /* ignore */
  }
  return set;
}

function persistPlaceIds(newIds: string[]) {
  if (newIds.length === 0) return;
  let ids: string[] = [];
  if (fs.existsSync(PLACE_HISTORY)) {
    try {
      ids = JSON.parse(fs.readFileSync(PLACE_HISTORY, "utf8")).ids ?? [];
    } catch {
      ids = [];
    }
  }
  const merged = new Set([...ids, ...newIds]);
  fs.writeFileSync(
    PLACE_HISTORY,
    JSON.stringify({ ids: [...merged].sort(), updatedAt: new Date().toISOString() }, null, 2)
  );
}

function isDentalClinic(types: string[] | undefined, name: string): boolean {
  if (!types?.length) return false;
  if (EXCLUDE_NAME_RE.test(name)) return false;

  const t = new Set(types);
  if (t.has("dentist")) return true;

  if (
    /\b(dental|dentist|orthodont|teeth|smile)\b/i.test(name) &&
    (t.has("health") || t.has("doctor") || t.has("point_of_interest"))
  ) {
    return true;
  }

  return false;
}

function csvEscape(s: string): string {
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

type TextResult = { place_id: string; name: string; types?: string[] };

async function textSearch(
  apiKey: string,
  query: string,
  pageToken?: string
): Promise<{ results: TextResult[]; next_token?: string }> {
  const u = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  if (pageToken) {
    u.searchParams.set("pagetoken", pageToken);
  } else {
    u.searchParams.set("query", query);
    u.searchParams.set("region", "uk");
  }
  u.searchParams.set("key", apiKey);

  const res = await fetch(u.toString());
  const data = (await res.json()) as {
    status: string;
    results?: TextResult[];
    next_page_token?: string;
    error_message?: string;
  };

  if (data.status === "INVALID_REQUEST" && pageToken) {
    await sleep(2500);
    return textSearch(apiKey, query, pageToken);
  }

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(
      `Places text search: ${data.status} ${data.error_message ?? ""}`
    );
  }

  return {
    results: data.results ?? [],
    next_token: data.next_page_token,
  };
}

type PlaceDetail = {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry?: { location?: { lat: number; lng: number } };
  types?: string[];
};

async function placeDetails(apiKey: string, placeId: string): Promise<PlaceDetail | null> {
  const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  u.searchParams.set("place_id", placeId);
  u.searchParams.set(
    "fields",
    "place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry,types,business_status"
  );
  u.searchParams.set("key", apiKey);

  const res = await fetch(u.toString());
  const data = (await res.json()) as {
    status: string;
    result?: PlaceDetail & { business_status?: string };
    error_message?: string;
  };

  if (data.status !== "OK" || !data.result) return null;
  if (data.result.business_status === "CLOSED_PERMANENTLY") return null;
  return data.result;
}

function parseArgs() {
  let max = 300;
  let dry = false;
  let out: string | null = null;
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") dry = true;
    else if (a.startsWith("--max=")) {
      const n = parseInt(a.split("=")[1], 10);
      if (!Number.isNaN(n) && n > 0) max = n;
    } else if (a.startsWith("--out=")) {
      out = a.slice(6).replace(/^~/, process.env.HOME ?? "");
    }
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const defaultOut = path.join(
    DOWNLOADS,
    `dataset_dental-clinics-google-places_${stamp}.csv`
  );
  return { max, dry, outPath: out ?? defaultOut };
}

async function main() {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? "";
  const { max, dry, outPath } = parseArgs();

  const sentNames = loadSentPracticeNames();
  const knownIds = loadKnownPlaceIds();

  console.log(`Sent-log practice names loaded: ${sentNames.size}`);
  console.log(`Known place_ids on file:         ${knownIds.size}`);
  console.log(`Target new rows:                 ${max}`);
  console.log(`Output:                         ${outPath}`);
  if (dry) console.log("(dry-run: no API calls, no file write)\n");

  if (!dry && !apiKey) {
    console.error(
      "Set GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY) in .env.local"
    );
    process.exit(1);
  }

  const seenPlace = new Set<string>();
  const textHits: TextResult[] = [];

  if (dry) {
    console.log(`Would search ${UK_CITIES.length} cities × 2 queries (approx).`);
    return;
  }

  for (const city of UK_CITIES) {
    if (textHits.length >= max * 2) break;

    for (const q of [`dental clinic ${city}`, `dentist ${city}`]) {
      let pageToken: string | undefined;
      let pages = 0;
      do {
        const { results, next_token } = await textSearch(apiKey, q, pageToken);
        for (const r of results) {
          if (!r.place_id || seenPlace.has(r.place_id)) continue;
          if (knownIds.has(r.place_id)) continue;
          if (!isDentalClinic(r.types, r.name ?? "")) continue;
          seenPlace.add(r.place_id);
          textHits.push(r);
        }
        pageToken = next_token;
        pages++;
        if (pageToken) await sleep(2100);
      } while (pageToken && pages < 3);
    }
  }

  const rows: string[][] = [];
  const header = [
    "title",
    "formatted_address",
    "phone",
    "website",
    "review_score",
    "reviews_number",
    "latitude",
    "longitude",
    "google_business_categories",
    "google_place_id",
    "google_maps_url",
    "email",
    "data_source",
  ];
  rows.push(header);

  const newPlaceIds: string[] = [];
  let skippedSent = 0;

  for (const hit of textHits) {
    if (rows.length - 1 >= max) break;

    const detail = await placeDetails(apiKey, hit.place_id);
    await sleep(110);
    if (!detail) continue;

    const nm = detail.name ?? hit.name ?? "";
    if (!isDentalClinic(detail.types, nm)) continue;
    if (EXCLUDE_NAME_RE.test(nm)) continue;

    const nn = normName(nm);
    const nameMatch = sentNames.has(nn);
    if (nameMatch) {
      skippedSent++;
      continue;
    }

    const lat = detail.geometry?.location?.lat ?? "";
    const lng = detail.geometry?.location?.lng ?? "";
    const typesStr = (detail.types ?? []).join("|");
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(detail.place_id)}`;

    rows.push([
      nm,
      detail.formatted_address ?? "",
      detail.formatted_phone_number ?? "",
      detail.website ?? "",
      detail.rating != null ? String(detail.rating) : "",
      detail.user_ratings_total != null ? String(detail.user_ratings_total) : "",
      lat !== "" ? String(lat) : "",
      lng !== "" ? String(lng) : "",
      typesStr,
      detail.place_id,
      mapsUrl,
      "",
      "google_places_api",
    ]);

    newPlaceIds.push(detail.place_id);
  }

  const lines = rows.map((r) => r.map((c) => csvEscape(String(c))).join(","));
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  if (newPlaceIds.length > 0) persistPlaceIds(newPlaceIds);

  console.log(`\n✅ Wrote ${rows.length - 1} clinics → ${outPath}`);
  console.log(`   Skipped (name in sent log): ${skippedSent}`);
  console.log(`   Appended ${newPlaceIds.length} place_ids → ${PLACE_HISTORY}`);
  console.log(
    "\nNext: run your email finder / Apify scrape on this CSV — Places does not provide email."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
