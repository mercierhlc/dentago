import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt, decrypt } from "@/lib/crypto";
import { logEvent } from "@/lib/events";
import {
  finalizeSupplierPriceCronSuccess,
  maybeRecordSupplierNoPricesException,
  recordSupplierSyncFailure,
} from "@/lib/supplier-sync-health";

/**
 * Full sync: scrape every product in dentago_supplier_products for this supplier.
 * Runs fire-and-forget on connect so the response stays fast.
 * Batches in groups of 10 to avoid hammering the supplier site.
 */
async function triggerInitialSync(
  clinicId: string,
  supplierName: string,
  username: string,
  encryptedPassword: string
) {
  let supplierId: number | null = null;
  try {
    const password = decrypt(encryptedPassword);
    const { fetchAuthenticatedPrices, hasLivePriceScraper } = await import("@/lib/scrapers");

    if (!hasLivePriceScraper(supplierName)) {
      console.log(`[credentials] No live scraper for ${supplierName} — skipping sync`);
      return;
    }

    // Load all products for this supplier from dentago_supplier_products
    // Join via dentago_suppliers to match by name
    const { data: supplierRow } = await supabaseAdmin
      .from("dentago_suppliers")
      .select("id")
      .eq("name", supplierName)
      .maybeSingle();
    supplierId = supplierRow?.id ? Number(supplierRow.id) : null;

    let products: { id: string; name: string }[] = [];

    if (supplierRow?.id) {
      const { data: supplierProds } = await supabaseAdmin
        .from("dentago_supplier_products")
        .select("id, name")
        .eq("supplier_id", supplierRow.id)
        .limit(500); // cap at 500 per session — cron handles the long tail
      products = (supplierProds ?? []).map((p: any) => ({ id: String(p.id), name: p.name }));
    }

    // Fallback: use the standard 6-term set if no supplier products found
    if (products.length === 0) {
      products = [
        { id: "nitrile-gloves-large",  name: "cranberry nitrile gloves large 100" },
        { id: "septanest-articaine",   name: "septanest 4% articaine" },
        { id: "face-masks-iir",        name: "type IIR surgical face masks 50" },
        { id: "filtek-z250-a1",        name: "3M Filtek Z250 A1" },
        { id: "protaper-gold-f1",      name: "ProTaper Gold F1" },
        { id: "optim33-wipes",         name: "Optim 33 TB wipes" },
      ];
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const BATCH = 10;
    let anySuccess = false;
    let supplierAnyPrice = false;

    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(async (product) => {
        try {
          const scraped = await fetchAuthenticatedPrices(
            [{ supplierName, username, password }],
            product.name
          );
          if (!scraped.size) return;
          if (scraped.has(supplierName)) supplierAnyPrice = true;

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
          // continue
        }
      }));
    }

    if (anySuccess) {
      await supabaseAdmin
        .from("supplier_credentials")
        .update({ last_synced: new Date().toISOString() })
        .eq("clinic_id", clinicId);
    }

    if (supplierId) {
      if (supplierAnyPrice) {
        await finalizeSupplierPriceCronSuccess(supplierId, supplierName, "credentials-initial-sync", {
          rowsConsidered: 0,
          missingFromFeed: 0,
          clinic_id: clinicId,
          products_attempted: products.length,
        });
      } else {
        await maybeRecordSupplierNoPricesException(supplierId, supplierName, {
          source: "credentials-initial-sync",
          clinicId,
          productsAttempted: products.length,
        });
      }
    }

    await logEvent({
      event_type: "price_sync_completed",
      entity_type: "clinic",
      entity_id: clinicId,
      payload: { trigger: "on_connect", supplier: supplierName, products_attempted: products.length },
      source: "credentials_api",
    });
  } catch (err) {
    if (supplierId) {
      await recordSupplierSyncFailure(supplierId, supplierName, err, { source: "credentials-initial-sync" }).catch(() => {});
    }
    // don't crash the connect flow if sync fails
  }
}

async function getClinicId(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts").select("id").eq("auth_user_id", user.id).single();
  return clinic?.id ?? null;
}

// Resolve UUID in `public.suppliers` for FK on supplier_credentials. Catalogue rows are
// created on demand when missing so connect never 404s after dentago_suppliers exists.
async function ensureSupplierUuid(dentaGoId: number): Promise<string | null> {
  const { data: ds, error: dsErr } = await supabaseAdmin
    .from("dentago_suppliers")
    .select("name")
    .eq("id", dentaGoId)
    .single();
  if (dsErr || !ds?.name) return null;

  const { data: existing } = await supabaseAdmin
    .from("suppliers")
    .select("id")
    .eq("name", ds.name)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: upserted, error: upErr } = await supabaseAdmin
    .from("suppliers")
    .upsert({ name: ds.name }, { onConflict: "name" })
    .select("id")
    .single();
  if (!upErr && upserted?.id) return upserted.id;

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("suppliers")
    .insert({ name: ds.name })
    .select("id")
    .single();
  if (!insErr && inserted?.id) return inserted.id;

  const { data: retry } = await supabaseAdmin
    .from("suppliers")
    .select("id")
    .eq("name", ds.name)
    .maybeSingle();
  return retry?.id ?? null;
}

async function getSupplierUuidIfExists(dentaGoId: number): Promise<string | null> {
  const { data: ds, error: dsErr } = await supabaseAdmin
    .from("dentago_suppliers")
    .select("name")
    .eq("id", dentaGoId)
    .single();
  if (dsErr || !ds?.name) return null;
  const { data: sup } = await supabaseAdmin
    .from("suppliers")
    .select("id")
    .eq("name", ds.name)
    .maybeSingle();
  return sup?.id ?? null;
}

// GET — list connected supplier credentials (passwords redacted)
export async function GET(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("supplier_credentials")
    .select("id, supplier_id, username, last_synced, created_at, suppliers(id, name)")
    .eq("clinic_id", clinicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Map UUID supplier back to dentago_suppliers integer id so frontend can match
  const supplierNames = (data ?? []).map((c: any) => c.suppliers?.name).filter(Boolean);
  let nameToIntId: Record<string, number> = {};
  if (supplierNames.length > 0) {
    const { data: ds } = await supabaseAdmin
      .from("dentago_suppliers").select("id, name").in("name", supplierNames);
    (ds ?? []).forEach((s: any) => { nameToIntId[s.name] = s.id; });
  }

  const credentials = (data ?? []).map((c: any) => ({
    id: c.id,
    supplier_id: nameToIntId[c.suppliers?.name] ?? null, // integer id for frontend
    username: c.username,
    last_synced: c.last_synced,
    dentago_suppliers: {
      id: nameToIntId[c.suppliers?.name] ?? null,
      name: c.suppliers?.name ?? "",
    },
  }));

  return NextResponse.json({ credentials });
}

// POST — save or update credentials for a supplier
export async function POST(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { supplierId, username, password } = await request.json();
  if (!supplierId || !username || !password) {
    return NextResponse.json({ error: "supplierId, username and password are required" }, { status: 400 });
  }

  // Get UUID for this supplier (create catalogue row if missing)
  const supplierUuid = await ensureSupplierUuid(supplierId);
  if (!supplierUuid) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const { data: dsRow } = await supabaseAdmin
    .from("dentago_suppliers").select("name").eq("id", supplierId).single();
  const supplierNameForVerify: string = dsRow?.name ?? "";

  const skipLiveVerify =
    process.env.SKIP_SUPPLIER_LIVE_VERIFY === "1" ||
    process.env.CLINIC_CREDENTIALS_SKIP_LIVE_VERIFY === "1";

  // Live login check — must pass before credentials are saved.
  // Try twice with a short delay to handle transient WAF/network blocks.
  // If both attempts fail, reject with a clear error so the clinic fixes their details.
  if (supplierNameForVerify && !skipLiveVerify) {
    const { hasLivePriceScraper, fetchAuthenticatedPrices } = await import("@/lib/scrapers");
    if (hasLivePriceScraper(supplierNameForVerify)) {
      let verified = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (attempt === 2) await new Promise(r => setTimeout(r, 2000));
          const testResult = await fetchAuthenticatedPrices(
            [{ supplierName: supplierNameForVerify, username, password }],
            "nitrile gloves"
          );
          if (testResult.has(supplierNameForVerify)) { verified = true; break; }
        } catch {
          // network error — continue to next attempt
        }
      }
      if (!verified) {
        return NextResponse.json(
          { error: `We couldn't log in to ${supplierNameForVerify} with those details. Double-check your username and password on the ${supplierNameForVerify} website, then try again.` },
          { status: 422 },
        );
      }
    }
  }

  // Check if credential already exists, then update or insert
  const { data: existing } = await supabaseAdmin
    .from("supplier_credentials")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("supplier_id", supplierUuid)
    .maybeSingle();

  const credPayload = {
    clinic_id: clinicId,
    supplier_id: supplierUuid,
    username,
    encrypted_password: encrypt(password),
  };

  let credError;
  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from("supplier_credentials")
      .update({ username, encrypted_password: encrypt(password) })
      .eq("id", existing.id);
    credError = error;
  } else {
    const { error } = await supabaseAdmin
      .from("supplier_credentials")
      .insert(credPayload);
    credError = error;
  }

  if (credError) return NextResponse.json({ error: credError.message }, { status: 500 });

  // Also ensure clinic_suppliers row exists (uses integer dentago_suppliers id)
  await supabaseAdmin
    .from("clinic_suppliers")
    .upsert({ clinic_id: clinicId, supplier_id: supplierId }, { onConflict: "clinic_id,supplier_id" });

  await logEvent({ event_type: 'supplier_connected', entity_type: 'clinic', entity_id: clinicId, payload: { supplier_id: supplierId }, source: 'credentials_api' });

  // Fire initial price sync in background — don't await so connect responds fast
  // supplierNameForVerify was already fetched above from dentago_suppliers
  if (supplierNameForVerify) {
    triggerInitialSync(clinicId, supplierNameForVerify, username, encrypt(password));
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE — remove credentials for a supplier
export async function DELETE(request: Request) {
  const clinicId = await getClinicId(request);
  if (!clinicId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { supplierId } = await request.json();
  if (!supplierId) return NextResponse.json({ error: "supplierId required" }, { status: 400 });

  const supplierUuid = await getSupplierUuidIfExists(supplierId);

  await Promise.all([
    supplierUuid
      ? supabaseAdmin
          .from("supplier_credentials")
          .delete()
          .eq("clinic_id", clinicId)
          .eq("supplier_id", supplierUuid)
      : Promise.resolve(),
    supabaseAdmin
      .from("clinic_suppliers")
      .delete()
      .eq("clinic_id", clinicId)
      .eq("supplier_id", supplierId),
  ]);

  await logEvent({ event_type: 'supplier_disconnected', entity_type: 'clinic', entity_id: clinicId, payload: { supplier_id: supplierId }, source: 'credentials_api' });

  return NextResponse.json({ success: true });
}
