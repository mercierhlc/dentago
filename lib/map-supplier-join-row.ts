import { supplierPriceCompareIncVat, tradeListExVatIncVat } from "@/lib/supplier-price-compare";

/**
 * Normalise a joined `dentago_supplier_products` + `dentago_suppliers` row for API responses.
 * `dentago_supplier_products.price` is stored as trade **ex-VAT**; we always expose ex + inc.
 */
export function mapSupplierJoinRow(
  sp: {
    price: unknown;
    stock: unknown;
    delivery: unknown;
    sku: unknown;
    pack_size?: string | null;
    supplier_sku?: string | null;
    price_per_unit_ex_vat?: unknown;
    last_synced_at?: string | null;
    stock_status?: string | null;
    dentago_suppliers?: { id?: unknown; name?: unknown } | null;
  },
  productPackSize: string | null | undefined,
  connectedSupplierIds: number[] | null,
) {
  const rawSku = String(sp.sku ?? "").trim();
  const rawSupplierSku = String(sp.supplier_sku ?? "").trim();
  /** Many feeds fill `supplier_sku` first; legacy rows use `sku` — expose one non-empty value everywhere. */
  const displaySku = rawSupplierSku || rawSku;

  const name = (sp.dentago_suppliers?.name as string) ?? "Unknown";
  const id = sp.dentago_suppliers?.id as number | undefined;
  const storedExVat = parseFloat(String(sp.price));
  const { priceExVat, priceIncVat } = tradeListExVatIncVat(storedExVat);
  const priceCompareIncVat = supplierPriceCompareIncVat(name, storedExVat);
  const ppuRaw = sp.price_per_unit_ex_vat;
  const ppu =
    ppuRaw == null || ppuRaw === ""
      ? null
      : (() => {
          const n = parseFloat(String(ppuRaw));
          return Number.isFinite(n) && n > 0 ? n : null;
        })();

  return {
    name,
    id,
    /** Primary list figure — trade ex-VAT (matches `dentago_supplier_products.price`). */
    price: priceExVat,
    priceExVat,
    priceIncVat,
    priceCompareIncVat,
    // Show in-stock optimistically unless the clinic has explicitly connected THIS supplier.
    // Real stock data only surfaces once the clinic has authenticated credentials for that supplier.
    stock: (!connectedSupplierIds || connectedSupplierIds.length === 0 || !connectedSupplierIds.includes(id as number)) ? true : Boolean(sp.stock),
    stockStatus: (!connectedSupplierIds || connectedSupplierIds.length === 0 || !connectedSupplierIds.includes(id as number)) ? "in_stock" : ((sp.stock_status as string | null | undefined) ?? undefined),
    delivery: sp.delivery as string,
    sku: displaySku,
    supplierSku: displaySku,
    packSize: sp.pack_size ?? productPackSize,
    pricePerUnitExVat: ppu,
    lastSyncedAt: sp.last_synced_at ?? undefined,
    isConnected: connectedSupplierIds !== null && connectedSupplierIds.includes(id as number),
    /** @deprecated Use `priceExVat` — same value. */
    tradePriceExVat: Number.isFinite(priceExVat) && priceExVat > 0 ? priceExVat : undefined,
  };
}
