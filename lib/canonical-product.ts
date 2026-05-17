/**
 * Dentago canonical product model (internal ops + marketplace).
 *
 * v1 rule: one row in `dentago_products` is the canonical identity (name, pack,
 * clinical grouping). Stable public handle: `canonical_slug` (+ optional numeric
 * `pack_quantity` / `pack_unit`). Every supplier listing is a row in
 * `dentago_supplier_products` pointing at that canonical id via `product_id`.
 *
 * Supplier offer normalisation (same table): `sku` (primary), `supplier_sku`
 * (mirror via trigger), list line `price` (trade ex-VAT), `price_per_unit_ex_vat`,
 * `supplier_pack_quantity`, `stock` + `stock_status`, `last_synced_at`, plus
 * `match_*` for mapping quality.
 *
 * Mapping / confidence / review queue live on `dentago_supplier_products` (`match_*`)
 * and `sku_match_review_log`. Supplier ops tables (`supplier_catalog_health`,
 * `supplier_ops_exceptions`, `supplier_reliability_snapshots`) wrap this for health,
 * exceptions, and scorecards — they do not replace the canonical table.
 */

export type CanonicalProductId = number;

export type SupplierProductId = number;

export type MatchStatus =
  | "approved"
  | "pending_review"
  | "rejected"
  | "unmatched"
  | null;

/** Relationship between two supplier SKUs relative to the same canonical (future). */
export type SkuEquivalenceClass =
  | "same"
  | "equivalent"
  | "substitute"
  | "different";

export const CANONICAL_PRODUCT_TABLE = "dentago_products" as const;
export const SUPPLIER_OFFER_TABLE = "dentago_supplier_products" as const;
