export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * POST /api/clinic/push-to-basket
 *
 * Push items from the clinic's Dentago cart into a connected supplier's
 * authenticated basket on the supplier's website. By default the clinic
 * finishes checkout on the supplier site.
 *
 * Optional order placement when `PLACE_ORDER_ON_SUPPLIER_ENABLED=1` and the body
 * sends the exact consent string from `SUPPLIER_ORDER_PLACEMENT_CONSENT_REQUIRED`:
 *   - Magento 2 (Dental Sky, DHB, Wrights): GraphQL checkout using
 *     `MAGENTO_PLACE_ORDER_PAYMENT_CODE` (default `purchaseorder`).
 *   - Henry Schein, Kent Express, DD Group: best-effort Playwright checkout from
 *     the basket URL (fragile; prefer validating on a worker with browsers).
 * This is not legal advice: clinic/supplier contract and supplier ToS still apply.
 *
 * Body:
 *   { supplierId: number, itemIds?: string[], placeOrderOnSupplier?: boolean,
 *     orderPlacementConsent?: string, purchaseOrderNumber?: string }
 *     supplierId — dentago_suppliers.id (integer) for the supplier the
 *                  clinic wants to push to.
 *     itemIds    — optional cart_items.id[] subset. Default: all items in
 *                  the active cart whose supplier_id matches.
 *     placeOrderOnSupplier — when true with env + consent, run supplier placeOrder
 *                            after cart lines are added (M2 only).
 *     orderPlacementConsent — must match SUPPLIER_ORDER_PLACEMENT_CONSENT_REQUIRED
 *                             verbatim (trimmed) when placeOrderOnSupplier is true.
 *     purchaseOrderNumber — optional; passed to the supplier when the payment
 *                           method supports a PO reference.
 *
 * Response: BasketPushResult plus a short-form clinic-friendly summary.
 *
 * Hard requirements before this can be called:
 *   - clinic is authenticated
 *   - clinic has saved supplier_credentials for this supplier
 *   - the supplier has a basket pusher implemented (see lib/scrapers-basket.ts)
 *   - feature flag is on, either globally (env) or per-clinic (column)
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import { logEvent } from "@/lib/events";
import {
  pushToSupplierBasket,
  hasBasketPusher,
  getBasketPushSupportedSupplierNames,
  SUPPLIER_ORDER_PLACEMENT_CONSENT_REQUIRED,
  type BasketItem,
  type BasketPushResult,
  type MagentoPlaceOrderOptions,
} from "@/lib/scrapers-basket";

interface AuthedClinic {
  userId: string;
  clinicId: string;
}

async function getAuthedClinic(request: Request): Promise<AuthedClinic | null> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: clinic } = await supabaseAdmin
    .from("clinic_accounts")
    .select("id, basket_push_enabled")
    .eq("auth_user_id", user.id)
    .single();
  if (!clinic) return null;
  return { userId: user.id, clinicId: clinic.id };
}

/**
 * Feature-flag gate. We require BOTH a global env switch (so we can dark-launch
 * the route without breaking anything) and a per-clinic opt-in via the
 * basket_push_enabled column. Missing column treated as enabled-by-default
 * once env flag is on, so first deploys don't dead-end if the migration is late.
 */
async function isFeatureEnabledForClinic(clinicId: string): Promise<boolean> {
  if (process.env.PUSH_TO_BASKET_ENABLED !== "1") return false;
  const { data, error } = await supabaseAdmin
    .from("clinic_accounts")
    .select("basket_push_enabled")
    .eq("id", clinicId)
    .single();
  // Column missing → 42703. Treat as enabled so this works before the migration
  // has been applied. Once the column exists, the actual value is honoured.
  if (error?.code === "42703") return true;
  if (error) return false;
  return data?.basket_push_enabled !== false;
}

/** Which suppliers can use push-to-basket on this deployment (native + optional worker). */
export async function GET() {
  return NextResponse.json({
    supportedSuppliers: getBasketPushSupportedSupplierNames(),
  });
}

export async function POST(request: Request) {
  const auth = await getAuthedClinic(request);
  if (!auth) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  if (!(await isFeatureEnabledForClinic(auth.clinicId))) {
    return NextResponse.json(
      { error: "Push to supplier basket is not enabled for this clinic yet." },
      { status: 403 }
    );
  }

  let body: {
    supplierId?: number | string;
    itemIds?: string[];
    placeOrderOnSupplier?: boolean;
    orderPlacementConsent?: string;
    purchaseOrderNumber?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const wantsPlaceOrder = body.placeOrderOnSupplier === true;
  const placeOrderEnvOn = process.env.PLACE_ORDER_ON_SUPPLIER_ENABLED === "1";
  if (wantsPlaceOrder && !placeOrderEnvOn) {
    return NextResponse.json(
      {
        error:
          "Supplier order placement is not enabled. Items can still be pushed to the supplier basket only.",
      },
      { status: 403 }
    );
  }
  if (wantsPlaceOrder) {
    const consent = typeof body.orderPlacementConsent === "string" ? body.orderPlacementConsent.trim() : "";
    if (consent !== SUPPLIER_ORDER_PLACEMENT_CONSENT_REQUIRED) {
      return NextResponse.json(
        {
          error: "orderPlacementConsent must exactly match the required consent text for supplier order placement.",
          consentRequired: SUPPLIER_ORDER_PLACEMENT_CONSENT_REQUIRED,
        },
        { status: 400 }
      );
    }
  }

  const supplierId = typeof body.supplierId === "string" ? parseInt(body.supplierId, 10) : body.supplierId;
  if (!supplierId || Number.isNaN(supplierId)) {
    return NextResponse.json({ error: "supplierId is required" }, { status: 400 });
  }

  // Resolve supplier name (used both to find credentials and to dispatch
  // the right scraper).
  const { data: supplierRow, error: supplierErr } = await supabaseAdmin
    .from("dentago_suppliers")
    .select("id, name")
    .eq("id", supplierId)
    .single();
  if (supplierErr || !supplierRow) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }
  const supplierName: string = supplierRow.name;

  if (!hasBasketPusher(supplierName)) {
    return NextResponse.json(
      {
        error: `${supplierName} does not yet support basket push.`,
        supplier: supplierName,
        supportedSuppliers: getBasketPushSupportedSupplierNames(),
      },
      { status: 400 }
    );
  }

  // Map dentago_suppliers.id (int) → suppliers.id (uuid) so we can look up
  // the credentials row. Same pattern as /api/clinic/credentials.
  const { data: supplierUuidRow } = await supabaseAdmin
    .from("suppliers")
    .select("id")
    .eq("name", supplierName)
    .maybeSingle();
  if (!supplierUuidRow?.id) {
    return NextResponse.json(
      { error: `Supplier credentials are not yet configured for ${supplierName}. Connect it in Suppliers.` },
      { status: 400 }
    );
  }

  const { data: credRow, error: credErr } = await supabaseAdmin
    .from("supplier_credentials")
    .select("username, encrypted_password")
    .eq("clinic_id", auth.clinicId)
    .eq("supplier_id", supplierUuidRow.id)
    .maybeSingle();

  if (credErr) {
    return NextResponse.json({ error: credErr.message }, { status: 500 });
  }
  if (!credRow) {
    return NextResponse.json(
      { error: `Connect your ${supplierName} account before pushing to its basket.` },
      { status: 400 }
    );
  }

  let password: string;
  try {
    password = decrypt(credRow.encrypted_password);
  } catch {
    return NextResponse.json(
      {
        error:
          `Stored ${supplierName} password could not be decrypted (likely a key rotation). ` +
          `Re-enter the password in Suppliers and try again.`,
      },
      { status: 400 }
    );
  }

  // Active cart + items belonging to this supplier.
  const { data: cart } = await supabaseAdmin
    .from("carts")
    .select("id")
    .eq("clinic_id", auth.clinicId)
    .eq("status", "active")
    .maybeSingle();
  if (!cart) {
    return NextResponse.json({ error: "No active cart." }, { status: 400 });
  }

  const itemQuery = supabaseAdmin
    .from("cart_items")
    .select(`
      id, quantity, sku,
      dentago_products ( id, name ),
      dentago_suppliers!inner ( id, name )
    `)
    .eq("cart_id", cart.id)
    .eq("supplier_id", supplierId);

  if (Array.isArray(body.itemIds) && body.itemIds.length > 0) {
    itemQuery.in("id", body.itemIds);
  }

  const { data: items, error: itemsErr } = await itemQuery;
  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }
  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: `No items in your cart for ${supplierName}.` },
      { status: 400 }
    );
  }

  // For Dental Sky (M2 GraphQL) we use SKU as the search term — the cart row
  // already stores the supplier-specific SKU we matched at search time.
  type CartItemRow = {
    id: string;
    quantity: number | null;
    sku: string | null;
    dentago_products: { id: number; name: string } | { id: number; name: string }[] | null;
  };
  const basketItems: BasketItem[] = (items as unknown as CartItemRow[])
    .map((it) => {
      const sku: string | null = it.sku ?? null;
      const productLink = Array.isArray(it.dentago_products) ? it.dentago_products[0] : it.dentago_products;
      const productName: string | null = productLink?.name ?? null;
      const searchTerm = (sku && sku.trim()) || productName;
      if (!searchTerm) return null;
      return {
        searchTerm,
        quantity: Math.max(1, Math.floor(it.quantity ?? 1)),
        label: productName ?? sku ?? undefined,
      } as BasketItem;
    })
    .filter((x): x is BasketItem => x !== null);

  if (basketItems.length === 0) {
    return NextResponse.json(
      { error: "Cart items have no SKU or product name to push." },
      { status: 400 }
    );
  }

  let placeOrder: MagentoPlaceOrderOptions | null = null;
  if (wantsPlaceOrder) {
    const paymentMethodCode = (process.env.MAGENTO_PLACE_ORDER_PAYMENT_CODE ?? "purchaseorder").trim() || "purchaseorder";
    placeOrder = {
      paymentMethodCode,
      purchaseOrderNumber:
        typeof body.purchaseOrderNumber === "string" && body.purchaseOrderNumber.trim()
          ? body.purchaseOrderNumber.trim()
          : undefined,
    };
  }

  const result: BasketPushResult | null = await pushToSupplierBasket(
    supplierName,
    credRow.username,
    password,
    basketItems,
    placeOrder
  );

  if (!result) {
    return NextResponse.json(
      { error: `${supplierName} basket pusher unavailable.` },
      { status: 500 }
    );
  }

  await logEvent({
    event_type: "supplier_basket_pushed",
    entity_type: "clinic",
    entity_id: auth.clinicId,
    payload: {
      supplier: supplierName,
      authenticated: result.authenticated,
      added: result.added,
      failed: result.failed,
      cart_id: result.cartId,
      supplier_order: result.supplierOrder
        ? {
            attempted: result.supplierOrder.attempted,
            placed: result.supplierOrder.placed,
            supplier_order_number: result.supplierOrder.supplierOrderNumber,
            errors: result.supplierOrder.errors,
          }
        : undefined,
      items: result.items.map(i => ({
        sku: i.searchTerm,
        quantity: i.quantity,
        status: i.status,
        reason: i.reason,
      })),
    },
    source: "push_to_basket_api",
  });

  const orderPlaced = result.supplierOrder?.placed === true;
  const orderMsg =
    result.supplierOrder?.attempted && !result.supplierOrder.placed
      ? ` Order placement on ${supplierName} did not complete.`
      : orderPlaced
        ? ` Supplier order ${result.supplierOrder?.supplierOrderNumber ?? ""} was placed.`
        : "";

  return NextResponse.json({
    success: result.added > 0,
    supplier: supplierName,
    authenticated: result.authenticated,
    basketUrl: result.basketUrl,
    cartId: result.cartId,
    added: result.added,
    failed: result.failed,
    items: result.items,
    supplierOrder: result.supplierOrder,
    message:
      (result.added === basketItems.length
        ? `Added ${result.added} item${result.added === 1 ? "" : "s"} to your ${supplierName} basket.`
        : result.added > 0
          ? `Added ${result.added}/${basketItems.length} items. ${result.failed} could not be added.`
          : `Could not add items to ${supplierName} basket.`) + orderMsg,
  });
}
