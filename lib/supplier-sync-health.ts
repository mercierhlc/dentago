/**
 * Post-supplier-sync hooks for `supplier_catalog_health` + `supplier_ops_exceptions`.
 * Keeps the Supplier Ops console fed from real cron/sync runs (Priority 1).
 */
import { logEvent } from "@/lib/events";
import { supabaseAdmin } from "@/lib/supabase";

type CatalogStatRow = {
  supplier_id: number;
  sku_rows: number;
  pending_review: number;
  mapping_ok: number;
  mapping_blocked: number;
  missing_price: number;
  stale_rows: number;
  last_row_update_at: string | null;
};

function statCounts(stat: CatalogStatRow | null) {
  return {
    supplier_product_count: stat?.sku_rows ?? 0,
    pending_review_count: stat?.pending_review ?? 0,
    mapping_ok_count: stat?.mapping_ok ?? 0,
    mapping_blocked_count: stat?.mapping_blocked ?? 0,
    missing_price_count: stat?.missing_price ?? 0,
    stale_row_count: stat?.stale_rows ?? 0,
    last_row_update_at: stat?.last_row_update_at ?? null,
  };
}

async function loadCatalogStat(supplierId: number): Promise<CatalogStatRow | null> {
  const { data, error } = await supabaseAdmin
    .from("supplier_ops_catalog_stats")
    .select("*")
    .eq("supplier_id", supplierId)
    .maybeSingle();
  if (error) {
    console.error("[supplier-sync-health] supplier_ops_catalog_stats:", error.message);
    return null;
  }
  return data as CatalogStatRow | null;
}

export type SupplierSyncSuccessMeta = Record<string, unknown>;

export async function recordSupplierSyncSuccess(
  supplierId: number,
  _supplierName: string,
  _meta?: SupplierSyncSuccessMeta,
): Promise<void> {
  const now = new Date().toISOString();
  const stat = await loadCatalogStat(supplierId);
  const counts = statCounts(stat);
  const { error } = await supabaseAdmin.from("supplier_catalog_health").upsert(
    {
      supplier_id: supplierId,
      sync_status: "ok",
      last_success_at: now,
      last_attempt_at: now,
      last_error: null,
      ...counts,
      updated_at: now,
    },
    { onConflict: "supplier_id" },
  );
  if (error) console.error("[supplier-sync-health] success upsert:", error.message);
}

/** After a successful public-catalogue price cron: health row + optional feed-gap exception. */
export async function finalizeSupplierPriceCronSuccess(
  supplierId: number,
  supplierName: string,
  source: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await recordSupplierSyncSuccess(supplierId, supplierName, payload);
  await maybeRecordSupplierFeedGapException(
    supplierId,
    supplierName,
    Number(payload.missingFromFeed ?? 0),
    Number(payload.rowsConsidered ?? 0),
    { source },
  );
}

const MAX_ERR_LEN = 4000;

export async function recordSupplierSyncFailure(
  supplierId: number,
  supplierName: string,
  err: unknown,
  options?: { source?: string },
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const now = new Date().toISOString();
  const stat = await loadCatalogStat(supplierId);
  const counts = statCounts(stat);

  const { error: upErr } = await supabaseAdmin.from("supplier_catalog_health").upsert(
    {
      supplier_id: supplierId,
      sync_status: "failed",
      last_attempt_at: now,
      last_error: message.slice(0, MAX_ERR_LEN),
      ...counts,
      updated_at: now,
    },
    { onConflict: "supplier_id" },
  );
  if (upErr) console.error("[supplier-sync-health] failure upsert:", upErr.message);

  const { error: exErr } = await supabaseAdmin.from("supplier_ops_exceptions").insert({
    kind: "sync_failed",
    severity: "high",
    supplier_id: supplierId,
    title: `${supplierName} sync failed`,
    detail: {
      message: message.slice(0, MAX_ERR_LEN),
      source: options?.source ?? "cron",
      at: now,
    },
    status: "open",
  });
  if (exErr) console.error("[supplier-sync-health] exception insert:", exErr.message);

  await logEvent({
    event_type: "cron_price_refresh",
    entity_type: "supplier",
    entity_id: String(supplierId),
    payload: {
      supplier: supplierName,
      failed: true,
      error: message.slice(0, 500),
      source: options?.source,
    },
    source: "supplier_sync_health",
  }).catch(() => {});
}

/**
 * When many catalogue SKUs have no feed match, open a single medium-severity
 * exception so ops can investigate catalogue drift (deduped within a window).
 */
export async function maybeRecordSupplierFeedGapException(
  supplierId: number,
  supplierName: string,
  missingFromFeed: number,
  rowsConsidered: number,
  options?: { source?: string },
): Promise<void> {
  if (rowsConsidered < 30 || missingFromFeed < 25) return;
  const ratio = missingFromFeed / rowsConsidered;
  if (ratio < 0.08) return;

  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: recent, error: qErr } = await supabaseAdmin
    .from("supplier_ops_exceptions")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("kind", "supplier_error")
    .eq("status", "open")
    .ilike("title", "%catalogue SKUs missing from supplier feed%")
    .gte("created_at", since)
    .limit(1);
  if (qErr || (recent?.length ?? 0) > 0) return;

  const { error } = await supabaseAdmin.from("supplier_ops_exceptions").insert({
    kind: "supplier_error",
    severity: "medium",
    supplier_id: supplierId,
    title: `${supplierName}: many catalogue SKUs missing from supplier feed`,
    detail: {
      missingFromFeed,
      rowsConsidered,
      ratio: Math.round(ratio * 1000) / 1000,
      source: options?.source ?? "cron",
    },
    status: "open",
  });
  if (error) console.error("[supplier-sync-health] feed gap exception:", error.message);
}

/**
 * When a credential-based sync runs but returns zero prices for a supplier,
 * create a deduped medium-severity exception. This usually indicates:
 * - bad credentials
 * - WAF / IP blocking
 * - scraper drift
 * - supplier site outage
 *
 * We intentionally do NOT mark the supplier as "failed" in supplier_catalog_health
 * for these cases, because the underlying public catalogue sync may still be healthy.
 */
export async function maybeRecordSupplierNoPricesException(
  supplierId: number,
  supplierName: string,
  options: { source: string; clinicId?: string; productsAttempted: number },
): Promise<void> {
  if (options.productsAttempted < 3) return;

  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: recent, error: qErr } = await supabaseAdmin
    .from("supplier_ops_exceptions")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("kind", "supplier_error")
    .eq("status", "open")
    .ilike("title", "%returned no prices during credential sync%")
    .gte("created_at", since)
    .limit(1);
  if (qErr || (recent?.length ?? 0) > 0) return;

  const { error } = await supabaseAdmin.from("supplier_ops_exceptions").insert({
    kind: "supplier_error",
    severity: "medium",
    supplier_id: supplierId,
    title: `${supplierName} returned no prices during credential sync`,
    detail: {
      source: options.source,
      clinic_id: options.clinicId,
      products_attempted: options.productsAttempted,
    },
    status: "open",
  });
  if (error) console.error("[supplier-sync-health] no prices exception:", error.message);
}
