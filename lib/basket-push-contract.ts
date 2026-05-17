/**
 * Shared basket-push types + consent copy (used by scrapers-basket, API routes,
 * and browser automation helpers). Keeps Playwright helpers free of circular imports.
 */

export interface BasketItem {
  searchTerm: string;
  quantity: number;
  label?: string;
}

export interface BasketItemResult {
  searchTerm: string;
  label?: string;
  quantity: number;
  status: "added" | "not_found" | "add_failed" | "error";
  externalProductId?: string;
  reason?: string;
}

export interface BasketPushResult {
  supplier: string;
  authenticated: boolean;
  basketUrl: string;
  cartId?: string;
  items: BasketItemResult[];
  added: number;
  failed: number;
  supplierOrder?: SupplierOrderPlacementResult;
}

export interface MagentoPlaceOrderOptions {
  paymentMethodCode: string;
  purchaseOrderNumber?: string;
}

export interface SupplierOrderPlacementResult {
  attempted: boolean;
  placed: boolean;
  supplierOrderNumber?: string;
  errors?: string[];
}

export const SUPPLIER_ORDER_PLACEMENT_CONSENT_REQUIRED =
  "I authorise Dentago to submit supplier checkout using my saved supplier login. I confirm I am authorised to bind my practice to purchase these goods on the supplier's normal trade terms (including any applicable credit limits) and that payment timing follows those supplier terms.";
