/**
 * POST /api/clinic/sync-prices
 *
 * Manual price sync trigger. Clears the price cache for the authenticated
 * clinic and queues a background re-scrape for the standard product set.
 *
 * Rate-limited to once per 15 minutes per clinic.
 *
 * Response: { ok: boolean, productsQueued: number, message: string }
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import { logEvent } from "@/lib/events";
import {
  finalizeSupplierPriceCronSuccess,
  maybeRecordSupplierNoPricesException,
} from "@/lib/supplier-sync-health";

const RATE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

// Standard product set for sync — matches SEARCH_TERMS in live-pricing route
const SYNC_PRODUCTS: { id: string; searchTerm: string }[] = [
  { id: "nitrile-gloves-large",  searchTerm: "cranberry nitrile gloves large 100" },
  { id: "septanest-articaine",   searchTerm: "septanest 4% articaine" },
  { id: "face-masks-iir",        searchTerm: "type IIR surgical face masks 50" },
  { id: "filtek-z250-a1",        searchTerm: "3M Filtek Z250 A1" },
  { id: "protaper-gold-f1",      searchTerm: "ProTaper Gold F1" },
  { id: "optim33-wipes",         searchTerm: "Optim 33 TB wipes" },
];

async function getClinicId(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

export async function POST(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });

  // Rate-limit: check last sync time from loop_runs or price_cache
  const { data: lastSync } = await supabaseAdmin
    .from("price_cache")
    .select("fetched_at")
    .eq("clinic_id", clinicId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSync?.fetched_at) {
    const age = Date.now() - new Date(lastSync.fetched_at).getTime();
    if (age < RATE_LIMIT_MS) {
      const waitMins = Math.ceil((RATE_LIMIT_MS - age) / 60000);
      return NextResponse.json({
        ok: false,
        error: `Price sync was just run. Please wait ${waitMins} minute${waitMins !== 1 ? "s" : ""} before syncing again.`,
      }, { status: 429 });
    }
  }

  // Load credentials
  const { data: creds } = await supabaseAdmin
    .from("supplier_credentials")
    .select("supplier_id, username, encrypted_password, suppliers(name)")
    .eq("clinic_id", clinicId);

  const supplierNames = Array.from(
    new Set(
      (creds ?? [])
        .map((c: any) => (Array.isArray(c.suppliers) ? c.suppliers[0] : c.suppliers)?.name)
        .filter((x: any) => typeof x === "string" && x.trim().length > 0),
    ),
  ) as string[];
  const nameToId = new Map<string, number>();
  if (supplierNames.length) {
    const { data: dsRows } = await supabaseAdmin
      .from("dentago_suppliers")
      .select("id, name")
      .in("name", supplierNames);
    (dsRows ?? []).forEach((r: any) => nameToId.set(String(r.name), Number(r.id)));
  }

  const credentials = (creds ?? [])
    .map((c: any) => {
      const enc = c.encrypted_password as string | null | undefined;
      const supplierRaw = Array.isArray(c.suppliers) ? c.suppliers[0] : c.suppliers;
      const supplierName = (supplierRaw?.name as string) ?? "";
      if (!supplierName || !enc || !c.username) return null;
      try {
        return { supplierName, username: c.username as string, password: decrypt(enc) };
      } catch {
        return null;
      }
    })
    .filter((c): c is { supplierName: string; username: string; password: string } => c !== null);

  if (!credentials.length) {
    return NextResponse.json({
      ok: false,
      error: "No connected suppliers. Connect a supplier first.",
    }, { status: 400 });
  }

  // Clear existing cache for this clinic so next live-pricing request re-fetches
  await supabaseAdmin
    .from("price_cache")
    .delete()
    .eq("clinic_id", clinicId);

  // Fire background scrapes — one per product × supplier (don't await, respond fast)
  const { fetchAuthenticatedPrices } = await import("@/lib/scrapers");

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  // Run scrapes sequentially to avoid hammering supplier sites simultaneously
  (async () => {
    const suppliersWithAnyPrice = new Set<string>();
    for (const product of SYNC_PRODUCTS) {
      try {
        const scraped = await fetchAuthenticatedPrices(credentials, product.searchTerm);
        if (!scraped.size) continue;

        for (const [supplierName] of scraped.entries()) {
          suppliersWithAnyPrice.add(supplierName);
        }

        const rows = [...scraped.entries()].map(([supplier, price]) => ({
          clinic_id: clinicId,
          product_id: product.id,
          supplier,
          price,
          stock: true,
          authenticated: true,
          fetched_at: new Date().toISOString(),
          expires_at: expiresAt,
        }));

        await supabaseAdmin
          .from("price_cache")
          .upsert(rows, { onConflict: "clinic_id,product_id,supplier" });
      } catch {
        // continue on per-product errors
      }
    }

    const productsAttempted = SYNC_PRODUCTS.length;
    const uniqueSupplierNames = Array.from(new Set(credentials.map((c) => c.supplierName)));
    await Promise.allSettled(
      uniqueSupplierNames.map(async (supplierName) => {
        const supplierId = nameToId.get(supplierName);
        if (!supplierId) return;
        if (suppliersWithAnyPrice.has(supplierName)) {
          await finalizeSupplierPriceCronSuccess(supplierId, supplierName, "clinic-sync-prices", {
            rowsConsidered: 0,
            missingFromFeed: 0,
            clinic_id: clinicId,
            products_attempted: productsAttempted,
          });
          return;
        }
        await maybeRecordSupplierNoPricesException(supplierId, supplierName, {
          source: "clinic-sync-prices",
          clinicId,
          productsAttempted,
        });
      }),
    );

    await logEvent({
      event_type: "price_sync_completed",
      entity_type: "clinic",
      entity_id: clinicId,
      payload: { products_count: SYNC_PRODUCTS.length, suppliers_count: credentials.length },
      source: "sync_prices_api",
    });
  })();

  await logEvent({
    event_type: "price_sync_triggered",
    entity_type: "clinic",
    entity_id: clinicId,
    payload: { suppliers_count: credentials.length },
    source: "sync_prices_api",
  });

  return NextResponse.json({
    ok: true,
    productsQueued: SYNC_PRODUCTS.length,
    message: `Syncing prices for ${SYNC_PRODUCTS.length} products across ${credentials.length} supplier${credentials.length !== 1 ? "s" : ""}. Prices will update within a few minutes.`,
  });
}
