/**
 * GET /api/cron/refresh-clinic-prices
 *
 * Runs every 4 hours (see vercel.json). Iterates all clinics that have
 * connected supplier credentials and re-scrapes prices for the standard
 * product set, writing fresh results to price_cache.
 *
 * Clinics whose price_cache was updated within the last 3 hours are skipped
 * to avoid redundant scrapes.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import { logEvent } from "@/lib/events";
import { fetchAuthenticatedPrices } from "@/lib/scrapers";
import {
  finalizeSupplierPriceCronSuccess,
  maybeRecordSupplierNoPricesException,
} from "@/lib/supplier-sync-health";

const SKIP_IF_FRESHER_THAN_MS = 20 * 60 * 60 * 1000; // 20 hours (once daily cron)

const SYNC_PRODUCTS: { id: string; searchTerm: string }[] = [
  { id: "nitrile-gloves-large",  searchTerm: "cranberry nitrile gloves large 100" },
  { id: "septanest-articaine",   searchTerm: "septanest 4% articaine" },
  { id: "face-masks-iir",        searchTerm: "type IIR surgical face masks 50" },
  { id: "filtek-z250-a1",        searchTerm: "3M Filtek Z250 A1" },
  { id: "protaper-gold-f1",      searchTerm: "ProTaper Gold F1" },
  { id: "optim33-wipes",         searchTerm: "Optim 33 TB wipes" },
];

export async function GET(request: Request) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load all clinics with credentials
  const { data: allCreds, error: credsErr } = await supabaseAdmin
    .from("supplier_credentials")
    .select("clinic_id, username, encrypted_password, suppliers(name)");

  if (credsErr || !allCreds?.length) {
    return NextResponse.json({ ok: true, message: "No credentials found", synced: 0 });
  }

  // Group credentials by clinic
  const byClinic = new Map<string, { supplierName: string; username: string; password: string }[]>();
  for (const row of allCreds as any[]) {
    const supplierRaw = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const supplierName = supplierRaw?.name as string | undefined;
    if (!supplierName || !row.encrypted_password || !row.username) continue;
    let password: string;
    try { password = decrypt(row.encrypted_password); } catch { continue; }
    const list = byClinic.get(row.clinic_id) ?? [];
    list.push({ supplierName, username: row.username, password });
    byClinic.set(row.clinic_id, list);
  }

  // Check recency: find clinics that already have fresh cache
  const clinicIds = [...byClinic.keys()];
  const cutoff = new Date(Date.now() - SKIP_IF_FRESHER_THAN_MS).toISOString();
  const { data: recentSyncs } = await supabaseAdmin
    .from("price_cache")
    .select("clinic_id, fetched_at")
    .in("clinic_id", clinicIds)
    .gte("fetched_at", cutoff);

  const freshClinics = new Set((recentSyncs ?? []).map((r: any) => r.clinic_id));

  let synced = 0;
  let skipped = 0;

  // Map supplier display name -> dentago supplier id (integer).
  const supplierNames = Array.from(
    new Set(
      (allCreds ?? [])
        .map((r: any) => (Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers)?.name)
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

  for (const [clinicId, credentials] of byClinic) {
    if (freshClinics.has(clinicId)) {
      skipped++;
      continue;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    let anySuccess = false;
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
        anySuccess = true;
      } catch {
        // continue on per-product errors
      }
    }

    // Only stamp last_synced if prices were actually retrieved
    if (anySuccess) {
      await supabaseAdmin
        .from("supplier_credentials")
        .update({ last_synced: new Date().toISOString() })
        .eq("clinic_id", clinicId);
      synced++;
    }

    // Supplier-level hooks: mark which suppliers returned prices; open exceptions for suppliers
    // that returned none (deduped) and refresh supplier health snapshot.
    const productsAttempted = SYNC_PRODUCTS.length;
    const uniqueSupplierNames = Array.from(new Set(credentials.map((c) => c.supplierName)));
    await Promise.allSettled(
      uniqueSupplierNames.map(async (supplierName) => {
        const supplierId = nameToId.get(supplierName);
        if (!supplierId) return;
        if (suppliersWithAnyPrice.has(supplierName)) {
          await finalizeSupplierPriceCronSuccess(supplierId, supplierName, "refresh-clinic-prices", {
            rowsConsidered: 0,
            missingFromFeed: 0,
            clinic_id: clinicId,
            products_attempted: productsAttempted,
          });
          return;
        }
        await maybeRecordSupplierNoPricesException(supplierId, supplierName, {
          source: "refresh-clinic-prices",
          clinicId,
          productsAttempted,
        });
      }),
    );
  }

  await logEvent({
    event_type: "cron_price_refresh",
    entity_type: "system",
    entity_id: "cron",
    payload: { clinics_synced: synced, clinics_skipped: skipped, products_per_clinic: SYNC_PRODUCTS.length },
    source: "cron_refresh_clinic_prices",
  });

  return NextResponse.json({
    ok: true,
    clinics_synced: synced,
    clinics_skipped: skipped,
    message: `Refreshed ${synced} clinic(s), skipped ${skipped} (cache still fresh).`,
  });
}
