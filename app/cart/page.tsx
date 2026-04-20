"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CATEGORY_META } from "@/lib/products";

type CartItem = { supplier: string; price: number; name: string; category: string };
type EnrichedItem = CartItem & { productId: number; supplierId?: number; sku?: string; packSize?: string };

function CartContent() {
  const searchParams = useSearchParams();

  const [items, setItems] = useState<Record<number, EnrichedItem>>({});
  const [clinicName, setClinicName] = useState("");
  const [clinicEmail, setClinicEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    const raw = searchParams.get("items");
    if (!raw) return;
    try {
      const parsed: Record<number, CartItem> = JSON.parse(decodeURIComponent(raw));
      const enriched: Record<number, EnrichedItem> = {};
      Object.entries(parsed).forEach(([id, item]) => {
        enriched[Number(id)] = { ...item, productId: Number(id) };
      });
      setItems(enriched);

      setEnriching(true);
      Promise.all(
        Object.keys(parsed).map(id =>
          fetch(`/api/products/${id}`)
            .then(r => r.json())
            .then(data => {
              const cartItem = parsed[Number(id)];
              const supplier = data.suppliers?.find((s: any) => s.name === cartItem.supplier);
              return { id: Number(id), supplierId: supplier?.id, sku: supplier?.sku, packSize: supplier?.packSize };
            })
            .catch(() => ({ id: Number(id), supplierId: undefined, sku: undefined, packSize: undefined }))
        )
      ).then(results => {
        setItems(prev => {
          const next = { ...prev };
          results.forEach(r => {
            if (next[r.id]) {
              next[r.id] = { ...next[r.id], supplierId: r.supplierId, sku: r.sku, packSize: r.packSize };
            }
          });
          return next;
        });
        setEnriching(false);
      });
    } catch {
      // ignore parse error
    }
  }, [searchParams]);

  const cartEntries = Object.entries(items);
  const total = cartEntries.reduce((sum, [, item]) => sum + item.price, 0);

  function removeItem(id: number) {
    setItems(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clinicName.trim()) { setError("Please enter your clinic name."); return; }
    if (cartEntries.length === 0) { setError("Your cart is empty."); return; }

    setError("");
    setSubmitting(true);

    const orderItems = cartEntries.map(([, item]) => ({
      productId: item.productId,
      supplierId: item.supplierId,
      sku: item.sku ?? "N/A",
      quantity: 1,
      unitPrice: item.price,
      packSize: item.packSize,
    }));

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicName, clinicEmail, notes, items: orderItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to place order");
      setOrderId(data.orderId);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-[44px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#151121] mb-2">Order Placed!</h1>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Your order has been received. We&apos;ll route it to the relevant suppliers and follow up with confirmation.
          </p>
          <div className="bg-slate-50 rounded-xl px-4 py-3 mb-8 text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Order Reference</p>
            <p className="text-sm font-mono font-bold text-[#6C3DE8] break-all">{orderId}</p>
          </div>
          <Link href="/search" className="w-full flex items-center justify-center gap-2 bg-[#6C3DE8] text-white py-3.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-md shadow-[#6C3DE8]/20">
            <span className="material-symbols-outlined text-[18px]">search</span>
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121]">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 px-4 h-14 max-w-5xl mx-auto">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</Link>
          <span className="text-slate-300 font-light">/</span>
          <span className="text-sm font-bold text-slate-600">Checkout</span>
          <Link href="/search" className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#6C3DE8] transition-colors">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to search
          </Link>
        </div>
      </nav>

      <div className="pt-14 max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-extrabold text-[#151121] mb-8">Review &amp; Place Order</h1>

        {cartEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <span className="material-symbols-outlined text-[56px] text-slate-300 mb-4">shopping_cart</span>
            <h2 className="text-xl font-extrabold text-[#151121] mb-2">Your cart is empty</h2>
            <p className="text-slate-400 text-sm mb-6">Add products from the search page</p>
            <Link href="/search" className="bg-[#6C3DE8] text-white px-6 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all">
              Browse Products
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">

            {/* Left: order items + clinic details */}
            <div className="space-y-6">

              {/* Cart items */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-bold text-[#151121]">Order Items</h2>
                  <span className="text-xs text-slate-400 font-medium">{cartEntries.length} item{cartEntries.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {cartEntries.map(([id, item]) => {
                    const meta = CATEGORY_META[item.category] ?? { color: "#6C3DE8", bg: "#f5f3ff", icon: "inventory_2" };
                    return (
                      <div key={id} className="flex items-start gap-4 px-6 py-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                          <span className="material-symbols-outlined text-[20px]" style={{ color: meta.color, fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#151121] line-clamp-2">{item.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">via <span className="font-semibold text-slate-600">{item.supplier}</span></span>
                            {item.sku && <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{item.sku}</span>}
                            {enriching && !item.sku && <span className="text-[10px] text-slate-300 animate-pulse">Loading details…</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-base font-extrabold text-[#6C3DE8]">£{item.price.toFixed(2)}</p>
                          <button
                            type="button"
                            onClick={() => removeItem(Number(id))}
                            className="text-[10px] text-slate-400 hover:text-red-500 transition-colors font-medium"
                          >Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Clinic details */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-[#151121]">Clinic Details</h2>
                  <p className="text-xs text-slate-400 mt-0.5">We&apos;ll use these to route your order and confirm delivery</p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Clinic Name <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={clinicName}
                      onChange={e => setClinicName(e.target.value)}
                      placeholder="e.g. Bright Smile Dental Practice"
                      required
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-[#151121] placeholder:text-slate-400 outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={clinicEmail}
                      onChange={e => setClinicEmail(e.target.value)}
                      placeholder="orders@yourclinic.co.uk"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-[#151121] placeholder:text-slate-400 outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Delivery instructions, urgency, preferred brands…"
                      rows={3}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-[#151121] placeholder:text-slate-400 outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: order summary + submit */}
            <div className="lg:sticky lg:top-20 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-[#151121]">Order Summary</h2>
                </div>
                <div className="px-6 py-5 space-y-3">
                  {cartEntries.map(([id, item]) => (
                    <div key={id} className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-600 font-medium line-clamp-2 flex-1">{item.name}</p>
                      <p className="text-xs font-bold text-[#151121] flex-shrink-0">£{item.price.toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="h-px bg-slate-100 my-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">Total</span>
                    <span className="text-2xl font-extrabold text-[#151121]">£{total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="px-6 pb-6">
                  {error && (
                    <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <span className="material-symbols-outlined text-[16px] text-red-400 flex-shrink-0 mt-0.5">error</span>
                      <p className="text-xs text-red-600 font-medium">{error}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || cartEntries.length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-[#6C3DE8] text-white py-4 rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-[#6C3DE8]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15"/></svg>
                        Placing Order…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        Place Order
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-3 leading-relaxed">
                    By placing this order you agree to our terms. Orders are free to place — suppliers confirm availability directly.
                  </p>
                </div>
              </div>

              {/* Trust signals */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 space-y-3">
                {[
                  { icon: "lock", text: "Secure & encrypted" },
                  { icon: "local_shipping", text: "Supplier delivers directly" },
                  { icon: "volunteer_activism", text: "Free platform — no commission" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-[#6C3DE8]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                    <p className="text-xs font-semibold text-slate-600">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense>
      <CartContent />
    </Suspense>
  );
}
