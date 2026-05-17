/**
 * Authenticated supplier basket pushers.
 *
 * Companion to lib/scrapers.ts (read: prices). This adds write capability:
 * given the clinic's stored credentials, log into a supplier site and push
 * items into the clinic's authenticated basket so the clinic can hop over
 * to the supplier site and complete checkout themselves.
 *
 * Design notes:
 *  - By default we only add lines to the supplier cart; the clinic completes
 *    checkout on the supplier site. That keeps Dentago out of payment capture.
 *  - Optional Magento 2 path: when explicitly requested by the API (consent +
 *    env flags), we may run GraphQL checkout through `placeOrder` using an
 *    offline/trade-style payment code (e.g. purchase order). This still forms
 *    a contract between the clinic and the supplier — see product/legal review
 *    before enabling in production.
 *  - All requests are server-side. Credentials never leave the server.
 *  - On any failure, we return a structured result with reasons per item.
 *    Callers (the API route) decide what to surface to the clinic.
 *
 * Implementation note: the cleanest path is **Magento 2 GraphQL**, which
 * accepts SKUs directly, persists carts to the customer record (so the
 * basket is visible when the clinic opens /checkout/cart in a browser),
 * and returns structured `user_errors` so we can give per-item failure
 * reasons. Where a supplier exposes GraphQL we use it. Suppliers without
 * GraphQL each have their own platform-specific notes inline below.
 */
import { logEvent } from "./events";
import {
  type BasketItem,
  type BasketItemResult,
  type BasketPushResult,
  type MagentoPlaceOrderOptions,
  type SupplierOrderPlacementResult,
} from "./basket-push-contract";
import {
  isPlaywrightBasketSupplier,
  pushSupplierBasketWithPlaywright,
} from "./supplier-basket-playwright";

export type {
  BasketItem,
  BasketItemResult,
  BasketPushResult,
  MagentoPlaceOrderOptions,
  SupplierOrderPlacementResult,
} from "./basket-push-contract";
export { SUPPLIER_ORDER_PLACEMENT_CONSENT_REQUIRED } from "./basket-push-contract";

const TIMEOUT = 15_000;
const CHECKOUT_TIMEOUT = 25_000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Generic Magento 2 GraphQL pusher ────────────────────────────────────────
//
// Every M2 supplier exposes the same `/graphql` shape:
//   - generateCustomerToken(email,password) → JWT scoped to the customer
//   - customerCart{id} → returns the masked quote id, persisted server-side
//   - addProductsToCart(cartId, [CartItemInput]) → adds by SKU, returns the
//     mutated cart and any user_errors
//
// Once the items are in the customer's persistent cart, the clinic can open
// `${baseUrl}/checkout/cart/` while logged in and see exactly what we pushed.

interface M2GqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { category?: string } }>;
}

async function magento2Gql<T>(
  graphqlUrl: string,
  query: string,
  variables: Record<string, unknown>,
  token?: string,
  timeoutMs: number = TIMEOUT
): Promise<M2GqlResponse<T> | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": UA,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(graphqlUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return (await res.json()) as M2GqlResponse<T>;
  } catch {
    return null;
  }
}

function m2GraphqlErrors(res: M2GqlResponse<unknown> | null): string[] {
  if (!res?.errors?.length) return [];
  return res.errors.map((e) => e.message).filter(Boolean);
}

interface M2CustomerAddress {
  id?: number | string | null;
  firstname?: string | null;
  lastname?: string | null;
  company?: string | null;
  street?: string[] | null;
  city?: string | null;
  postcode?: string | null;
  country_code?: string | null;
  telephone?: string | null;
  default_shipping?: boolean | null;
  default_billing?: boolean | null;
  region?: { region?: string | null; region_code?: string | null } | null;
}

/**
 * Magento 2 GraphQL: set shipping from saved address, pick first available rate,
 * mirror billing, offline payment, place order. Best-effort; surfaces GraphQL errors.
 */
async function magento2TryPlaceOrder(args: {
  graphqlUrl: string;
  token: string;
  cartId: string;
  options: MagentoPlaceOrderOptions;
}): Promise<SupplierOrderPlacementResult> {
  const { graphqlUrl, token, cartId, options } = args;
  const errors: string[] = [];
  const gql = <T,>(q: string, vars: Record<string, unknown>) =>
    magento2Gql<T>(graphqlUrl, q, vars, token, CHECKOUT_TIMEOUT);

  const addrRes = await gql<{ customer: { addresses: M2CustomerAddress[] | null } | null }>(
    `query {
      customer {
        addresses {
          id
          firstname
          lastname
          company
          street
          city
          postcode
          country_code
          telephone
          default_shipping
          default_billing
          region { region region_code }
        }
      }
    }`,
    {}
  );
  errors.push(...m2GraphqlErrors(addrRes));
  const addresses = addrRes?.data?.customer?.addresses ?? [];
  const pick =
    addresses.find((a) => a.default_shipping) ||
    addresses.find((a) => a.default_billing) ||
    addresses[0];
  if (!pick) {
    return {
      attempted: true,
      placed: false,
      errors: errors.length
        ? errors
        : ["no_saved_customer_address: add a default shipping address on the supplier account first."],
    };
  }
  const rawId = pick.id;
  const addrId =
    typeof rawId === "number" && Number.isFinite(rawId)
      ? rawId
      : typeof rawId === "string"
        ? parseInt(rawId, 10)
        : NaN;
  if (!Number.isFinite(addrId)) {
    return {
      attempted: true,
      placed: false,
      errors: errors.length
        ? errors
        : ["no_saved_customer_address: add a default shipping address on the supplier account first."],
    };
  }

  const shipRes = await gql<{
    setShippingAddressesOnCart: {
      cart: {
        shipping_addresses: Array<{
          available_shipping_methods: Array<{ carrier_code: string; method_code: string }> | null;
        }> | null;
      } | null;
    } | null;
  }>(
    `mutation($cid:String!,$aid:Int!){
      setShippingAddressesOnCart(input:{
        cart_id:$cid
        shipping_addresses:[{ customer_address_id:$aid }]
      }){
        cart{
          shipping_addresses{
            available_shipping_methods{ carrier_code method_code }
          }
        }
      }
    }`,
    { cid: cartId, aid: addrId }
  );
  errors.push(...m2GraphqlErrors(shipRes));
  const methods = shipRes?.data?.setShippingAddressesOnCart?.cart?.shipping_addresses?.[0]?.available_shipping_methods;
  if (!methods?.length) {
    return {
      attempted: true,
      placed: false,
      errors: errors.length ? errors : ["no_shipping_methods_available"],
    };
  }
  const chosen = methods[0];

  const shipMethodRes = await gql<{ setShippingMethodsOnCart: { cart: { id: string } | null } | null }>(
    `mutation($cid:String!,$cc:String!,$mc:String!){
      setShippingMethodsOnCart(input:{
        cart_id:$cid
        shipping_methods:[{ carrier_code:$cc method_code:$mc }]
      }){ cart { id } }
    }`,
    { cid: cartId, cc: chosen.carrier_code, mc: chosen.method_code }
  );
  errors.push(...m2GraphqlErrors(shipMethodRes));
  if (!shipMethodRes?.data?.setShippingMethodsOnCart?.cart?.id) {
    return { attempted: true, placed: false, errors: errors.length ? errors : ["set_shipping_methods_failed"] };
  }

  const billRes = await gql<{ setBillingAddressOnCart: { cart: { id: string } | null } | null }>(
    `mutation($cid:String!){
      setBillingAddressOnCart(input:{
        cart_id:$cid
        billing_address:{ same_as_shipping:true }
      }){ cart { id } }
    }`,
    { cid: cartId }
  );
  errors.push(...m2GraphqlErrors(billRes));

  const payVars: Record<string, unknown> = {
    cid: cartId,
    code: options.paymentMethodCode,
  };
  const hasPo = Boolean(options.purchaseOrderNumber?.trim());
  const payMutation = hasPo
    ? `mutation($cid:String!,$code:String!,$po:String!){
        setPaymentMethodOnCart(input:{
          cart_id:$cid
          payment_method:{ code:$code purchase_order_number:$po }
        }){ cart { id selected_payment_method { code } } }
      }`
    : `mutation($cid:String!,$code:String!){
        setPaymentMethodOnCart(input:{
          cart_id:$cid
          payment_method:{ code:$code }
        }){ cart { id selected_payment_method { code } } }
      }`;
  const payVarsFinal = hasPo
    ? { ...payVars, po: options.purchaseOrderNumber!.trim() }
    : payVars;

  const payRes = await gql<{ setPaymentMethodOnCart: { cart: { id: string } | null } | null }>(
    payMutation,
    payVarsFinal
  );
  errors.push(...m2GraphqlErrors(payRes));
  if (!payRes?.data?.setPaymentMethodOnCart?.cart?.id) {
    return { attempted: true, placed: false, errors: errors.length ? errors : ["set_payment_method_failed"] };
  }

  const placeRes = await gql<{
    placeOrder: {
      errors?: Array<{ message: string; code?: string }> | null;
      order?: { order_number?: string | null } | null;
      orderV2?: { number?: string | null } | null;
    } | null;
  }>(
    `mutation($cid:String!){
      placeOrder(input:{ cart_id:$cid }){
        errors { message code }
        order { order_number }
        orderV2 { number }
      }
    }`,
    { cid: cartId }
  );
  errors.push(...m2GraphqlErrors(placeRes));
  const po = placeRes?.data?.placeOrder;
  const placeErrs = po?.errors;
  if (placeErrs?.length) {
    errors.push(...placeErrs.map((e) => e.message));
    return { attempted: true, placed: false, errors };
  }
  const num = po?.orderV2?.number ?? po?.order?.order_number ?? undefined;
  if (!num) {
    return { attempted: true, placed: false, errors: errors.length ? errors : ["place_order_returned_no_number"] };
  }
  return { attempted: true, placed: true, supplierOrderNumber: num, errors: errors.length ? errors : undefined };
}

interface M2AddProductsResult {
  cart: {
    id: string;
    total_quantity: number;
    items: Array<{ quantity: number; product: { sku: string; name: string } }>;
  } | null;
  user_errors: Array<{ code: string; message: string }>;
}

/**
 * Push items into the customer's persistent cart on a Magento 2 storefront.
 * Generic over the supplier — the only per-supplier inputs are the storefront
 * URLs and the supplier display name.
 */
async function pushToMagento2Basket(args: {
  supplierName: string;
  baseUrl: string;
  username: string;
  password: string;
  items: BasketItem[];
  /** When set, attempt GraphQL checkout after lines are added (requires ≥1 added line). */
  placeOrder?: MagentoPlaceOrderOptions | null;
}): Promise<BasketPushResult> {
  const { supplierName, baseUrl, username, password, items, placeOrder } = args;
  const graphqlUrl = `${baseUrl}/graphql`;
  const basketUrl = `${baseUrl}/checkout/cart/`;

  const skeleton = (overrides: Partial<BasketPushResult> = {}): BasketPushResult => ({
    supplier: supplierName,
    authenticated: false,
    basketUrl,
    items: [],
    added: 0,
    failed: 0,
    ...overrides,
  });

  if (items.length === 0) return skeleton();

  // 1. Auth.
  const tokenRes = await magento2Gql<{ generateCustomerToken: { token: string } | null }>(
    graphqlUrl,
    `mutation($e:String!,$p:String!){generateCustomerToken(email:$e,password:$p){token}}`,
    { e: username, p: password }
  );
  const token = tokenRes?.data?.generateCustomerToken?.token;
  if (!token) {
    return skeleton({
      items: items.map((it) => ({
        searchTerm: it.searchTerm,
        label: it.label,
        quantity: it.quantity,
        status: "error",
        reason: "login_failed",
      })),
      failed: items.length,
    });
  }

  // 2. Customer cart id (masked quote id, persists server-side).
  const cartRes = await magento2Gql<{ customerCart: { id: string } | null }>(
    graphqlUrl,
    `{customerCart{id}}`,
    {},
    token
  );
  const cartId = cartRes?.data?.customerCart?.id;
  if (!cartId) {
    return skeleton({
      authenticated: true,
      items: items.map((it) => ({
        searchTerm: it.searchTerm,
        label: it.label,
        quantity: it.quantity,
        status: "error",
        reason: "no_cart",
      })),
      failed: items.length,
    });
  }

  // 3. Add — one round-trip for the lot. user_errors[] lets us reconcile
  // per-item even when the overall mutation succeeds.
  const skuItems = items.map((it) => ({
    sku: it.searchTerm,
    quantity: Math.max(1, Math.floor(it.quantity)),
  }));

  const addRes = await magento2Gql<{ addProductsToCart: M2AddProductsResult }>(
    graphqlUrl,
    `mutation($cid:String!,$items:[CartItemInput!]!){
      addProductsToCart(cartId:$cid,cartItems:$items){
        cart{id total_quantity items{quantity product{sku name}}}
        user_errors{code message}
      }
    }`,
    { cid: cartId, items: skuItems },
    token
  );
  const addResult = addRes?.data?.addProductsToCart;
  if (!addResult) {
    return skeleton({
      authenticated: true,
      cartId,
      items: items.map((it) => ({
        searchTerm: it.searchTerm,
        label: it.label,
        quantity: it.quantity,
        status: "error",
        reason: "graphql_failed",
      })),
      failed: items.length,
    });
  }

  // 4. Reconcile per-item against the returned cart contents.
  const cartSkus = new Set((addResult.cart?.items ?? []).map((ci) => ci.product.sku.toLowerCase()));
  // M2's user_errors carry a human message that usually contains the SKU —
  // best-effort substring match to bind errors to the items they came from.
  const errorBySku = new Map<string, string>();
  for (const ue of addResult.user_errors ?? []) {
    for (const it of items) {
      if (ue.message.toLowerCase().includes(it.searchTerm.toLowerCase())) {
        errorBySku.set(it.searchTerm.toLowerCase(), ue.message);
      }
    }
  }
  const orphanErrors = (addResult.user_errors ?? [])
    .filter((ue) => ![...errorBySku.values()].includes(ue.message))
    .map((ue) => `${ue.code}: ${ue.message}`);

  const resultsList: BasketItemResult[] = items.map((it) => {
    const skuLc = it.searchTerm.toLowerCase();
    if (cartSkus.has(skuLc)) {
      return {
        searchTerm: it.searchTerm,
        label: it.label,
        quantity: it.quantity,
        status: "added",
        externalProductId: it.searchTerm,
      };
    }
    const reason = errorBySku.get(skuLc) ?? orphanErrors.shift() ?? "not_in_cart_after_add";
    return {
      searchTerm: it.searchTerm,
      label: it.label,
      quantity: it.quantity,
      status:
        errorBySku.has(skuLc) || /not\s*found|does not exist|invalid/i.test(reason)
          ? "not_found"
          : "add_failed",
      reason,
    };
  });

  const added = resultsList.filter((r) => r.status === "added").length;
  const result: BasketPushResult = {
    supplier: supplierName,
    authenticated: true,
    basketUrl,
    cartId,
    items: resultsList,
    added,
    failed: resultsList.length - added,
  };

  if (placeOrder) {
    if (added > 0 && token && cartId) {
      result.supplierOrder = await magento2TryPlaceOrder({
        graphqlUrl,
        token,
        cartId,
        options: placeOrder,
      });
    } else {
      result.supplierOrder = {
        attempted: false,
        placed: false,
        errors: ["skipped_no_lines_added_to_supplier_cart"],
      };
    }
  }

  return result;
}

// ─── Dental Sky (Magento 2) ──────────────────────────────────────────────────

export async function addToDentalSkyBasket(
  username: string,
  password: string,
  items: BasketItem[],
  placeOrder?: MagentoPlaceOrderOptions | null
): Promise<BasketPushResult> {
  return pushToMagento2Basket({
    supplierName: "Dental Sky",
    baseUrl: "https://www.dentalsky.com",
    username,
    password,
    items,
    placeOrder: placeOrder ?? undefined,
  });
}

// ─── DHB (Magento 2) ─────────────────────────────────────────────────────────
//
// Verified 2026-05-08:
//   - dhb.co.uk is on Magento 2 (storeConfig.default_title returns
//     "DHB Oral Healthcare - Leading Dental Wholesaler").
//   - generateCustomerToken returns "graphql-authentication" with a
//     customer-friendly message on bad creds — same contract as Dental Sky.
//   - Uses the same /graphql endpoint and addProductsToCart mutation.
// Older domain dhb-dental.com is dead (NXDOMAIN as of 2026-05-08); credentials
// stored against the old supplier row may need a slug refresh, but the new
// canonical supplier site is dhb.co.uk.

export async function addToDhbBasket(
  username: string,
  password: string,
  items: BasketItem[],
  placeOrder?: MagentoPlaceOrderOptions | null
): Promise<BasketPushResult> {
  return pushToMagento2Basket({
    supplierName: "DHB",
    baseUrl: "https://dhb.co.uk",
    username,
    password,
    items,
    placeOrder: placeOrder ?? undefined,
  });
}

// ─── Wrights (Magento 2 GraphQL — same contract as Dental Sky / DHB) ───────────

export async function addToWrightsBasket(
  username: string,
  password: string,
  items: BasketItem[],
  placeOrder?: MagentoPlaceOrderOptions | null
): Promise<BasketPushResult> {
  return pushToMagento2Basket({
    supplierName: "Wrights",
    baseUrl: "https://www.wrightsdentals.com",
    username,
    password,
    items,
    placeOrder: placeOrder ?? undefined,
  });
}

// ─── Suppliers we cannot push to (yet) — explicit per-platform notes ────────
//
// Documenting these inline so the next agent / future-me knows exactly why
// each one is missing rather than re-probing from scratch. Status as of
// 2026-05-08.
//
// Optident (WooCommerce):
//   - Platform confirmed: WordPress + WooCommerce (woocommerce-form-login,
//     woocommerce-login-nonce on /my-account/).
//   - Possible path: WC Store API at /wp-json/wc/store/v1/cart/add-item.
//     Requires bootstrap GET /wp-json/wc/store/v1/cart to obtain the
//     X-WC-Store-API-Nonce header, then POST add-item with {id, quantity}.
//   - Blocker: Store API uses *product IDs*, not SKUs. We'd need to map
//     SKU → WC product id by either /wp-json/wc/store/v1/products?sku=...
//     (sometimes disabled) or by parsing the search results page for the
//     `data-product_id` on each card. Doable, just needs test creds + verify
//     persistent-cart behaviour for the logged-in clinic.
//
// Trycare (custom CMS):
//   - Platform: bespoke ASP.NET-style site ("trycare-engine"), jQuery 3.7.1,
//     login form at /login-register POSTs to /?qs=1&authmember=1&i=12 with
//     fields member_email / member_password / member_rememberme.
//   - No public cart API observed. Cart-add likely a server-rendered POST
//     against a per-product endpoint; needs reverse engineering with a real
//     authenticated session.
//
// DD Group / Dental Directory (custom Next.js):
//   - In-process basket push: Playwright login at /login/ + search + add-to-basket
//     (lib/supplier-basket-playwright.ts). Optional long-running worker still
//     supported via SUPPLIER_BASKET_WORKER_URL when browsers are not on the host.
//
// Wright Dental / Wright-Cottrell (wrightsdentals.com):
//   - Storefront uses classic Magento customer login (see scrapeWrights in
//     lib/scrapers.ts). We attempt the same Magento 2 GraphQL basket path as
//     Dental Sky / DHB. If Cloudflare or WAF blocks server egress, use
//     SUPPLIER_BASKET_WORKER_URL to delegate to a Playwright-capable worker.
//
// Clark Dental:
//   - Proprietary "phoo/6.4.1" CMS, B2B "request a quote" model. The site's
//     /customer/account/login/ path 302s to /page-missing — there is no
//     public cart for a clinic to land in. Not implementable; not on the
//     basket-push roadmap.
//
// Henry Schein / Kent Express:
//   - Basket push uses Playwright (same Angular sign-in pattern as negotiated
//     pricing). For serverless without Chromium, set SUPPLIER_BASKET_WORKER_URL
//     or install browsers on the runtime.

// ─── Optional worker delegate (Playwright / long-running Node) ───────────────
//
// Henry Schein, Kent Express, and DD Group need a real browser or undisclosed
// cart APIs. When both env vars below are set, Dentago POSTs credentials + SKUs
// to your worker, which must return a JSON body matching BasketPushResult.
//
//   SUPPLIER_BASKET_WORKER_URL=https://your-worker.example.com/v1/push-basket
//   SUPPLIER_BASKET_WORKER_SECRET=<shared-secret>   → Authorization: Bearer …
//
// Worker contract (POST JSON):
//   { supplierName, username, password, items: BasketItem[], placeOrder?: … }
// Response: BasketPushResult (same shape as native pushers).

const WORKER_BASKET_SUPPLIERS = ["Henry Schein", "Kent Express", "DD Group"] as const;

const WORKER_TIMEOUT_MS = 120_000;

function isWorkerBasketDelegateConfigured(): boolean {
  return Boolean(
    process.env.SUPPLIER_BASKET_WORKER_URL?.trim() && process.env.SUPPLIER_BASKET_WORKER_SECRET?.trim()
  );
}

function canPushViaWorker(supplierName: string): boolean {
  return isWorkerBasketDelegateConfigured() && WORKER_BASKET_SUPPLIERS.includes(supplierName as (typeof WORKER_BASKET_SUPPLIERS)[number]);
}

function isBasketPushResultShape(x: unknown): x is BasketPushResult {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.supplier === "string" &&
    typeof o.authenticated === "boolean" &&
    typeof o.basketUrl === "string" &&
    Array.isArray(o.items) &&
    typeof o.added === "number" &&
    typeof o.failed === "number"
  );
}

async function pushBasketViaDelegatingWorker(
  supplierName: string,
  username: string,
  password: string,
  items: BasketItem[],
  placeOrder?: MagentoPlaceOrderOptions | null
): Promise<BasketPushResult | null> {
  const url = process.env.SUPPLIER_BASKET_WORKER_URL!.trim();
  const secret = process.env.SUPPLIER_BASKET_WORKER_SECRET!.trim();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        supplierName,
        username,
        password,
        items,
        placeOrder: placeOrder ?? null,
      }),
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return null;
    }
    if (!res.ok || !isBasketPushResultShape(parsed)) {
      return null;
    }
    if (parsed.supplier !== supplierName) {
      (parsed as BasketPushResult).supplier = supplierName;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export type BasketSupplierName = "Dental Sky" | "DHB" | "Wrights";

const PUSHERS: Partial<
  Record<
    BasketSupplierName,
    (
      u: string,
      p: string,
      items: BasketItem[],
      placeOrder?: MagentoPlaceOrderOptions | null
    ) => Promise<BasketPushResult>
  >
> = {
  "Dental Sky": (u, p, items, po) => addToDentalSkyBasket(u, p, items, po),
  "DHB": (u, p, items, po) => addToDhbBasket(u, p, items, po),
  "Wrights": (u, p, items, po) => addToWrightsBasket(u, p, items, po),
};

/** Native Magento GraphQL pushers (always available when route flags allow). */
export const BASKET_PUSH_NATIVE_SUPPLIER_NAMES: ReadonlyArray<BasketSupplierName> = Object.keys(
  PUSHERS
) as BasketSupplierName[];

/** All suppliers for which push-to-basket may succeed on this deployment. */
export function getBasketPushSupportedSupplierNames(): string[] {
  const names: string[] = [...BASKET_PUSH_NATIVE_SUPPLIER_NAMES];
  for (const s of WORKER_BASKET_SUPPLIERS) {
    if (!names.includes(s)) names.push(s);
  }
  return names;
}

/** @deprecated Prefer getBasketPushSupportedSupplierNames() — kept for older imports. */
export const BASKET_PUSH_SUPPLIER_NAMES: ReadonlyArray<string> = BASKET_PUSH_NATIVE_SUPPLIER_NAMES;

export function hasBasketPusher(supplierName: string): boolean {
  if (Object.prototype.hasOwnProperty.call(PUSHERS, supplierName)) return true;
  if (isPlaywrightBasketSupplier(supplierName)) return true;
  if (canPushViaWorker(supplierName)) return true;
  return false;
}

export async function pushToSupplierBasket(
  supplierName: string,
  username: string,
  password: string,
  items: BasketItem[],
  placeOrder?: MagentoPlaceOrderOptions | null
): Promise<BasketPushResult | null> {
  const fn = PUSHERS[supplierName as BasketSupplierName];
  if (fn) {
    return fn(username, password, items, placeOrder);
  }
  if (canPushViaWorker(supplierName)) {
    const workerResult = await pushBasketViaDelegatingWorker(supplierName, username, password, items, placeOrder);
    if (workerResult) return workerResult;
  }
  if (isPlaywrightBasketSupplier(supplierName)) {
    return pushSupplierBasketWithPlaywright({
      supplier: supplierName,
      username,
      password,
      items,
      placeOrder,
    });
  }
  // Surface unsupported supplier in the events table so we can see clinics
  // attempting suppliers we haven't shipped yet — useful prioritisation signal.
  void logEvent({
    event_type: "supplier_basket_pushed",
    entity_type: "supplier",
    entity_id: supplierName,
    payload: { status: "unsupported_supplier", supplier_name: supplierName },
    source: "scrapers-basket",
  }).catch(() => undefined);
  return null;
}
