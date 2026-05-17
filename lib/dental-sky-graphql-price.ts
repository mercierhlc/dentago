/**
 * Dental Sky (Magento 2) GraphQL — UK B2B storefront.
 *
 * - `final_price` (promotional when set) and fallbacks are VAT-**inclusive** on the wire
 *   (same basis as JSON-LD `offers.price` on the PDP).
 * - We **persist** `dentago_supplier_products.price` as **UK trade ex-VAT** (20%): effective inc ÷ 1.2,
 *   so promo prices match trade lists and the app can show ex + inc consistently with other suppliers.
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

/** Persisted `dentago_supplier_products.price` for Dental Sky — ex-VAT trade (promo via `final_price` → inc, then ÷ 1.2). */
export function dentalSkyStoredExVatPromoFromGraphqlProduct(
  p: Parameters<typeof dentalSkyGraphqlIncVatEffectivePrice>[0],
): number {
  const inc = dentalSkyGraphqlIncVatEffectivePrice(p);
  if (inc <= 0) return 0;
  return Math.round((inc / UK_STANDARD_VAT_FACTOR) * 100) / 100;
}

/** @deprecated Old pipeline stored inc-VAT; use `dentalSkyStoredExVatPromoFromGraphqlProduct`. */
export function dentalSkyStoredIncVatFromGraphqlProduct(
  p: Parameters<typeof dentalSkyGraphqlIncVatEffectivePrice>[0],
): number {
  return dentalSkyGraphqlIncVatEffectivePrice(p);
}

/** @deprecated Use `dentalSkyStoredExVatPromoFromGraphqlProduct` — same numeric result. */
export function dentalSkyStoredTradeExVatFromGraphqlProduct(
  p: Parameters<typeof dentalSkyGraphqlIncVatEffectivePrice>[0],
): number {
  return dentalSkyStoredExVatPromoFromGraphqlProduct(p);
}
