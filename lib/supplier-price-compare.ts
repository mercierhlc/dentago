import { UK_STANDARD_VAT_FACTOR } from "@/lib/dental-sky-graphql-price";

export const DENTAL_SKY_SUPPLIER_NAME = "Dental Sky";

/**
 * Catalogue `dentago_supplier_products.price` is the UK **trade list ex-VAT** figure
 * (Dental Sky: promotional GraphQL inc-VAT → ÷ 1.2 at ingest; DD/DHB HTML/catalog scrapes).
 *
 * Sorting / “best price” comparisons use VAT-inclusive totals derived here.
 */
export function tradeListExVatIncVat(storedExVat: number): {
  priceExVat: number;
  priceIncVat: number;
} {
  if (!Number.isFinite(storedExVat) || storedExVat <= 0) {
    return { priceExVat: storedExVat, priceIncVat: storedExVat };
  }
  const priceExVat = Math.round(storedExVat * 100) / 100;
  const priceIncVat = Math.round(storedExVat * UK_STANDARD_VAT_FACTOR * 100) / 100;
  return { priceExVat, priceIncVat };
}

/** VAT-inclusive amount for comparing supplier rows (min / max / savings). */
export function supplierPriceCompareIncVat(_supplierName: string, storedExVat: number): number {
  return tradeListExVatIncVat(storedExVat).priceIncVat;
}
