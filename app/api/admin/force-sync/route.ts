/**
 * POST /api/admin/force-sync
 *
 * Triggers a full authenticated price sync for every clinic that has
 * credentials for the specified supplier. Runs synchronously so the
 * caller gets a real result count back.
 *
 * Body: { supplierName: string }
 * Auth: admin session cookie or OS dashboard cookie (requireAdminOrOsAuth).
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminOrOsAuth } from "@/lib/admin-auth";
import { decrypt } from "@/lib/crypto";
import { fetchAuthenticatedPrices, hasLivePriceScraper } from "@/lib/scrapers";
import { logEvent } from "@/lib/events";
import {
  finalizeSupplierPriceCronSuccess,
  recordSupplierSyncFailure,
} from "@/lib/supplier-sync-health";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauth = requireAdminOrOsAuth(request);
  if (unauth) return unauth;

  const { supplierName } = await request.json();
  if (!supplierName) {
    return NextResponse.json({ error: "supplierName required" }, { status: 400 });
  }

  if (!hasLivePriceScraper(supplierName)) {
    return NextResponse.json({
      error: `No live scraper registered for "${supplierName}".`,
      scrapers_available: [
        "Henry Schein",
        "DHB",
        "DD Group",
        "Kent Express",
        "Dental Sky",
        "Wrights",
      ],
      note:
        "Kent Express is registered but the HTTP implementation returns no price (Angular/OAuth) — use a headless flow or supplier API. DD/DHB/Dental Sky list prices also refresh via public crons.",
    }, { status: 422 });
  }

  // Get UUID for this supplier
  const { data: supplierRow } = await supabaseAdmin
    .from("dentago_suppliers")
    .select("id")
    .eq("name", supplierName)
    .maybeSingle();

  if (!supplierRow?.id) {
    return NextResponse.json({ error: `Supplier "${supplierName}" not found in dentago_suppliers` }, { status: 404 });
  }

  // Load all credentials for this supplier
  const { data: creds } = await supabaseAdmin
    .from("supplier_credentials")
    .select("clinic_id, username, encrypted_password")
    .eq("supplier_id", supplierRow.id);

  if (!creds?.length) {
    return NextResponse.json({ error: `No clinic credentials found for ${supplierName}` }, { status: 404 });
  }

  // Load all products for this supplier (cap 500)
  const { data: supplierProds } = await supabaseAdmin
    .from("dentago_supplier_products")
    .select("id, name")
    .eq("supplier_id", supplierRow.id)
    .limit(500);

  const products = (supplierProds ?? []).map((p: any) => ({ id: String(p.id), name: p.name as string }));

  if (products.length === 0) {
    return NextResponse.json({ error: `No products found in dentago_supplier_products for ${supplierName}` }, { status: 404 });
  }

  const supplierId = Number(supplierRow.id);
  if (!Number.isFinite(supplierId)) {
    return NextResponse.json({ error: "Invalid supplier id" }, { status: 500 });
  }

  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const BATCH = 8;
    let totalPrices = 0;
    let clinicsSynced = 0;

    for (const cred of creds as any[]) {
      let password: string;
      try { password = decrypt(cred.encrypted_password); } catch { continue; }

      const credentials = [{ supplierName, username: cred.username, password }];
      let clinicPrices = 0;

      for (let i = 0; i < products.length; i += BATCH) {
        const batch = products.slice(i, i + BATCH);
        await Promise.allSettled(batch.map(async (product) => {
          try {
            const scraped = await fetchAuthenticatedPrices(credentials, product.name);
            if (!scraped.size) return;

            const rows = [...scraped.entries()].map(([supplier, price]) => ({
              clinic_id: cred.clinic_id,
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
            clinicPrices += rows.length;
          } catch {
            // continue
          }
        }));
      }

      if (clinicPrices > 0) {
        await supabaseAdmin
          .from("supplier_credentials")
          .update({ last_synced: new Date().toISOString() })
          .eq("clinic_id", cred.clinic_id)
          .eq("supplier_id", supplierRow.id);
        clinicsSynced++;
        totalPrices += clinicPrices;
      }
    }

    await logEvent({
      event_type: "admin_force_sync",
      entity_type: "supplier",
      entity_id: String(supplierRow.id),
      payload: { supplier: supplierName, clinics_synced: clinicsSynced, prices_written: totalPrices, products_attempted: products.length },
      source: "admin_force_sync",
    });

    // Credential price sync: refresh catalogue health snapshot; do not run feed-gap heuristic.
    await finalizeSupplierPriceCronSuccess(supplierId, supplierName, "admin_force_sync", {
      rowsConsidered: 0,
      missingFromFeed: 0,
      clinics_synced: clinicsSynced,
      prices_written: totalPrices,
      products_attempted: products.length,
    });

    return NextResponse.json({
      ok: true,
      supplier: supplierName,
      clinics_synced: clinicsSynced,
      prices_written: totalPrices,
      products_attempted: products.length,
    });
  } catch (err) {
    await recordSupplierSyncFailure(supplierId, supplierName, err, { source: "admin_force_sync" });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
