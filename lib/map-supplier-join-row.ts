import { DENTAL_SKY_SUPPLIER_NAME, supplierPriceCompareIncVat } from "@/lib/supplier-price-compare";
import { UK_STANDARD_VAT_FACTOR } from "@/lib/dental-sky-graphql-price";

/**
 * Normalise a joined `dentago_supplier_products` + `dentago_suppliers` row for API responses.
 * Dental Sky stored `price` is VAT-inclusive (promotional list from GraphQL).
 */
export function mapSupplierJoinRow(
  sp: {
    price: unknown;
    stock: unknown;
    delivery: unknown;
    sku: unknown;
    pack_size?: string | null;
    dentago_suppliers?: { id?: unknown; name?: unknown } | null;
  },
  productPackSize: string | null | undefined,
  connectedSupplierIds: number[] | null,
) {
  const name = (sp.dentago_suppliers?.name as string) ?? "Unknown";
  const id = sp.dentago_suppliers?.id as number | undefined;
  const price = parseFloat(String(sp.price));
  const priceCompareIncVat = supplierPriceCompareIncVat(name, price);
  const priceIncVat = price;
  const tradePriceExVat =
    name === DENTAL_SKY_SUPPLIER_NAME && Number.isFinite(price) && price > 0
      ? Math.round((price / UK_STANDARD_VAT_FACTOR) * 100) / 100
      : undefined;

  return {
    name,
    id,
    price,
    priceCompareIncVat,
    priceIncVat,
    stock: Boolean(sp.stock),
    delivery: sp.delivery as string,
    sku: sp.sku as string,
    packSize: sp.pack_size ?? productPackSize,
    isConnected: connectedSupplierIds !== null && connectedSupplierIds.includes(id as number),
    tradePriceExVat,
  };
}
