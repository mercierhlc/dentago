/**
 * The six marketplace suppliers Dentago prioritises for catalogue + price operations.
 * Names must match `dentago_suppliers.name` exactly.
 */
export type MainSupplierDef = {
  name: string;
  /** Where list/catalogue prices are refreshed in bulk */
  cataloguePrices: "public_feed" | "clinic_login";
  /** One-line ops hint for admin / OS */
  shortNote: string;
};

export const MAIN_SUPPLIERS: readonly MainSupplierDef[] = [
  {
    name: "Henry Schein",
    cataloguePrices: "clinic_login",
    shortNote: "Clinic credentials → sync-prices or admin force-sync",
  },
  {
    name: "Kent Express",
    cataloguePrices: "clinic_login",
    shortNote: "Logins stored; HTTP price scraper is a stub — needs Playwright or supplier API",
  },
  {
    name: "Dental Sky",
    cataloguePrices: "public_feed",
    shortNote: "Public GraphQL cron + clinic JWT for negotiated basket prices",
  },
  {
    name: "DD Group",
    cataloguePrices: "public_feed",
    shortNote: "Public site JSON — cron refresh-dd-prices",
  },
  {
    name: "DHB",
    cataloguePrices: "public_feed",
    shortNote: "Public Magento GraphQL — cron refresh-dhb-prices",
  },
  {
    name: "Wrights",
    cataloguePrices: "clinic_login",
    shortNote: "Clinic credentials where integrated",
  },
] as const;

const ORDER = new Map(MAIN_SUPPLIERS.map((s, i) => [s.name, i]));

export function mainSupplierSortKey(supplierName: string): number {
  return ORDER.has(supplierName) ? (ORDER.get(supplierName) as number) : 1000;
}

export function getMainSupplierMeta(supplierName: string): MainSupplierDef | null {
  return MAIN_SUPPLIERS.find((s) => s.name === supplierName) ?? null;
}

/** Cron routes hit together by `scripts/refresh-all-public-supplier-prices.ts` */
export const PUBLIC_PRICE_CRON_ROUTES = [
  "/api/cron/refresh-dd-prices",
  "/api/cron/refresh-dental-sky-prices",
  "/api/cron/refresh-dhb-prices",
] as const;
