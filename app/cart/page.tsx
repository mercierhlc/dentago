"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CATEGORY_META } from "@/lib/products";
import { getToken, getClinic, clearAuth, freshAuthHeaders } from "@/lib/auth";
import ProfileMenu from "@/components/ProfileMenu";

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

function ProductImg({ src, name, category }: { src: string; name: string; category: string }) {
  const [err, setErr] = useState(false);
  const meta = CATEGORY_META[category] ?? { color: "#6C3DE8", bg: "#f5f3ff", icon: "inventory_2" };
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

  useEffect(() => { setClinic(getClinic()); }, []);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch("/api/cart", { headers: await freshAuthHeaders() });
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error ?? `HTTP ${res.status}`);
        setCart(null);
      } else {
        setCart(data);
        setFetchError(null);
      }
    } catch (err: any) {
      setFetchError(err.message ?? "Network error");
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  async function updateQty(itemId: string, quantity: number) {
    setUpdating(itemId);
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
    await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...await freshAuthHeaders() },
      body: JSON.stringify({ itemId }),
    });
    await fetchCart();
    setUpdating(null);
  }

  async function placeOrder() {
    if (!cart || cart.items.length === 0) return;
    setError("");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to place order");
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
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-6">
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
            <p className="font-mono font-bold text-[#6C3DE8] break-all">{orderId}</p>
          </div>
          <Link href="/search" className="w-full flex items-center justify-center gap-2 bg-[#6C3DE8] text-white py-4 rounded-2xl font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#6C3DE8]/25">
            <span className="material-symbols-outlined text-[20px]">search</span>
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121] animate-page-in">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl border-b border-slate-100/80 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-center px-8 h-16 max-w-6xl mx-auto gap-4">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-[#6C3DE8] flex-shrink-0">Dentago</Link>
          <span className="text-slate-200">/</span>
          <span className="font-semibold text-slate-400">Cart</span>

          <Link href="/search" className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#6C3DE8] transition-colors">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to search
          </Link>

          <ProfileMenu clinic={clinic} />
        </div>
      </nav>

      <div className="pt-24 max-w-6xl mx-auto px-6 pb-20">

        {/* ── Not logged in ────────────────────────────────────────────────────── */}
        {!getToken() && !loading && (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[40px] text-slate-400">lock</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#151121] mb-2">Sign in to view your cart</h2>
            <p className="text-slate-400 mb-8">Your cart is saved to your clinic account.</p>
            <Link href="/onboarding/login.html" className="bg-[#6C3DE8] text-white px-8 py-3.5 rounded-2xl font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#6C3DE8]/20">
              Sign In
            </Link>
          </div>
        )}

        {/* ── Fetch error ──────────────────────────────────────────────────────── */}
        {!loading && fetchError && (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[40px] text-red-400">error</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#151121] mb-2">Couldn&apos;t load your cart</h2>
            <p className="text-slate-400 mb-2 font-mono text-sm">{fetchError}</p>
            <button onClick={fetchCart} className="mt-4 bg-[#6C3DE8] text-white px-8 py-3.5 rounded-2xl font-bold hover:brightness-110 transition-all">
              Retry
            </button>
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                  <div className="h-16 shimmer" />
                  {[1, 2].map(j => (
                    <div key={j} className="flex gap-5 p-6 border-t border-slate-100">
                      <div className="w-20 h-20 rounded-2xl shimmer flex-shrink-0" />
                      <div className="flex-1 space-y-3 pt-1">
                        <div className="h-3.5 shimmer rounded-full w-1/4" />
                        <div className="h-5 shimmer rounded-full w-3/4" />
                        <div className="h-3.5 shimmer rounded-full w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="bg-white rounded-3xl border border-slate-100 h-80 shimmer" />
          </div>
        )}

        {/* ── Empty cart ───────────────────────────────────────────────────────── */}
        {!loading && cart && cart.itemCount === 0 && (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[44px] text-slate-300">shopping_cart</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#151121] mb-2">Your cart is empty</h2>
            <p className="text-slate-400 mb-8">Add products from the search page to get started.</p>
            <Link href="/search" className="bg-[#6C3DE8] text-white px-8 py-3.5 rounded-2xl font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#6C3DE8]/20">
              Browse Products
            </Link>
          </div>
        )}

        {/* ── Cart with items ──────────────────────────────────────────────────── */}
        {!loading && cart && cart.itemCount > 0 && (
          <>
            {/* Page header */}
            <div className="mb-8">
              <h1 className="text-4xl font-extrabold tracking-tight text-[#151121] mb-1">Your Cart</h1>
              <p className="text-slate-400 font-medium">
                {cart.itemCount} item{cart.itemCount !== 1 ? "s" : ""} · {cart.bySupplier.length} supplier{cart.bySupplier.length !== 1 ? "s" : ""}
              </p>
            </div>

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
                  const initial = group.supplier[0].toUpperCase();
                  return (
                    <div
                      key={group.supplier}
                      className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden animate-card-reveal"
                      style={{ animationDelay: `${gi * 60}ms`, opacity: 0 }}
                    >
                      {/* Supplier header */}
                      <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#6C3DE8] text-white flex items-center justify-center text-sm font-black flex-shrink-0 shadow-md shadow-[#6C3DE8]/20">
                            {initial}
                          </div>
                          <div>
                            <p className="font-bold text-[#151121]">{group.supplier}</p>
                            <p className="text-xs text-slate-400">{group.items.length} item{group.items.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 font-medium mb-0.5">Subtotal</p>
                          <p className="text-lg font-extrabold text-[#6C3DE8]">£{group.subtotal.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-slate-50">
                        {group.items.map((item) => {
                          const meta = CATEGORY_META[item.category] ?? { color: "#6C3DE8", bg: "#f5f3ff", icon: "inventory_2" };
                          const isUpdating = updating === item.id;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-start gap-5 px-7 py-6 transition-all duration-200 ${isUpdating ? "opacity-40 pointer-events-none" : "hover:bg-slate-50/50"}`}
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
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">{item.brand}</p>
                                <Link href={`/product/${item.productId}`}>
                                  <p className="font-bold text-[#151121] leading-snug line-clamp-2 hover:text-[#6C3DE8] transition-colors mb-1.5">
                                    {item.name}
                                  </p>
                                </Link>
                                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                                  <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-medium">{item.packSize}</span>
                                  {item.sku && (
                                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">SKU: {item.sku}</span>
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
                                  <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden">
                                    <button
                                      onClick={() => updateQty(item.id, item.quantity - 1)}
                                      className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors font-bold text-lg active:scale-90"
                                    >−</button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={e => {
                                        const v = parseInt(e.target.value);
                                        if (!isNaN(v) && v > 0) updateQty(item.id, v);
                                      }}
                                      className="w-12 text-sm font-extrabold text-[#151121] text-center bg-transparent outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                      onClick={() => updateQty(item.id, item.quantity + 1)}
                                      className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors font-bold text-lg active:scale-90"
                                    >+</button>
                                  </div>
                                  <button
                                    onClick={() => removeItem(item.id)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50 active:scale-95"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                    Remove
                                  </button>
                                </div>
                              </div>

                              {/* Price */}
                              <div className="text-right flex-shrink-0 pt-1">
                                <p className={`text-xl font-extrabold tracking-tight ${item.inStock ? "text-[#151121]" : "text-slate-300 line-through"}`}>
                                  £{(item.unitPrice * item.quantity).toFixed(2)}
                                </p>
                                {item.quantity > 1 && (
                                  <p className="text-xs text-slate-400 mt-0.5">£{item.unitPrice.toFixed(2)} each</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Right: order summary ──────────────────────────────────────── */}
              <div className="lg:sticky lg:top-24 space-y-4">

                {/* Summary card */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="px-7 py-5 border-b border-slate-100">
                    <h2 className="text-lg font-extrabold text-[#151121] tracking-tight">Order Summary</h2>
                  </div>

                  <div className="px-7 py-6 space-y-3.5">
                    {cart.bySupplier.map((group) => (
                      <div key={group.supplier} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-[#6C3DE8]/10 text-[#6C3DE8] flex items-center justify-center text-[10px] font-black flex-shrink-0">
                            {group.supplier[0]}
                          </div>
                          <span className="text-sm text-slate-600 font-medium truncate">{group.supplier}</span>
                          <span className="text-xs text-slate-400 flex-shrink-0">×{group.items.reduce((s, i) => s + i.quantity, 0)}</span>
                        </div>
                        <span className="text-sm font-bold text-[#151121] flex-shrink-0">£{group.subtotal.toFixed(2)}</span>
                      </div>
                    ))}

                    <div className="h-px bg-slate-100 !my-4" />

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">Total</span>
                      <span className="text-3xl font-extrabold text-[#151121] tracking-tight">£{cart.total.toFixed(2)}</span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed pt-1">
                      Orders are routed to each supplier separately. Delivery times vary per supplier.
                    </p>
                  </div>

                  <div className="px-7 pb-7">
                    {error && (
                      <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-2xl px-4 py-3.5">
                        <span className="material-symbols-outlined text-[16px] text-red-400 flex-shrink-0 mt-0.5">error</span>
                        <p className="text-sm text-red-600 font-medium">{error}</p>
                      </div>
                    )}
                    <button
                      onClick={placeOrder}
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2.5 bg-[#6C3DE8] text-white py-4 rounded-2xl font-extrabold text-base hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-[#6C3DE8]/25 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          Place Order · £{cart.total.toFixed(2)}
                        </>
                      )}
                    </button>
                    <p className="text-xs text-slate-400 text-center mt-3 leading-relaxed">
                      Free to place — we never charge clinics.
                    </p>
                  </div>
                </div>

                {/* Trust signals */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] px-7 py-5 space-y-4">
                  {[
                    { icon: "lock", label: "Secure & encrypted", sub: "256-bit SSL protection" },
                    { icon: "local_shipping", label: "Direct from suppliers", sub: "Each supplier delivers independently" },
                    { icon: "volunteer_activism", label: "Free for clinics", sub: "No fees, ever" },
                  ].map(({ icon, label, sub }) => (
                    <div key={label} className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-[#6C3DE8]/8 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-[#6C3DE8]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#151121]">{label}</p>
                        <p className="text-xs text-slate-400">{sub}</p>
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
