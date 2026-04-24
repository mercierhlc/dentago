/**
 * GET /api/clinic/live-pricing?id={productId}
 * Authorization: Bearer {token}
 *
 * Cache-first authenticated pricing:
 *  1. Return cached prices if fresh (< CACHE_TTL_MINUTES old)
 *  2. Otherwise scrape each supplier the clinic has credentials for
 *  3. Store results in price_cache with an expiry
 *  4. Merge with static fallback for suppliers without credentials or where scraping failed
 *
 * Cache TTL: 2 hours — prevents hammering supplier sites and avoids bot detection.
 * Stale-while-revalidate: if scraping fails but stale cache exists, return stale data
 * rather than falling back all the way to static prices.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import { fetchAuthenticatedPrices } from "@/lib/scrapers";

const CACHE_TTL_MINUTES = 120; // 2 hours

// Static fallback prices
const STATIC_PRICES: Record<string, { supplier: string; price: number; stock: boolean }[]> = {
  "nitrile-gloves-large": [
    { supplier: "Dental Sky",   price: 4.85, stock: true  },
    { supplier: "DHB",          price: 4.95, stock: false },
    { supplier: "Kent Express", price: 5.20, stock: true  },
    { supplier: "Henry Schein", price: 5.65, stock: true  },
  ],
  "septanest-articaine": [
    { supplier: "Henry Schein",     price: 28.40, stock: true  },
    { supplier: "Kent Express",     price: 29.80, stock: true  },
    { supplier: "Dental Directory", price: 30.50, stock: true  },
    { supplier: "Dental Sky",       price: 31.20, stock: false },
  ],
  "face-masks-iir": [
    { supplier: "Clark Dental", price: 3.20, stock: true },
    { supplier: "Dental Sky",   price: 3.45, stock: true },
    { supplier: "Amalgadent",   price: 3.50, stock: true },
    { supplier: "Kent Express", price: 3.65, stock: true },
  ],
  "filtek-z250-a1": [
    { supplier: "Wrights",      price: 17.90, stock: true },
    { supplier: "Henry Schein", price: 18.75, stock: true },
    { supplier: "Kent Express", price: 19.40, stock: true },
  ],
  "protaper-gold-f1": [
    { supplier: "Trycare",      price: 32.50, stock: true  },
    { supplier: "DMI",          price: 33.10, stock: false },
    { supplier: "Kent Express", price: 34.00, stock: true  },
    { supplier: "Henry Schein", price: 35.60, stock: true  },
  ],
  "optim33-wipes": [
    { supplier: "Dental Directory", price: 11.40, stock: true },
    { supplier: "Dental Sky",       price: 11.90, stock: true },
    { supplier: "Clark Dental",     price: 12.40, stock: true },
    { supplier: "Henry Schein",     price: 13.20, stock: true },
  ],
};

const SEARCH_TERMS: Record<string, string> = {
  "nitrile-gloves-large": "cranberry nitrile gloves large 100",
  "septanest-articaine":  "septanest 4% articaine",
  "face-masks-iir":       "type IIR surgical face masks 50",
  "filtek-z250-a1":       "3M Filtek Z250 A1",
  "protaper-gold-f1":     "ProTaper Gold F1",
  "optim33-wipes":        "Optim 33 TB wipes",
};

type CacheRow = {
  supplier: string;
  price: number;
  stock: boolean;
  authenticated: boolean;
  fetched_at: string;
  expires_at: string;
};

async function getClinicId(token: string): Promise<string | null> {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  return clinic?.id ?? null;
}

/** Read all cache rows for this clinic+product, both fresh and stale. */
async function readCache(
  clinicId: string,
  productId: string
): Promise<{ fresh: CacheRow[]; stale: CacheRow[] }> {
  const { data } = await supabaseAdmin
    .from("price_cache")
    .select("supplier, price, stock, authenticated, fetched_at, expires_at")
    .eq("clinic_id", clinicId)
    .eq("product_id", productId);

  if (!data?.length) return { fresh: [], stale: [] };

  const now = Date.now();
  const fresh: CacheRow[] = [];
  const stale: CacheRow[] = [];
  for (const row of data as CacheRow[]) {
    (new Date(row.expires_at).getTime() > now ? fresh : stale).push(row);
  }
  return { fresh, stale };
}

/** Write scraped prices into cache with a TTL. Uses upsert to overwrite stale rows. */
async function writeCache(
  clinicId: string,
  productId: string,
  prices: { supplier: string; price: number; stock: boolean; authenticated: boolean }[]
) {
  if (!prices.length) return;
  const expiresAt = new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000).toISOString();
  const rows = prices.map(p => ({
    clinic_id: clinicId,
    product_id: productId,
    supplier: p.supplier,
    price: p.price,
    stock: p.stock,
    authenticated: p.authenticated,
    fetched_at: new Date().toISOString(),
    expires_at: expiresAt,
  }));

  await supabaseAdmin
    .from("price_cache")
    .upsert(rows, { onConflict: "clinic_id,product_id,supplier" });
}

function buildResponse(
  productId: string,
  staticData: { supplier: string; price: number; stock: boolean }[],
  authPrices: Map<string, { price: number; stock: boolean; authenticated: boolean }>,
  fetchedAt: string,
  fromCache: boolean
) {
  const prices = staticData.map(entry => {
    const auth = authPrices.get(entry.supplier);
    if (auth) {
      return {
        supplier: entry.supplier,
        price: auth.price,
        stock: auth.stock,
        authenticated: auth.authenticated,
        live: true,
        fromCache,
      };
    }
    return { ...entry, authenticated: false, live: false, fromCache: false };
  });

  const anyAuthenticated = prices.some(p => p.authenticated);
  return NextResponse.json({
    productId,
    prices,
    source: anyAuthenticated ? "authenticated" : "static",
    fetchedAt,
    fromCache,
  });
}

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("id");
  if (!productId || !STATIC_PRICES[productId]) {
    return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  }

  const clinicId = await getClinicId(token);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const staticData = STATIC_PRICES[productId];

  // ── 1. Check cache ──────────────────────────────────────────────────────────
  const { fresh, stale } = await readCache(clinicId, productId);

  if (fresh.length > 0) {
    // Serve fresh cache immediately — no scraping needed
    const authPrices = new Map(
      fresh.map(r => [r.supplier, { price: r.price, stock: r.stock, authenticated: r.authenticated }])
    );
    return buildResponse(productId, staticData, authPrices, fresh[0].fetched_at, true);
  }

  // ── 2. Load credentials ─────────────────────────────────────────────────────
  const { data: creds } = await supabaseAdmin
    .from("supplier_credentials")
    .select("supplier_id, username, password_enc, dentago_suppliers(name)")
    .eq("clinic_id", clinicId);

  if (!creds?.length) {
    // No credentials — return static pricing
    return NextResponse.json({
      productId,
      prices: staticData.map(p => ({ ...p, authenticated: false, live: false, fromCache: false })),
      source: "static",
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const credentials = (creds as any[]).map((c) => ({
    supplierName: (Array.isArray(c.dentago_suppliers)
      ? c.dentago_suppliers[0]?.name
      : c.dentago_suppliers?.name) ?? "",
    username: c.username as string,
    password: decrypt(c.password_enc as string),
  })).filter(c => c.supplierName);

  // ── 3. Scrape authenticated prices ──────────────────────────────────────────
  const searchTerm = SEARCH_TERMS[productId];
  const scraped = await fetchAuthenticatedPrices(credentials, searchTerm);

  // ── 4. Handle scraping failure — fall back to stale cache if available ──────
  if (scraped.size === 0 && stale.length > 0) {
    const authPrices = new Map(
      stale.map(r => [r.supplier, { price: r.price, stock: r.stock, authenticated: r.authenticated }])
    );
    return buildResponse(productId, staticData, authPrices, stale[0].fetched_at, true);
  }

  // ── 5. Write fresh prices to cache ──────────────────────────────────────────
  if (scraped.size > 0) {
    const toCache = [...scraped.entries()].map(([supplier, price]) => {
      const staticEntry = staticData.find(s => s.supplier === supplier);
      return {
        supplier,
        price,
        stock: staticEntry?.stock ?? true,
        authenticated: true,
      };
    });
    // Fire-and-forget — don't block the response on a write
    writeCache(clinicId, productId, toCache).catch(() => {});
  }

  // ── 6. Merge and respond ────────────────────────────────────────────────────
  const authPrices = new Map(
    [...scraped.entries()].map(([supplier, price]) => {
      const staticEntry = staticData.find(s => s.supplier === supplier);
      return [supplier, { price, stock: staticEntry?.stock ?? true, authenticated: true }];
    })
  );

  return buildResponse(productId, staticData, authPrices, new Date().toISOString(), false);
}
