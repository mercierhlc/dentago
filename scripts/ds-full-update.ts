/**
 * Dental Sky + DD Group full price update
 *
 * Dental Sky: logs in as jerome@thedentistgallery.com / Bracelet26 (Magento)
 * DD Group:   public Algolia pricing (no login needed)
 *
 * For each supplier:
 *  1. Load all existing products from dentago_supplier_products (paginated)
 *  2. Search by product name to get current price
 *  3. Upsert price back to dentago_supplier_products
 *  4. Remove supplier from products where price couldn't be fetched
 *
 * Run: cd ~/dentago && bun run scripts/ds-full-update.ts
 */

import { chromium, type Browser } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wybqjycfpauwlcrqgtfb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5YnFqeWNmcGF1d2xjcnFndGZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NzM1MywiZXhwIjoyMDkxOTQzMzUzfQ.2SfC2VtZVb61Yy3uqXJe8yHqnFMJfZJWcgnx7xkdLeI";

const DS_USERNAME = "jerome@thedentistgallery.com";
const DS_PASSWORD = "Bracelet26";
const WARREN_CLINIC_ID = "f3aa7eb1-ae23-4253-bf01-0f382d36ccb5";

const DS_DENTAGO_ID = 3;  // dentago_suppliers.id for Dental Sky
const DD_DENTAGO_ID = 76; // dentago_suppliers.id for DD Group

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Dental Sky: Magento login + search ────────────────────────────────────

interface DSSession { cookies: string; formKey: string }

async function getDSSession(): Promise<DSSession | null> {
  console.log("🔐 Logging in to Dental Sky as jerome@thedentistgallery.com...");
  const BASE = "https://www.dentalsky.com";

  try {
    // Step 1: GET login page to capture cookies + form_key
    const loginPageRes = await fetch(`${BASE}/customer/account/login/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!loginPageRes.ok) { console.log("  ❌ Could not load DS login page:", loginPageRes.status); return null; }

    // Extract Set-Cookie headers
    const setCookie = loginPageRes.headers.getSetCookie?.() ?? [];
    const initialCookies = setCookie.map(c => c.split(";")[0]).join("; ");

    const html = await loginPageRes.text();

    // Extract form_key
    const fkMatch = html.match(/name="form_key"\s+value="([^"]+)"/);
    if (!fkMatch) { console.log("  ❌ No form_key in DS login page HTML"); return null; }
    const formKey = fkMatch[1];

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
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": `${BASE}/customer/account/login/`,
        "Cookie": initialCookies,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      body: body.toString(),
      redirect: "manual", // don't follow — capture Set-Cookie from login response
    });

    // Collect session cookies from login response
    const loginCookies = loginRes.headers.getSetCookie?.() ?? [];
    const sessionCookies = [...initialCookies.split("; "), ...loginCookies.map(c => c.split(";")[0])].filter(Boolean).join("; ");

    // Follow redirect to verify login succeeded
    const location = loginRes.headers.get("location") ?? "";
    if (location.includes("login") || loginRes.status === 200) {
      console.log("  ❌ DS login failed — no redirect away from login"); return null;
    }

    console.log(`✅ DS logged in via HTTP — ${loginCookies.length} new cookies`);
    return { cookies: sessionCookies, formKey };
  } catch (e) {
    console.error("DS auth error:", e);
    return null;
  }
}

async function searchDSProduct(session: DSSession, productName: string): Promise<number | null> {
  const BASE = "https://www.dentalsky.com";
  const res = await fetch(`${BASE}/catalogsearch/result/?q=${encodeURIComponent(productName)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      "Cookie": session.cookies,
    },
  });
  if (!res.ok) return null;
  const html = await res.text();

  // Extract first price
  const m1 = html.match(/data-price="([\d.]+)"/);
  if (m1) return parseFloat(m1[1]);
  const m2 = html.match(/class="[^"]*price[^"]*"[^>]*>[^£]*£\s*([\d,]+\.?\d*)/i);
  if (m2) return parseFloat(m2[1].replace(",", ""));
  const m3 = html.match(/"price"\s*:\s*([\d.]+)/);
  if (m3) return parseFloat(m3[1]);
  return null;
}

// ─── DD Group: Algolia public search ──────────────────────────────────────

async function searchDDProduct(productName: string): Promise<{ price: number; sku: string } | null> {
  const res = await fetch("https://CF4C8XNBT0-dsn.algolia.net/1/indexes/prod_dd/query", {
    method: "POST",
    headers: {
      "X-Algolia-Application-Id": "CF4C8XNBT0",
      "X-Algolia-API-Key": "0f266d9536c1a3cd9dbd8d672eac4dbd",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: productName, hitsPerPage: 3 }),
  });
  if (!res.ok) return null;
  const json = await res.json() as { hits?: Array<{ catalogPrice?: number; sku?: string; code?: string }> };
  const hit = json.hits?.[0];
  if (!hit?.catalogPrice || hit.catalogPrice <= 0) return null;
  return { price: hit.catalogPrice, sku: hit.sku ?? hit.code ?? "" };
}

// ─── Load products from DB (paginated) ─────────────────────────────────────

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
      results.push({
        productId: row.product_id,
        productName: (row as any).dentago_products?.name ?? "",
        sku: row.sku ?? "",
      });
    }
    console.log(`  Loaded ${results.length}...`);
    if (data.length < 1000) break;
    page++;
    await delay(100);
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // ── DENTAL SKY ────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════");
  console.log("  DENTAL SKY");
  console.log("═══════════════════════════════════════");

  const dsSession = await getDSSession();
  if (!dsSession) {
    console.log("❌ Skipping Dental Sky — login failed");
  } else {
    console.log("\n📥 Loading DS products...");
    const dsProducts = await loadSupplierProducts(DS_DENTAGO_ID);
    console.log(`✅ ${dsProducts.length} DS products loaded`);

    const foundDsIds = new Set<number>();
    let dsUpdated = 0, dsNoPrice = 0;
    const dsCacheRows: any[] = [];

    // Process in batches with rate limiting (Magento search is slow)
    const DS_BATCH = 1; // one at a time to avoid rate limiting
    for (let i = 0; i < dsProducts.length; i++) {
      const { productId, productName, sku } = dsProducts[i];
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
        // Flush cache every 100
        if (dsCacheRows.length >= 100) {
          await supabase.from("price_cache").upsert(dsCacheRows.splice(0, 100), { onConflict: "clinic_id,product_id,supplier" });
        }
      }
      await delay(200); // polite scraping — Magento needs breathing room
    }

    // Flush remaining
    if (dsCacheRows.length) {
      await supabase.from("price_cache").upsert(dsCacheRows, { onConflict: "clinic_id,product_id,supplier" });
    }

    // Remove DS from products not found
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

    console.log(`\n✅ DENTAL SKY DONE`);
    console.log(`   Updated: ${dsUpdated} | No price: ${dsNoPrice} | Removed: ${dsToRemove.length} | Final catalog: ${dsFinal}`);
  }

  // ── DD GROUP ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════");
  console.log("  DD GROUP");
  console.log("═══════════════════════════════════════");

  console.log("\n📥 Loading DD products...");
  const ddProducts = await loadSupplierProducts(DD_DENTAGO_ID);
  console.log(`✅ ${ddProducts.length} DD products loaded`);

  const foundDdIds = new Set<number>();
  let ddUpdated = 0, ddNoPrice = 0;
  const ddCacheRows: any[] = [];

  for (let i = 0; i < ddProducts.length; i++) {
    const { productId, productName, sku } = ddProducts[i];
    if (!productName) { ddNoPrice++; continue; }

    const result = await searchDDProduct(productName);
    if (result && result.price > 0) {
      await supabase.from("dentago_supplier_products").update({
        price: result.price, stock: true,
        ...(result.sku ? { sku: result.sku } : {}),
      }).eq("product_id", productId).eq("supplier_id", DD_DENTAGO_ID);
      foundDdIds.add(productId);
      ddUpdated++;
      ddCacheRows.push({
        clinic_id: WARREN_CLINIC_ID, product_id: String(productId),
        supplier: "DD Group", price: result.price, stock: true,
        authenticated: false, fetched_at: now, expires_at: expiresAt,
      });
    } else {
      ddNoPrice++;
    }

    if (i % 200 === 0 || i === ddProducts.length - 1) {
      console.log(`  ${i + 1}/${ddProducts.length} | updated: ${ddUpdated} | no price: ${ddNoPrice}`);
      if (ddCacheRows.length >= 200) {
        await supabase.from("price_cache").upsert(ddCacheRows.splice(0, 200), { onConflict: "clinic_id,product_id,supplier" });
      }
    }
    await delay(80); // Algolia is fast, small delay to avoid hammering
  }

  // Flush remaining cache
  if (ddCacheRows.length) {
    await supabase.from("price_cache").upsert(ddCacheRows, { onConflict: "clinic_id,product_id,supplier" });
  }

  // Remove DD from products not found
  const ddToRemove = ddProducts.filter(p => !foundDdIds.has(p.productId)).map(p => p.productId);
  if (ddToRemove.length) {
    for (let i = 0; i < ddToRemove.length; i += 200) {
      await supabase.from("dentago_supplier_products").delete()
        .eq("supplier_id", DD_DENTAGO_ID).in("product_id", ddToRemove.slice(i, i + 200));
    }
  }

  const { count: ddFinal } = await supabase
    .from("dentago_supplier_products").select("*", { count: "exact", head: true })
    .eq("supplier_id", DD_DENTAGO_ID);

  console.log(`\n✅ DD GROUP DONE`);
  console.log(`   Updated: ${ddUpdated} | No price: ${ddNoPrice} | Removed: ${ddToRemove.length} | Final catalog: ${ddFinal}`);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DS + DD UPDATE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
