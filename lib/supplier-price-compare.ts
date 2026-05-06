export const DENTAL_SKY_SUPPLIER_NAME = "Dental Sky";

/**
 * Normalize stored `dentago_supplier_products.price` to VAT-inclusive for comparison.
 * Dental Sky (and other marketplace suppliers) use an inc-VAT list price in DB for Dental Sky after 2026-05 refresh.
 */
export function supplierPriceCompareIncVat(_supplierName: string, storedPrice: number): number {
  if (!Number.isFinite(storedPrice) || storedPrice <= 0) return storedPrice;
  return storedPrice;
}
