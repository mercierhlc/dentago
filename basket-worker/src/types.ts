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
