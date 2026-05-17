/**
 * One-off: populate price_cache for Jerome Sebah (Dr Jerome Sebah / The Dentist Gallery)
 * using his connected Dental Sky credentials.
 *
 * Run: bun run scripts/sync-jerome-prices.ts
 */

import { createClient } from "@supabase/supabase-js";
import { createHmac, createDecipheriv } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JEROME_CLINIC_ID = "cf3f1230-7bd5-440f-b99a-ad8765b5ccb5";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── Crypto (matches lib/crypto.ts) ──────────────────────────────────────────
const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey() {
  const secret = process.env.CREDENTIAL_SECRET ?? "dentago-secret-key-change-in-prod";
  return Buffer.from(createHmac("sha256", secret).update("dentago-aes-key-v2").digest());
}

function decrypt(enc: string): string {
  if (enc.startsWith("v2:")) {
    const key = getKey();
    const combined = Buffer.from(enc.slice(3), "base64");
    const iv = combined.subarray(0, IV_LEN);
    const tag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = combined.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }
  // Legacy XOR
  const secret = process.env.CREDENTIAL_SECRET ?? "dentago-secret-key-change-in-prod";
  const bare = enc.startsWith("v1:") ? enc.slice(3) : enc;
  const encoded = Buffer.from(bare, "base64");
  const result = Buffer.alloc(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    result[i] = encoded[i] ^ secret.charCodeAt(i % secret.length);
  }
  return result.toString("utf8");
}

// ── Dental Sky scraper (matches lib/scrapers.ts) ────────────────────────────
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

class CookieJar {
  private store = new Map<string, string>();
  ingest(headers: Headers) {
    const h = headers as any;
    const raw: string[] = typeof h.getSetCookie === "function"
      ? h.getSetCookie()
      : (headers.get("set-cookie") ?? "").split(/,(?=\s*[A-Za-z0-9_-]+=)/);
    for (const cookie of raw) {
      const semi = cookie.indexOf(";");
      const pair = cookie.slice(0, semi > 0 ? semi : undefined).trim();
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      this.store.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header() { return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join("; "); }
}

function extractPrice(html: string): number | null {
  const m1 = html.match(/data-price="([\d.]+)"/);
  if (m1) return parseFloat(m1[1]);
  const m2 = html.match(/class="[^"]*price[^"]*"[^>]*>[^£]*£\s*([\d,]+\.?\d*)/i);
  if (m2) return parseFloat(m2[1].replace(",", ""));
  const m3 = html.match(/"price"\s*:\s*([\d.]+)/);
  if (m3) return parseFloat(m3[1]);
  return null;
}

async function scrapeDentalSky(username: string, password: string, searchTerm: string): Promise<number | null> {
  const jar = new CookieJar();
  const BASE = "https://www.dentalsky.com";

  const page = await fetch(`${BASE}/customer/account/login/`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  if (!page) return null;
  jar.ingest(page.headers);
  const pageHtml = await page.text();

  const formKey = pageHtml.match(/name="form_key"[^>]*value="([^"]+)"/)?.[1]
    ?? pageHtml.match(/value="([^"]+)"[^>]*name="form_key"/)?.[1];
  if (!formKey) { console.log("  ✗ Could not extract form_key from Dental Sky login page"); return null; }

  const loginRes = await fetch(`${BASE}/customer/account/loginPost/`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
      Referer: `${BASE}/customer/account/login/`,
    },
    body: new URLSearchParams({
      form_key: formKey,
      "login[username]": username,
      "login[password]": password,
      send: "",
    }).toString(),
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);

  if (!loginRes) return null;
  jar.ingest(loginRes.headers);

  const location = loginRes.headers.get("location") ?? "";
  if (!location || location.includes("login")) {
    console.log("  ✗ Login failed — redirected back to login page");
    return null;
  }

  const dest = location.startsWith("http") ? location : `${BASE}${location}`;
  const acc = await fetch(dest, { headers: { "User-Agent": UA, Cookie: jar.header() }, signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (acc) jar.ingest(acc.headers);

  const search = await fetch(
    `${BASE}/catalogsearch/result/?q=${encodeURIComponent(searchTerm)}`,
    { headers: { "User-Agent": UA, Cookie: jar.header() }, signal: AbortSignal.timeout(10000) }
  ).catch(() => null);
  if (!search?.ok) return null;

  return extractPrice(await search.text());
}

// ── Products to sync ────────────────────────────────────────────────────────
const SYNC_PRODUCTS = [
  { id: "nitrile-gloves-large",  searchTerm: "cranberry nitrile gloves large 100" },
  { id: "septanest-articaine",   searchTerm: "septanest 4% articaine" },
  { id: "face-masks-iir",        searchTerm: "type IIR surgical face masks 50" },
  { id: "filtek-z250-a1",        searchTerm: "3M Filtek Z250 A1" },
  { id: "protaper-gold-f1",      searchTerm: "ProTaper Gold F1" },
  { id: "optim33-wipes",         searchTerm: "Optim 33 TB wipes" },
];

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔍 Fetching Jerome's Dental Sky credentials...");

  // Get Dental Sky credential UUID
  const { data: creds, error: credErr } = await supabase
    .from("supplier_credentials")
    .select("supplier_id, username, encrypted_password, suppliers(name)")
    .eq("clinic_id", JEROME_CLINIC_ID);

  if (credErr || !creds?.length) {
    console.error("✗ Could not fetch credentials:", credErr?.message);
    process.exit(1);
  }

  const dsCred = (creds as any[]).find(c => {
    const sup = Array.isArray(c.suppliers) ? c.suppliers[0] : c.suppliers;
    return sup?.name === "Dental Sky";
  });

  if (!dsCred) {
    console.error("✗ No Dental Sky credential found for Jerome");
    process.exit(1);
  }

  const username = dsCred.username;
  const password = decrypt(dsCred.encrypted_password);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${"*".repeat(password.length)}`);
  console.log();

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  let synced = 0;

  for (const product of SYNC_PRODUCTS) {
    console.log(`🔎 Scraping "${product.searchTerm}"...`);
    const price = await scrapeDentalSky(username, password, product.searchTerm);
    if (price === null) {
      console.log(`  ⚠️  No price returned`);
      continue;
    }
    console.log(`  ✅ £${price.toFixed(2)}`);

    const { error: upsertErr } = await supabase
      .from("price_cache")
      .upsert({
        clinic_id: JEROME_CLINIC_ID,
        product_id: product.id,
        supplier: "Dental Sky",
        price,
        stock: true,
        authenticated: true,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, { onConflict: "clinic_id,product_id,supplier" });

    if (upsertErr) {
      console.log(`  ✗ Cache write failed: ${upsertErr.message}`);
    } else {
      synced++;
    }
  }

  // Update last_synced on the credential
  await supabase
    .from("supplier_credentials")
    .update({ last_synced: new Date().toISOString() })
    .eq("clinic_id", JEROME_CLINIC_ID)
    .eq("supplier_id", dsCred.supplier_id);

  console.log(`\n✅ Done — synced ${synced}/${SYNC_PRODUCTS.length} products to price_cache for Jerome Sebah`);
  console.log("   Kent Express: skipped (Angular SPA — requires API partnership, not HTTP scraping)");
}

main().catch(console.error);
