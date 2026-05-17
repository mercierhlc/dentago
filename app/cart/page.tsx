"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CATEGORY_META } from "@/lib/products";
import { getClinic, clearAuth, freshAuthHeaders, getFreshToken } from "@/lib/auth";
import ProfileMenu from "@/components/ProfileMenu";
import { SupplierLogo } from "@/components/SupplierLogo";
import {
  clearGuestCart,
  guestLinesToCartData,
  loadGuestCartLines,
  removeGuestLine,
  setGuestLineQuantity,
} from "@/lib/guest-cart";
import { MAIN_SUPPLIERS } from "@/lib/main-suppliers";

type CartItem = {
  id: string;
  productId: number;
  name: string;
  brand: string;
  category: string;
  image: string;
  packSize: string;
  supplier: string;
  supplierId: number;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  inStock: boolean;
};

type SupplierGroup = {
  supplier: string;
  items: CartItem[];
  subtotal: number;
};

type CartData = {
  cartId: string;
  items: CartItem[];
  bySupplier: SupplierGroup[];
  total: number;
  itemCount: number;
};

/**
 * Suppliers for which the cart may show “Push to supplier basket”. Matches the
 * six core marketplace suppliers; GET /api/clinic/push-to-basket remains the
 * server source of truth (refreshes this set after load).
 */
const BASKET_PUSH_SUPPLIERS_DEFAULT = new Set<string>(MAIN_SUPPLIERS.map((s) => s.name));

const BASKET_PUSH_BROWSER_BACKED = new Set<string>(["Henry Schein", "Kent Express", "DD Group"]);

function ProductImg({ src, name, category }: { src: string; name: string; category: string }) {
  const [err, setErr] = useState(false);
  const meta = CATEGORY_META[category] ?? { color: "#111111", bg: "#f5f3ff", icon: "inventory_2" };
  if (err) return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: meta.bg }}>
      <span className="material-symbols-outlined text-[28px]" style={{ color: meta.color, fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
    </div>
  );
  return <Image src={src} alt={name} fill className="object-contain p-2 bg-white" unoptimized onError={() => setErr(true)} />;
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const [clinic, setClinic] = useState<ReturnType<typeof getClinic>>(null);
  const [savingsData, setSavingsData] = useState<{ total: number; annual: number } | null>(null);

  // Push-to-supplier-basket: which supplier is currently being pushed, and the
  // last result keyed by supplier name. Supported suppliers come from GET
  // /api/clinic/push-to-basket; the API also enforces this server-side.
  const [pushingSupplier, setPushingSupplier] = useState<string | null>(null);
  const [basketPushSuppliers, setBasketPushSuppliers] = useState<Set<string>>(() => new Set(BASKET_PUSH_SUPPLIERS_DEFAULT));
  const [pushResultBySupplier, setPushResultBySupplier] = useState<
    Record<string, { ok: boolean; message: string; basketUrl?: string; added?: number; failed?: number; orderPlaced?: boolean; supplierOrderNumber?: string }>
  >({});
  // Auto-place consent: keyed by supplier name, true when clinic has checked the consent box
  const [autoPlaceConsent, setAutoPlaceConsent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clinic/push-to-basket");
        if (!res.ok) return;
        const data = (await res.json()) as { supportedSuppliers?: string[] };
        if (cancelled || !Array.isArray(data.supportedSuppliers) || data.supportedSuppliers.length === 0) return;
        setBasketPushSuppliers(new Set(data.supportedSuppliers));
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => { setClinic(getClinic()); }, []);

  const [fetchError, setFetchError] = useState<string | null>(null);
  /** Same pattern as /orders — avoid using sync getToken() for “logged in” UI after getFreshToken. */
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const fetchCart = useCallback(async () => {
    const token = await getFreshToken();
    setAuthChecked(true);
    setHasSession(!!token);

    if (!token) {
      const raw = loadGuestCartLines();
      const data = guestLinesToCartData(raw);
      setCart(data);
      setFetchError(null);
      setLoading(false);
      if (data.items.length) await computeSavings(data);
      else setSavingsData(null);
      return;
    }

    const guestLines = loadGuestCartLines();
    if (guestLines.length > 0) {
      const headers = await freshAuthHeaders();
      let merged = true;
      for (const it of guestLines) {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            productId: it.productId,
            supplierId: it.supplierId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            sku: it.sku || undefined,
            packSize: it.packSize || undefined,
          }),
        });
        if (!res.ok) {
          merged = false;
          break;
        }
      }
      if (merged) clearGuestCart();
    }

    try {
      const res = await fetch("/api/cart", { headers: await freshAuthHeaders() });
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error ?? `HTTP ${res.status}`);
        setCart(null);
      } else {
        setCart(data);
        setFetchError(null);
        computeSavings(data);
      }
    } catch (err: any) {
      setFetchError(err.message ?? "Network error");
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  async function computeSavings(cartData: CartData) {
    if (!cartData?.items?.length) { setSavingsData(null); return; }
    const uniqueProductIds = [...new Set(cartData.items.map(i => i.productId))];
    const priceMap: Record<number, number[]> = {};
    await Promise.all(
      uniqueProductIds.map(async (pid) => {
        try {
          const res = await fetch(`/api/products/${pid}`, { headers: await freshAuthHeaders() });
          if (!res.ok) return;
          const p = await res.json();
          // API returns dentago_supplier_products nested; handle both shapes
          const suppliers: any[] = p.suppliers ?? p.dentago_supplier_products ?? [];
          const prices: number[] = suppliers
            .map((s: any) => s.price)
            .filter((v: number) => v > 0);
          if (prices.length) priceMap[pid] = prices;
        } catch { /* skip */ }
      })
    );
    let totalSavings = 0;
    for (const item of cartData.items) {
      const prices = priceMap[item.productId];
      if (!prices || prices.length < 2) continue;
      const maxPrice = Math.max(...prices);
      const saving = Math.max(0, maxPrice - item.unitPrice) * item.quantity;
      totalSavings += saving;
    }
    if (totalSavings > 0.01) {
      setSavingsData({ total: parseFloat(totalSavings.toFixed(2)), annual: parseFloat((totalSavings * 52).toFixed(2)) });
    } else {
      setSavingsData(null);
    }
  }

  useEffect(() => { fetchCart(); }, [fetchCart]);

  async function updateQty(itemId: string, quantity: number) {
    setUpdating(itemId);
    const token = await getFreshToken();
    if (!token || cart?.cartId === "guest") {
      const m = /^guest-(\d+)-(\d+)$/.exec(itemId);
      if (m) {
        const productId = Number(m[1]);
        const supplierId = Number(m[2]);
        if (quantity <= 0) removeGuestLine(itemId);
        else setGuestLineQuantity(productId, supplierId, quantity);
        const data = guestLinesToCartData(loadGuestCartLines());
        setCart(data);
        if (data.items.length) await computeSavings(data);
        else setSavingsData(null);
      }
      setUpdating(null);
      return;
    }
    await fetch("/api/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...await freshAuthHeaders() },
      body: JSON.stringify({ itemId, quantity }),
    });
    await fetchCart();
    setUpdating(null);
  }

  async function removeItem(itemId: string) {
    setUpdating(itemId);
    const token = await getFreshToken();
    if (!token || cart?.cartId === "guest") {
      removeGuestLine(itemId);
      const data = guestLinesToCartData(loadGuestCartLines());
      setCart(data);
      if (data.items.length) await computeSavings(data);
      else setSavingsData(null);
      setUpdating(null);
      return;
    }
    await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...await freshAuthHeaders() },
      body: JSON.stringify({ itemId }),
    });
    await fetchCart();
    setUpdating(null);
  }

  async function pushToSupplierBasket(group: SupplierGroup) {
    if (pushingSupplier) return;
    const itemIds = group.items.filter(i => i.inStock).map(i => i.id);
    if (itemIds.length === 0) {
      setPushResultBySupplier(prev => ({
        ...prev,
        [group.supplier]: { ok: false, message: "All items in this supplier group are out of stock." },
      }));
      return;
    }
    const supplierId = group.items[0]?.supplierId;
    if (!supplierId) return;

    setPushingSupplier(group.supplier);
    setPushResultBySupplier(prev => ({ ...prev, [group.supplier]: { ok: true, message: "Pushing to supplier basket…" } }));

    const wantsAutoPlace = BASKET_PUSH_BROWSER_BACKED.has(group.supplier) && !!autoPlaceConsent[group.supplier];
    const CONSENT_TEXT = "I authorise Dentago to submit supplier checkout using my saved supplier login. I confirm I am authorised to bind my practice to purchase these goods on the supplier's normal trade terms (including any applicable credit limits) and that payment timing follows those supplier terms.";

    try {
      const res = await fetch("/api/clinic/push-to-basket", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...await freshAuthHeaders() },
        body: JSON.stringify({
          supplierId,
          itemIds,
          ...(wantsAutoPlace ? { placeOrderOnSupplier: true, orderPlacementConsent: CONSENT_TEXT } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPushResultBySupplier(prev => ({
          ...prev,
          [group.supplier]: { ok: false, message: data.error ?? `Push failed (HTTP ${res.status})` },
        }));
        return;
      }
      setPushResultBySupplier(prev => ({
        ...prev,
        [group.supplier]: {
          ok: data.success,
          message: data.message ?? "Done.",
          basketUrl: data.basketUrl,
          added: data.added,
          failed: data.failed,
          orderPlaced: data.supplierOrder?.placed === true,
          supplierOrderNumber: data.supplierOrder?.supplierOrderNumber,
        },
      }));
      if (data.success && data.basketUrl) {
        window.open(data.basketUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error pushing to supplier basket.";
      setPushResultBySupplier(prev => ({
        ...prev,
        [group.supplier]: { ok: false, message },
      }));
    } finally {
      setPushingSupplier(null);
    }
  }

  // Error type drives copy + retry behaviour. "network" = transient,
  // "validation" = user must fix something, "server" = backend issue.
  const [errorKind, setErrorKind] = useState<"network" | "validation" | "server" | null>(null);

  async function placeOrder() {
    if (!cart || cart.items.length === 0) return;
    const tok = await getFreshToken();
    if (!tok) {
      router.push(`/login?next=${encodeURIComponent("/cart")}`);
      return;
    }
    const allOOS = cart.items.every((i) => !i.inStock);
    if (allOOS) {
      setErrorKind("validation");
      setError(
        "Every item in your cart is out of stock. Remove them or switch to an in-stock line on the product page before placing an order.",
      );
      return;
    }
    setError("");
    setErrorKind(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...await freshAuthHeaders() },
        body: JSON.stringify({
          clinicName: clinic?.clinic_name ?? "Unknown Clinic",
          clinicEmail: clinic?.email ?? "",
          items: cart.items.map(i => ({
            productId:    i.productId,
            supplierId:   i.supplierId,
            supplierName: i.supplier,
            name:         i.name,
            brand:        i.brand,
            sku:          i.sku ?? null,
            quantity:     i.quantity,
            unitPrice:    i.unitPrice,
            packSize:     i.packSize,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const kind = res.status >= 500 ? "server" : res.status === 400 || res.status === 422 ? "validation" : "server";
        setErrorKind(kind);
        throw new Error(data.error ?? `Order failed (HTTP ${res.status})`);
      }
      const primaryId = data.orderId ?? data.id ?? "ORD-" + Date.now();
      const allIds: string[] = data.orderIds ?? [primaryId];
      await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...await freshAuthHeaders() },
        body: JSON.stringify({ clearAll: true }),
      });
      const idsParam = allIds.length > 1 ? `?ids=${allIds.join(",")}` : "";
      router.push(`/order/${primaryId}${idsParam}`);
    } catch (err: any) {
      // Network error (fetch threw before getting a response) — never set kind
      // above, default to network.
      setErrorKind(prev => prev ?? "network");
      setError(err?.message ?? "Network error — check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.08)] border border-slate-100 p-14 max-w-md w-full text-center animate-card-reveal">
          <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-8">
            <span className="material-symbols-outlined text-[52px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#151121] mb-3 tracking-tight">Order Placed!</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Your order has been received. We&apos;ll route it to each supplier and confirm delivery.
          </p>
          <div className="bg-slate-50 rounded-2xl px-5 py-4 mb-8 text-left border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Order Reference</p>
            <p className="font-mono font-bold text-[#111111] break-all">{orderId}</p>
          </div>
          <Link
            href="/search"
            className="w-full flex items-center justify-center gap-2 !bg-[#111111] py-4 rounded-2xl font-bold !text-white hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#111111]/25"
          >
            <span className="material-symbols-outlined text-[20px] !text-white">search</span>
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const supplierCount = cart?.bySupplier.length ?? 0;
  const itemCount = cart?.itemCount ?? 0;

  return (
    <div className="min-h-screen text-[var(--dc-text,#0f172a)] animate-page-in">
      <div className="mx-auto max-w-[88rem] space-y-6 px-4 py-6 pb-32 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-[var(--dc-muted,#64748b)]">
              <Link href="/search" className="transition-colors hover:text-[var(--dc-text)]">Marketplace</Link>
              <span className="text-slate-300">/</span>
              <span>Cart</span>
            </nav>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--dc-text,#0f172a)] sm:text-3xl">Cart</h1>
            {!loading && cart && itemCount > 0 ? (
              <p className="mt-1 text-sm text-[var(--dc-muted,#64748b)]">
                {itemCount} item{itemCount !== 1 ? "s" : ""} · {supplierCount} supplier{supplierCount !== 1 ? "s" : ""} · £{cart.total.toFixed(2)}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--dc-text)] transition hover:bg-[var(--dc-surface-elevated)]"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to marketplace
            </Link>
            <ProfileMenu clinic={clinic} />
          </div>
        </div>

        {/* ── Fetch error ──────────────────────────────────────────────────────── */}
        {!loading && fetchError && (
          <div className="flex flex-col items-center justify-center rounded-[1.5rem] border border-rose-100 bg-white py-20 px-6 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
              <span className="material-symbols-outlined text-[32px] text-rose-500">error</span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--dc-text,#0f172a)]">Couldn&apos;t load your cart</h2>
            <p className="mt-1.5 max-w-sm font-mono text-xs text-rose-500">{fetchError}</p>
            <button
              type="button"
              onClick={fetchCart}
              className="mt-6 inline-flex items-center gap-2 rounded-lg !bg-[#111111] px-4 py-2.5 text-sm font-semibold !text-white shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[16px] !text-white">refresh</span>
              Retry
            </button>
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="overflow-hidden rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-white/80 backdrop-blur-xl">
                  <div className="h-16 shimmer" />
                  {[1, 2].map(j => (
                    <div key={j} className="flex gap-5 border-t border-[rgba(15,23,42,0.06)] p-6">
                      <div className="h-20 w-20 flex-shrink-0 rounded-2xl shimmer" />
                      <div className="flex-1 space-y-3 pt-1">
                        <div className="h-3.5 w-1/4 rounded-full shimmer" />
                        <div className="h-5 w-3/4 rounded-full shimmer" />
                        <div className="h-3.5 w-1/3 rounded-full shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="h-80 rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-white/80 shimmer" />
          </div>
        )}

        {/* ── Empty cart ───────────────────────────────────────────────────────── */}
        {!loading && cart && cart.itemCount === 0 && (
          <div className="flex flex-col items-center justify-center rounded-[1.5rem] border border-[var(--dc-border)] bg-white py-20 px-6 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--dc-surface-elevated)]">
              <span className="material-symbols-outlined text-[32px] text-[var(--dc-muted,#64748b)]">shopping_cart</span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--dc-text,#0f172a)]">Your cart is empty</h2>
            <p className="mt-1.5 max-w-sm text-sm text-[var(--dc-muted,#64748b)]">
              Add products from the marketplace to get started.
            </p>
            <Link
              href="/search"
              className="mt-6 inline-flex items-center gap-2 rounded-lg !bg-[#111111] px-4 py-2.5 text-sm font-semibold !text-white shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[16px] !text-white">search</span>
              Browse products
            </Link>
          </div>
        )}

        {/* ── Cart with items ──────────────────────────────────────────────────── */}
        {!loading && cart && cart.itemCount > 0 && (
          <>
            {/* ── Entire cart out of stock — cannot checkout ───────────────── */}
            {cart.items.every((i) => !i.inStock) && (
              <div
                data-testid="cart-all-oos-error"
                className="mb-6 flex items-start gap-3.5 bg-red-50 border border-red-200 rounded-2xl px-5 py-4"
              >
                <span className="material-symbols-outlined text-[22px] text-red-500 flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                  block
                </span>
                <div>
                  <p className="font-bold text-red-800 text-sm mb-0.5">Nothing in this cart is orderable right now</p>
                  <p className="text-sm text-red-700 leading-relaxed">
                    Every line is out of stock with your selected suppliers. Remove these items or open each product and pick an in-stock supplier before checkout.
                  </p>
                  <Link
                    href="/search"
                    className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold text-red-700 hover:text-red-900 underline underline-offset-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">search_insights</span>
                    Back to marketplace
                  </Link>
                </div>
              </div>
            )}

            {/* ── Out-of-stock warning banner ──────────────────────────────── */}
            {cart.items.some(i => !i.inStock) && (
              <div className="mb-6 flex items-start gap-3.5 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 animate-slide-up">
                <span className="material-symbols-outlined text-[20px] text-amber-500 flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                <div>
                  <p className="font-bold text-amber-800 text-sm mb-0.5">Some items are out of stock</p>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    {cart.items.filter(i => !i.inStock).length === 1
                      ? "1 item in your cart is currently unavailable."
                      : `${cart.items.filter(i => !i.inStock).length} items in your cart are currently unavailable.`}{" "}
                    Remove them or place the order and we&apos;ll notify the supplier — they&apos;ll confirm availability before dispatch.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">

              {/* ── Left: supplier groups ─────────────────────────────────────── */}
              <div className="space-y-5">
                {cart.bySupplier.map((group, gi) => {
                  return (
                    <div
                      key={group.supplier}
                      className="bg-[rgba(255,255,255,0.72)] backdrop-blur-xl rounded-[28px] border border-[rgba(15,23,42,0.08)] shadow-[0_18px_55px_rgba(15,23,42,0.08)] overflow-hidden animate-card-reveal"
                      style={{ animationDelay: `${gi * 60}ms`, opacity: 0 }}
                    >
                      {/* Supplier header */}
                      <div className="flex items-center justify-between px-7 py-5 border-b border-[rgba(15,23,42,0.08)] bg-[rgba(248,249,252,0.7)]">
                        <div className="flex items-center gap-3">
                          <SupplierLogo supplierName={group.supplier} size={36} className="rounded-2xl shadow-sm border border-[rgba(17,17,17,0.12)]" />
                          <div>
                            <p className="font-extrabold text-[var(--dc-text,#0f172a)] tracking-tight">{group.supplier}</p>
                            <p className="text-xs text-[var(--dc-muted,#64748b)]">{group.items.length} item{group.items.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[var(--dc-muted,#64748b)] font-medium mb-0.5">Subtotal</p>
                          <p className="text-lg font-extrabold text-[var(--dc-accent-strong,#111111)]">£{group.subtotal.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-[rgba(15,23,42,0.06)]">
                        {group.items.map((item) => {
                          const meta = CATEGORY_META[item.category] ?? { color: "#111111", bg: "#f5f3ff", icon: "inventory_2" };
                          const isUpdating = updating === item.id;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-start gap-5 px-7 py-6 transition-all duration-200 ${
                                isUpdating ? "opacity-40 pointer-events-none" : "hover:bg-black/[0.02]"
                              }`}
                            >
                              {/* Product image */}
                              <div
                                className="relative w-20 h-20 flex-shrink-0 rounded-2xl overflow-hidden shadow-sm"
                                style={{ background: meta.bg }}
                              >
                                <ProductImg src={item.image} name={item.name} category={item.category} />
                              </div>

                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[var(--dc-muted,#64748b)] uppercase tracking-widest mb-0.5">{item.brand}</p>
                                <Link href={`/product/${item.productId}`}>
                                  <p className="font-bold text-[var(--dc-text,#0f172a)] leading-snug line-clamp-2 hover:text-[var(--dc-accent-strong,#111111)] transition-colors mb-1.5">
                                    {item.name}
                                  </p>
                                </Link>
                                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                                  <span className="text-xs text-[var(--dc-muted,#64748b)] bg-[rgba(15,23,42,0.04)] border border-[rgba(15,23,42,0.06)] px-2.5 py-0.5 rounded-full font-medium">{item.packSize}</span>
                                  {item.sku && (
                                    <span className="text-xs font-mono text-[var(--dc-muted,#64748b)] bg-[rgba(15,23,42,0.04)] border border-[rgba(15,23,42,0.06)] px-2.5 py-0.5 rounded-full">SKU: {item.sku}</span>
                                  )}
                                </div>

                                {/* Out-of-stock badge */}
                                {!item.inStock && (
                                  <div className="flex items-center gap-1.5 mb-3">
                                    <span className="material-symbols-outlined text-[13px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                                    <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Out of stock</span>
                                  </div>
                                )}

                                {/* Qty + remove */}
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center bg-[rgba(15,23,42,0.04)] border border-[rgba(15,23,42,0.07)] rounded-2xl overflow-hidden">
                                    <button
                                      onClick={() => updateQty(item.id, item.quantity - 1)}
                                      className="w-9 h-9 flex items-center justify-center text-[var(--dc-muted,#64748b)] hover:bg-black/[0.05] transition-colors font-bold text-lg active:scale-90"
                                    >−</button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={e => {
                                        const v = parseInt(e.target.value);
                                        if (!isNaN(v) && v > 0) updateQty(item.id, v);
                                      }}
                                      className="w-12 text-sm font-extrabold text-[var(--dc-text,#0f172a)] text-center bg-transparent outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                      onClick={() => updateQty(item.id, item.quantity + 1)}
                                      className="w-9 h-9 flex items-center justify-center text-[var(--dc-muted,#64748b)] hover:bg-black/[0.05] transition-colors font-bold text-lg active:scale-90"
                                    >+</button>
                                  </div>
                                  <button
                                    onClick={() => removeItem(item.id)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-[var(--dc-muted,#64748b)] hover:text-rose-600 transition-colors px-3 py-2 rounded-xl hover:bg-rose-50 active:scale-95"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                    Remove
                                  </button>
                                </div>
                              </div>

                              {/* Price */}
                              <div className="text-right flex-shrink-0 pt-1">
                                <p className={`text-xl font-extrabold tracking-tight ${item.inStock ? "text-[var(--dc-text,#0f172a)]" : "text-slate-300 line-through"}`}>
                                  £{(item.unitPrice * item.quantity).toFixed(2)}
                                </p>
                                {item.quantity > 1 && (
                                  <p className="text-xs text-[var(--dc-muted,#64748b)] mt-0.5">£{item.unitPrice.toFixed(2)} each</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {hasSession && basketPushSuppliers.has(group.supplier) && (() => {
                        const inStockCount = group.items.filter(i => i.inStock).length;
                        const result = pushResultBySupplier[group.supplier];
                        const isPushing = pushingSupplier === group.supplier;
                        const disabled = isPushing || inStockCount === 0 || !!pushingSupplier;
                        const isBrowserBacked = BASKET_PUSH_BROWSER_BACKED.has(group.supplier);
                        const consentChecked = !!autoPlaceConsent[group.supplier];
                        return (
                          <div className="px-7 py-4 border-t border-[rgba(15,23,42,0.06)] bg-[rgba(248,249,252,0.55)]">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <span
                                  className="material-symbols-outlined text-[20px] text-[var(--dc-accent-strong,#111111)] mt-0.5 flex-shrink-0"
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  shopping_basket
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-[var(--dc-text,#0f172a)]">
                                    {isBrowserBacked && consentChecked ? `Place order on ${group.supplier}` : `Send to your ${group.supplier} basket`}
                                  </p>
                                  <p className="text-xs text-[var(--dc-muted,#64748b)] mt-0.5 leading-relaxed">
                                    {isBrowserBacked && consentChecked
                                      ? `Dentago will sign into ${group.supplier}, add these ${inStockCount} item${inStockCount === 1 ? "" : "s"}, and submit the order automatically.`
                                      : `Dentago adds these ${inStockCount} item${inStockCount === 1 ? "" : "s"} to your ${group.supplier} basket — you confirm payment on their site.`
                                    }
                                    {isBrowserBacked && (
                                      <span className="block mt-1 opacity-70">Uses browser automation — may take up to a minute.</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => pushToSupplierBasket(group)}
                                disabled={disabled}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl !bg-[#111111] !text-white font-bold text-sm shadow-md shadow-[rgba(17,17,17,0.18)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                              >
                                <span className="material-symbols-outlined text-[16px] !text-white">{isPushing ? "hourglass_top" : (isBrowserBacked && consentChecked ? "send" : "open_in_new")}</span>
                                {isPushing ? (isBrowserBacked && consentChecked ? "Placing order…" : "Pushing…") : (isBrowserBacked && consentChecked ? `Place order on ${group.supplier}` : `Push to ${group.supplier}`)}
                              </button>
                            </div>

                            {/* Auto-place consent toggle (browser-backed suppliers only) */}
                            {isBrowserBacked && !result?.orderPlaced && (
                              <label className="mt-3.5 flex items-start gap-2.5 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={consentChecked}
                                  onChange={e => setAutoPlaceConsent(prev => ({ ...prev, [group.supplier]: e.target.checked }))}
                                  className="mt-0.5 h-3.5 w-3.5 rounded accent-[#111111] flex-shrink-0"
                                />
                                <span className="text-[11px] leading-relaxed text-[var(--dc-muted,#64748b)] group-hover:text-[var(--dc-text,#0f172a)] transition-colors">
                                  <span className="font-semibold text-[var(--dc-text,#0f172a)]">Also auto-place this order</span> — I authorise Dentago to submit checkout on my behalf using my saved {group.supplier} login.
                                </span>
                              </label>
                            )}

                            {result && (
                              <div
                                className={`mt-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                                  result.ok
                                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                                    : "bg-rose-50 border border-rose-200 text-rose-800"
                                }`}
                                role="status"
                                aria-live="polite"
                              >
                                <span
                                  className="material-symbols-outlined text-[15px] flex-shrink-0 mt-0.5"
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  {result.ok ? (result.orderPlaced ? "task_alt" : "check_circle") : "error"}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-semibold">{result.message}</p>
                                  {result.orderPlaced && (
                                    <p className="mt-1 font-bold text-emerald-900">
                                      Order placed on {group.supplier}{result.supplierOrderNumber ? ` · Ref: ${result.supplierOrderNumber}` : ""}. Log into your {group.supplier} account to confirm.
                                    </p>
                                  )}
                                  {result.ok && result.basketUrl && !result.orderPlaced && (
                                    <a
                                      href={result.basketUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-bold underline underline-offset-2 hover:no-underline mt-0.5 inline-block"
                                    >
                                      Open {group.supplier} basket →
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              {/* ── Right: order summary ──────────────────────────────────────── */}
              <div id="cart-summary" className="lg:sticky lg:top-8 space-y-4 scroll-mt-32">

                {/* Summary card */}
                <div className="bg-[rgba(255,255,255,0.72)] backdrop-blur-xl rounded-[28px] border border-[rgba(15,23,42,0.08)] shadow-[0_18px_55px_rgba(15,23,42,0.08)] overflow-hidden">
                  <div className="px-7 py-5 border-b border-[rgba(15,23,42,0.08)] bg-[rgba(248,249,252,0.7)]">
                    <h2 className="text-lg font-extrabold text-[var(--dc-text,#0f172a)] tracking-tight">Order Summary</h2>
                  </div>

                  <div className="px-7 py-6 space-y-3.5">
                    {cart.bySupplier.map((group) => (
                      <div key={group.supplier} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-xl bg-[rgba(17,17,17,0.10)] text-[var(--dc-accent-strong,#111111)] border border-[rgba(17,17,17,0.16)] flex items-center justify-center text-[10px] font-black flex-shrink-0">
                            {group.supplier[0]}
                          </div>
                          <span className="text-sm text-[var(--dc-text,#0f172a)] font-medium truncate">{group.supplier}</span>
                          <span className="text-xs text-[var(--dc-muted,#64748b)] flex-shrink-0">×{group.items.reduce((s, i) => s + i.quantity, 0)}</span>
                        </div>
                        <span className="text-sm font-bold text-[var(--dc-text,#0f172a)] flex-shrink-0">£{group.subtotal.toFixed(2)}</span>
                      </div>
                    ))}

                    {savingsData && (
                      <div className="flex items-center gap-3 bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.18)] rounded-2xl px-4 py-3.5 !mt-4">
                        <span className="material-symbols-outlined text-[22px] text-emerald-600 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
                        <div>
                          <p className="text-sm font-extrabold text-emerald-800">Saving £{savingsData.total.toFixed(2)} on this order</p>
                          <p className="text-xs text-emerald-700/80 mt-0.5">~£{savingsData.annual >= 1000 ? (savingsData.annual / 1000).toFixed(1) + "k" : savingsData.annual.toFixed(0)}/year if ordered weekly</p>
                        </div>
                      </div>
                    )}

                    <div className="h-px bg-[rgba(15,23,42,0.08)] !my-4" />

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--dc-text,#0f172a)]">Total</span>
                      <span className="text-3xl font-extrabold text-[var(--dc-text,#0f172a)] tracking-tight">£{cart.total.toFixed(2)}</span>
                    </div>

                    <p className="text-xs text-[var(--dc-muted,#64748b)] leading-relaxed pt-1">
                      Orders are routed to each supplier separately. Delivery times vary per supplier.
                    </p>
                  </div>

                  <div className="px-7 pb-7">
                    {error && (
                      <div data-testid="order-error-banner" className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 animate-slide-up">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-[18px] text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                              {errorKind === "network" ? "cloud_off" : errorKind === "validation" ? "report" : "error"}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-extrabold text-red-700 mb-0.5">
                              {errorKind === "network"
                                ? "Couldn\u2019t reach the server"
                                : errorKind === "validation"
                                ? "Something\u2019s not right with this order"
                                : "We couldn\u2019t place your order"}
                            </p>
                            <p className="text-xs text-red-600 font-medium leading-relaxed break-words">{error}</p>
                            <p className="text-xs text-red-500/80 mt-2 leading-relaxed">
                              {errorKind === "network"
                                ? "Your cart is safe — nothing was charged. Check your connection and try again."
                                : errorKind === "validation"
                                ? "Review the items above (an SKU may have changed) and try again."
                                : "Your cart is safe — nothing was charged. Try again, or get in touch and we\u2019ll place it manually."}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                              <button
                                onClick={() => { setError(""); setErrorKind(null); placeOrder(); }}
                                disabled={submitting}
                                className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[14px]">refresh</span>
                                Retry order
                              </button>
                              <a
                                href={`mailto:support@dentago.co.uk?subject=Order%20failed%20%C2%A3${cart.total.toFixed(2)}&body=${encodeURIComponent(`Hi Dentago — my order didn't go through. Error: ${error}`)}`}
                                className="inline-flex items-center gap-1.5 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">mail</span>
                                Contact support
                              </a>
                              <button
                                onClick={() => { setError(""); setErrorKind(null); }}
                                className="inline-flex items-center text-red-400 hover:text-red-600 text-xs font-medium px-2 py-1.5 ml-auto"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {!hasSession ? (
                      <>
                        <Link
                          href={`/login?next=${encodeURIComponent("/cart")}`}
                          className="w-full flex items-center justify-center gap-2.5 !bg-[#111111] !text-white py-4 rounded-2xl font-extrabold text-base hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_18px_45px_rgba(17,17,17,0.28)]"
                        >
                          <span className="material-symbols-outlined text-[20px]">login</span>
                          Sign in to place order · £{cart.total.toFixed(2)}
                        </Link>
                        <p className="text-xs text-slate-400 text-center mt-3 leading-relaxed">
                          Your cart is saved on this device. After you sign in, it moves to your clinic account automatically.
                        </p>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={placeOrder}
                          disabled={submitting || cart.items.every((i) => !i.inStock)}
                          className="w-full flex items-center justify-center gap-2.5 !bg-[#111111] !text-white py-4 rounded-2xl font-extrabold text-base hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_18px_45px_rgba(17,17,17,0.28)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? (
                            <>
                              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15"/>
                              </svg>
                              Placing Order…
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[20px]">shopping_cart_checkout</span>
                              {cart.items.every((i) => !i.inStock)
                                ? "Cannot place — all items out of stock"
                                : error
                                  ? `Try again · £${cart.total.toFixed(2)}`
                                  : `Confirm Order · £${cart.total.toFixed(2)}`}
                            </>
                          )}
                        </button>
                        <p className="text-xs text-slate-400 text-center mt-3 leading-relaxed">
                          Records your order and routes it to each supplier. Use the <strong className="text-slate-500">Send to basket</strong> buttons above to push items directly to each supplier account.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Trust signals */}
                <div className="bg-[rgba(255,255,255,0.72)] backdrop-blur-xl rounded-[28px] border border-[rgba(15,23,42,0.08)] shadow-[0_18px_55px_rgba(15,23,42,0.08)] px-7 py-5 space-y-4">
                  {[
                    { icon: "lock", label: "Secure & encrypted", sub: "256-bit SSL protection" },
                    { icon: "local_shipping", label: "Direct from suppliers", sub: "Each supplier delivers independently" },
                    { icon: "volunteer_activism", label: "Free for clinics", sub: "No fees, ever" },
                  ].map(({ icon, label, sub }) => (
                    <div key={label} className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-2xl bg-[rgba(17,17,17,0.10)] border border-[rgba(17,17,17,0.16)] flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-[var(--dc-accent-strong,#111111)]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--dc-text,#0f172a)]">{label}</p>
                        <p className="text-xs text-[var(--dc-muted,#64748b)]">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
