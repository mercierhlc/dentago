/**
 * Suppliers shown in marketplace search, filters, and demo seed data.
 * Names must match `dentago_suppliers.name` where those rows exist.
 */
export const MARKETPLACE_SUPPLIERS = [
  "Henry Schein",
  "DD Group",
  "Kent Express",
  "Dental Sky",
  "DHB",
  "Wrights",
] as const;

export type MarketplaceSupplierName = (typeof MARKETPLACE_SUPPLIERS)[number];

export const MARKETPLACE_SUPPLIER_SET = new Set<string>(MARKETPLACE_SUPPLIERS);

/** PostgREST `.in()` list for nested supplier name filters (order matches MARKETPLACE_SUPPLIERS). */
export const MARKETPLACE_SUPPLIER_NAMES_FOR_QUERY = [...MARKETPLACE_SUPPLIERS] as string[];

/**
 * Supplier IDs that have real product data with valid SKUs.
 * Used to filter the DB-level join so pagination/counts are accurate.
 * DHB=4, Dental Sky=3, DD Group=76
 */
export const ACTIVE_SUPPLIER_IDS = [3, 4, 76] as const;
export const ACTIVE_SUPPLIER_IDS_PG = `(${[3, 4, 76].join(",")})` as const;
