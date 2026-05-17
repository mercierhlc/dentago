/**
 * Shared Dental Sky price sync (category crawl + SKU backfill → Supabase).
 * Persists **trade ex-VAT** on `dentago_supplier_products.price` (promotional inc from GraphQL ÷ 1.2).
 * Used by `/api/cron/refresh-dental-sky-prices` and `scripts/run-dental-sky-price-refresh-local.ts`.
 */
import {
  enrichDentalSkyMapWithMissingSkus,
  fetchDentalSkySkuPriceMap,
} from "@/lib/dental-sky-catalog-fetch";
import { buildSupplierOfferSyncPatch } from "@/lib/canonical-pricing";
import { logEvent } from "@/lib/events";
import { supabaseAdmin } from "@/lib/supabase";
import { finalizeSupplierPriceCronSuccess, recordSupplierSyncFailure } from "@/lib/supplier-sync-health";

export type DentalSkyPriceRefreshResult = {
  ok: true;
  supplier: "Dental Sky";
  mode: "full" | "skus_only";
  skusFetched: number;
  rowsConsidered: number;
  rowsRefreshed: number;
  priceOrStockChanged: number;
  missingFromFeed: number;
  skuBackfillAttempted: number;
  skuBackfillResolved: number;
  historyRowsWritten: number;
  elapsedMs: number;
  timestamp: string;
};

export type RunDentalSkyPriceRefreshOptions = {
  /** If set, only GraphQL-fetch these SKUs and update matching rows (skips category crawl). */
  skusOnly?: string[];
};

export async function runDentalSkyPriceRefresh(
  options?: RunDentalSkyPriceRefreshOptions,
): Promise<DentalSkyPriceRefreshResult> {
  const t0 = Date.now();
  const mode: "full" | "skus_only" = options?.skusOnly?.length ? "skus_only" : "full";
  const skuFilter =
    options?.skusOnly?.length && mode === "skus_only"
      ? new Set(options.skusOnly.map((s) => s.toString().trim()).filter(Boolean))
      : null;

  const { data: dsSupplier } = await supabaseAdmin
    .from("dentago_suppliers")
    .select("id")
    .eq("name", "Dental Sky")
    .single();
  if (!dsSupplier) {
    throw new Error("Dental Sky supplier row missing");
  }
  const dsId = dsSupplier.id as number;

  try {
    let fresh = new Map<string, { price: number; stock: boolean }>();
    let backfillMeta = { skusAttempted: 0, skusNewlyResolved: 0 };

    if (skuFilter && skuFilter.size > 0) {
      const list = [...skuFilter];
      backfillMeta = await enrichDentalSkyMapWithMissingSkus(fresh, list, {
        batchSize: 25,
        delayMs: 100,
      });
    } else {
      fresh = await fetchDentalSkySkuPriceMap({
        categoryConcurrency: 5,
        pageDelayMs: 45,
      });
    }

    const existing: Array<{
    id: number;
    product_id: number;
    sku: string | null;
    price: number;
    stock: boolean | null;
    pack_size: string | null;
    supplier_pack_quantity: number | null;
  }> = [];
  {
    let off = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from("dentago_supplier_products")
        .select("id, product_id, sku, price, stock, pack_size, supplier_pack_quantity")
        .eq("supplier_id", dsId)
        .range(off, off + PAGE - 1);
      if (error) break;
      if (!data || data.length === 0) break;
      existing.push(...(data as typeof existing));
      if (data.length < PAGE) break;
      off += PAGE;
    }
  }

  if (!skuFilter?.size) {
    const skusForBackfill = existing.map((r) => r.sku).filter(Boolean) as string[];
    backfillMeta = await enrichDentalSkyMapWithMissingSkus(fresh, skusForBackfill, {
      batchSize: 25,
      delayMs: 100,
    });
  }

  const now = new Date().toISOString();
  const historyRows: Array<{
    supplier_id: number;
    product_id: number;
    sku: string | null;
    price: number;
    stock: boolean;
    source: string;
    recorded_at: string;
  }> = [];
  let rowsRefreshed = 0;
  let priceOrStockChanged = 0;
  let missingFromFeed = 0;

  for (const row of existing) {
    if (!row.sku) continue;
    if (skuFilter && !skuFilter.has(row.sku)) continue;
    const f = fresh.get(row.sku);
    if (!f) {
      missingFromFeed++;
      continue;
    }

    const priceChanged = Math.abs(f.price - Number(row.price)) > 0.001;
    const stockChanged = f.stock !== Boolean(row.stock);

    const syncPatch = buildSupplierOfferSyncPatch(f.price, f.stock, {
      packSizeHint: row.pack_size,
      supplierPackQuantity: row.supplier_pack_quantity,
      syncedAt: now,
    });
    const { error: upErr } = await supabaseAdmin
      .from("dentago_supplier_products")
      .update({
        price: f.price,
        stock: f.stock,
        updated_at: now,
        ...syncPatch,
      })
      .eq("id", row.id);
    if (upErr) continue;

    rowsRefreshed++;
    if (priceChanged || stockChanged) {
      historyRows.push({
        supplier_id: dsId,
        product_id: row.product_id,
        sku: row.sku,
        price: f.price,
        stock: f.stock,
        source: "cron",
        recorded_at: now,
      });
      priceOrStockChanged++;
    }
  }

  if (historyRows.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < historyRows.length; i += CHUNK) {
      await supabaseAdmin.from("dentago_price_history").insert(historyRows.slice(i, i + CHUNK));
    }
  }

  const rowsInScope = skuFilter?.size
    ? existing.filter((r) => r.sku && skuFilter.has(r.sku)).length
    : existing.length;

  const elapsedMs = Date.now() - t0;
  await logEvent({
    event_type: "cron_price_refresh",
    entity_type: "supplier",
    entity_id: String(dsId),
    payload: {
      supplier: "Dental Sky",
      mode,
      skusFetched: fresh.size,
      rowsConsidered: rowsInScope,
      rowsRefreshed,
      priceOrStockChanged,
      missingFromFeed,
      historyRowsWritten: historyRows.length,
      skuBackfillAttempted: backfillMeta.skusAttempted,
      skuBackfillResolved: backfillMeta.skusNewlyResolved,
      elapsedMs,
    },
    source: "refresh-dental-sky-prices",
  });

  const result: DentalSkyPriceRefreshResult = {
    ok: true,
    supplier: "Dental Sky",
    mode,
    skusFetched: fresh.size,
    rowsConsidered: rowsInScope,
    rowsRefreshed,
    priceOrStockChanged,
    missingFromFeed,
    skuBackfillAttempted: backfillMeta.skusAttempted,
    skuBackfillResolved: backfillMeta.skusNewlyResolved,
    historyRowsWritten: historyRows.length,
    elapsedMs,
    timestamp: now,
  };

  await finalizeSupplierPriceCronSuccess(dsId, "Dental Sky", "refresh-dental-sky-prices", {
    ...result,
  } as Record<string, unknown>);

  return result;
  } catch (e) {
    await recordSupplierSyncFailure(dsId, "Dental Sky", e, { source: "refresh-dental-sky-prices" });
    throw e;
  }
}
