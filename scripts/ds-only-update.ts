/**
 * Dental Sky price update (standalone)
 * HTTP-based login (no Playwright) to avoid headless bot detection
 *
 * Run: cd ~/dentago && bun run scripts/ds-only-update.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";

const DS_USERNAME = "jerome@thedentistgallery.com";
const DS_PASSWORD = "Bracelet26";
const WARREN_CLINIC_ID = "f3aa7eb1-ae23-4253-bf01-0f382d36ccb5";
const DS_DENTAGO_ID = 3;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface DSSession { cookies: string; formKey: string }

async function getDSSession(): Promise<DSSession | null> {
  console.log("🔐 Logging in to Dental Sky via HTTP...");
  const BASE = "https://www.dentalsky.com";
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  try {
    // Step 1: GET login page → cookies + form_key
    const loginPageRes = await fetch(`${BASE}/customer/account/login/`, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!loginPageRes.ok) { console.log("  ❌ Login page load failed:", loginPageRes.status); return null; }

    const setCookies = loginPageRes.headers.getSetCookie?.() ?? [];
    const initialCookies = setCookies.map(c => c.split(";")[0]).join("; ");

    const html = await loginPageRes.text();
    const fkMatch = html.match(/name="form_key"\s+value="([^"]+)"/);
    if (!fkMatch) { console.log("  ❌ No form_key found in login page"); return null; }
    const formKey = fkMatch[1];

    console.log(`  form_key: ${formKey.slice(0, 8)}... | initial cookies: ${setCookies.length}`);

    // Step 2: POST credentials
    const body = new URLSearchParams({
      form_key: formKey,
      login: "",
      "login[username]": DS_USERNAME,
      "login[password]": DS_PASSWORD,
      send: "",
    });

    const loginRes = await fetch(`${BASE}/customer/account/loginPost/`, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": `${BASE}/customer/account/login/`,
        "Cookie": initialCookies,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Origin": BASE,
      },
      body: body.toString(),
      redirect: "manual",
    });

    console.log(`  POST loginPost status: ${loginRes.status} | location: ${loginRes.headers.get("location") ?? "none"}`);

    const loginSetCookies = loginRes.headers.getSetCookie?.() ?? [];
    // Merge all cookies
    const allCookieMap = new Map<string, string>();
    for (const c of [...setCookies, ...loginSetCookies]) {
      const part = c.split(";")[0];
      const [k, ...vParts] = part.split("=");
      if (k) allCookieMap.set(k.trim(), vParts.join("="));
    }
    const sessionCookies = Array.from(allCookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");

    const location = loginRes.headers.get("location") ?? "";
    if (loginRes.status === 302 && !location.includes("login")) {
      console.log(`✅ DS logged in — redirect to ${location}`);
      return { cookies: sessionCookies, formKey };
    }

    // Also accept 200 status with dashboard redirect
    if (loginRes.status === 200 || loginRes.status === 302) {
      console.log(`⚠️ DS login ambiguous (status ${loginRes.status}) — attempting search anyway`);
      return { cookies: sessionCookies, formKey };
    }

    console.log("  ❌ DS login failed"); return null;
  } catch (e) {
    console.error("DS auth error:", e); return null;
  }
}

async function searchDSProduct(session: DSSession, productName: string): Promise<number | null> {
  const BASE = "https://www.dentalsky.com";
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  try {
    const res = await fetch(`${BASE}/catalogsearch/result/?q=${encodeURIComponent(productName)}`, {
      headers: { "User-Agent": UA, "Cookie": session.cookies, "Accept": "text/html", "Accept-Language": "en-GB,en;q=0.9" },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const m1 = html.match(/data-price="([\d.]+)"/);
    if (m1) return parseFloat(m1[1]);
    const m2 = html.match(/class="[^"]*price[^"]*"[^>]*>[^£]*£\s*([\d,]+\.?\d*)/i);
    if (m2) return parseFloat(m2[1].replace(",", ""));
    const m3 = html.match(/"price"\s*:\s*([\d.]+)/);
    if (m3) return parseFloat(m3[1]);
    return null;
  } catch { return null; }
}

async function loadSupplierProducts(supplierId: number): Promise<Array<{ productId: number; productName: string; sku: string }>> {
  const results: Array<{ productId: number; productName: string; sku: string }> = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from("dentago_supplier_products")
      .select("product_id, sku, dentago_products(name)")
      .eq("supplier_id", supplierId)
      .range(page * 1000, page * 1000 + 999);
    if (!data?.length) break;
    for (const row of data) {
      results.push({ productId: row.product_id, productName: (row as any).dentago_products?.name ?? "", sku: row.sku ?? "" });
    }
    console.log(`  Loaded ${results.length}...`);
    if (data.length < 1000) break;
    page++;
    await delay(100);
  }
  return results;
}

async function main() {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  console.log("\n═══════════════════════════════════════");
  console.log("  DENTAL SKY");
  console.log("═══════════════════════════════════════");

  const dsSession = await getDSSession();
  if (!dsSession) { console.log("❌ Cannot continue — DS login failed"); process.exit(1); }

  // Test search before bulk run
  console.log("\n🔍 Test search...");
  const testPrice = await searchDSProduct(dsSession, "nitrile gloves");
  console.log(`  Test price for 'nitrile gloves': ${testPrice ?? "not found"}`);

  console.log("\n📥 Loading DS products...");
  const dsProducts = await loadSupplierProducts(DS_DENTAGO_ID);
  console.log(`✅ ${dsProducts.length} DS products loaded`);

  const foundDsIds = new Set<number>();
  let dsUpdated = 0, dsNoPrice = 0;
  const dsCacheRows: any[] = [];

  for (let i = 0; i < dsProducts.length; i++) {
    const { productId, productName } = dsProducts[i];
    if (!productName) { dsNoPrice++; continue; }

    const price = await searchDSProduct(dsSession, productName);

    if (price && price > 0) {
      await supabase.from("dentago_supplier_products").update({ price, stock: true })
        .eq("product_id", productId).eq("supplier_id", DS_DENTAGO_ID);
      foundDsIds.add(productId);
      dsUpdated++;
      dsCacheRows.push({
        clinic_id: WARREN_CLINIC_ID, product_id: String(productId),
        supplier: "Dental Sky", price, stock: true,
        authenticated: true, fetched_at: now, expires_at: expiresAt,
      });
    } else {
      dsNoPrice++;
    }

    if (i % 100 === 0 || i === dsProducts.length - 1) {
      console.log(`  ${i + 1}/${dsProducts.length} | updated: ${dsUpdated} | no price: ${dsNoPrice}`);
      if (dsCacheRows.length >= 100) {
        await supabase.from("price_cache").upsert(dsCacheRows.splice(0, 100), { onConflict: "clinic_id,product_id,supplier" });
      }
    }
    await delay(300);
  }

  if (dsCacheRows.length) {
    await supabase.from("price_cache").upsert(dsCacheRows, { onConflict: "clinic_id,product_id,supplier" });
  }

  const dsToRemove = dsProducts.filter(p => !foundDsIds.has(p.productId)).map(p => p.productId);
  if (dsToRemove.length) {
    for (let i = 0; i < dsToRemove.length; i += 200) {
      await supabase.from("dentago_supplier_products").delete()
        .eq("supplier_id", DS_DENTAGO_ID).in("product_id", dsToRemove.slice(i, i + 200));
    }
  }

  const { count: dsFinal } = await supabase
    .from("dentago_supplier_products").select("*", { count: "exact", head: true })
    .eq("supplier_id", DS_DENTAGO_ID);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DENTAL SKY UPDATE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DS products loaded:   ${dsProducts.length}
  Prices updated:       ${dsUpdated}
  No price / removed:   ${dsToRemove.length}
  Final DS catalog:     ${dsFinal}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
