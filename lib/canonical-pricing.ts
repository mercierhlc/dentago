/**
 * Normalised pack / per-unit pricing for canonical supplier offers.
 * `dentago_supplier_products.price` stays the line (list) trade ex-VAT figure;
 * `price_per_unit_ex_vat` divides by pack quantity when known.
 */

/** Best-effort parse of "200 pk", "Box of 100", "2 x 50ml" style strings. */
export function inferPrimaryPackQuantity(packSize: string | null | undefined): number | null {
  if (!packSize?.trim()) return null;
  const s = packSize.toLowerCase().replace(/×/g, "x");

  const xOfY = s.match(/\b(\d+)\s*x\s*(\d+)\b/);
  if (xOfY) {
    const a = parseInt(xOfY[1], 10);
    const b = parseInt(xOfY[2], 10);
    if (a > 0 && b > 0 && a < 10000 && b < 10000) return a * b;
  }

  const numWord = s.match(
    /\b(\d+)\s*(pk|pack|packs|pcs|pc|ea|each|sachets?|bottles?|boxes?|rolls?|pairs?|cartridges?|tips?|brushes?|files?|gloves?)\b/i,
  );
  if (numWord) {
    const n = parseInt(numWord[1], 10);
    if (n > 0 && n < 100000) return n;
  }

  const boxOf = s.match(/\b(?:box|pack|bag)\s+of\s+(\d+)\b/i);
  if (boxOf) {
    const n = parseInt(boxOf[1], 10);
    if (n > 0 && n < 100000) return n;
  }

  const trailing = s.match(/\b(\d{1,6})\s*$/);
  if (trailing) {
    const n = parseInt(trailing[1], 10);
    if (n > 1 && n < 100000) return n;
  }

  return null;
}

export function stockStatusFromBoolean(stock: boolean): "in_stock" | "out_of_stock" {
  return stock ? "in_stock" : "out_of_stock";
}

/**
 * Line price ex-VAT ÷ units in that line's price (supplier_pack_quantity or inferred).
 * Returns null if line price invalid or divisor invalid.
 */
export function computePricePerUnitExVat(
  linePriceExVat: number,
  options: {
    supplierPackQuantity?: number | null;
    packSizeHint?: string | null;
  } = {},
): number | null {
  if (!Number.isFinite(linePriceExVat) || linePriceExVat <= 0) return null;
  const explicit = options.supplierPackQuantity;
  const inferred = inferPrimaryPackQuantity(options.packSizeHint ?? null);
  const q =
    explicit != null && explicit > 0
      ? explicit
      : inferred != null && inferred > 0
        ? inferred
        : 1;
  if (!Number.isFinite(q) || q <= 0) return null;
  return Math.round((linePriceExVat / q) * 1e6) / 1e6;
}

/** Fields to merge into `dentago_supplier_products` updates after a successful price/stock sync. */
export type SupplierOfferSyncPatch = {
  last_synced_at: string;
  stock_status: ReturnType<typeof stockStatusFromBoolean>;
  price_per_unit_ex_vat: number | null;
};

export function buildSupplierOfferSyncPatch(
  linePriceExVat: number,
  stock: boolean,
  options: {
    packSizeHint?: string | null;
    supplierPackQuantity?: number | null;
    syncedAt?: string;
  } = {},
): SupplierOfferSyncPatch {
  const syncedAt = options.syncedAt ?? new Date().toISOString();
  return {
    last_synced_at: syncedAt,
    stock_status: stockStatusFromBoolean(stock),
    price_per_unit_ex_vat: computePricePerUnitExVat(linePriceExVat, {
      supplierPackQuantity: options.supplierPackQuantity,
      packSizeHint: options.packSizeHint,
    }),
  };
}
