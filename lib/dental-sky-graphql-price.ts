/**
 * Dental Sky (Magento 2) GraphQL — UK B2B storefront.
 *
 * - `final_price` (promotional) and fallbacks are VAT-**inclusive** — same basis as JSON-LD `offers.price` on the PDP.
 * - We **persist** that inc-VAT amount on `dentago_supplier_products.price` so promos match and comparisons
 *   with other suppliers stay apples-to-apples without extra multipliers.
 */
export const UK_STANDARD_VAT_FACTOR = 1.2;

export function dentalSkyGraphqlIncVatEffectivePrice(p: {
  price?: { regularPrice?: { amount?: { value?: number } } };
  price_range?: {
    minimum_price?: {
      final_price?: { value?: number };
      regular_price?: { value?: number };
    };
  };
}): number {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const fin = p?.price_range?.minimum_price?.final_price?.value;
  if (typeof fin === "number" && fin > 0) return round2(fin);
  const legacy = p?.price?.regularPrice?.amount?.value;
  if (typeof legacy === "number" && legacy > 0) return round2(legacy);
  const reg = p?.price_range?.minimum_price?.regular_price?.value;
  if (typeof reg === "number" && reg > 0) return round2(reg);
  return 0;
}

/** Persisted `dentago_supplier_products.price` for Dental Sky — VAT-inclusive (uses promotional final_price when set). */
export function dentalSkyStoredIncVatFromGraphqlProduct(
  p: Parameters<typeof dentalSkyGraphqlIncVatEffectivePrice>[0],
): number {
  return dentalSkyGraphqlIncVatEffectivePrice(p);
}

/** @deprecated Use `dentalSkyStoredIncVatFromGraphqlProduct` — we now store inc-VAT everywhere. */
export function dentalSkyStoredTradeExVatFromGraphqlProduct(
  p: Parameters<typeof dentalSkyGraphqlIncVatEffectivePrice>[0],
): number {
  const inc = dentalSkyGraphqlIncVatEffectivePrice(p);
  if (inc <= 0) return 0;
  return Math.round((inc / UK_STANDARD_VAT_FACTOR) * 100) / 100;
}
