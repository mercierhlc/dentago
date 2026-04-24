"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getClinic, clearAuth, freshAuthHeaders } from "@/lib/auth";
import ProfileMenu from "@/components/ProfileMenu";
import { CATEGORY_META } from "@/lib/products";

// ── Types ──────────────────────────────────────────────────────────────────────
type OrderItem = {
  id: number;
  sku: string;
  quantity: number;
  unitPrice: number;
  packSize?: string;
  delivery?: string;
  product: { id: number; name: string; brand: string; category: string; image: string };
  supplier: { id: number; name: string; website?: string };
};

type SupplierGroup = {
  supplier: { id: number; name: string; website?: string };
  items: OrderItem[];
  subtotal: number;
  delivery: string | null;
};

type Order = {
  id: string;
  clinicName: string;
  clinicEmail: string;
  status: string;
  total: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  bySupplier: SupplierGroup[];
};

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_PIPELINE = [
  { key: "pending",    label: "Order Placed",  icon: "check_circle",   desc: "We've received your order" },
  { key: "confirmed",  label: "Confirmed",     icon: "verified",       desc: "Supplier confirmed" },
  { key: "processing", label: "Processing",    icon: "autorenew",      desc: "Being picked & packed" },
  { key: "dispatched", label: "Dispatched",    icon: "local_shipping", desc: "On its way" },
  { key: "delivered",  label: "Delivered",     icon: "inventory",      desc: "Successfully delivered" },
];

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:    { label: "Order Placed",  bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  confirmed:  { label: "Confirmed",    bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  processing: { label: "Processing",   bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-500" },
  dispatched: { label: "Dispatched",   bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-500" },
  delivered:  { label: "Delivered",    bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled:  { label: "Cancelled",    bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-400" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function estimatedDelivery(delivery: string | null): string {
  if (!delivery) return "Contact supplier";
  const d = delivery.toLowerCase();
  const today = new Date();
  const addBizDays = (date: Date, days: number) => {
    const r = new Date(date);
    let added = 0;
    while (added < days) { r.setDate(r.getDate() + 1); if (r.getDay() !== 0 && r.getDay() !== 6) added++; }
    return r;
  };
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  if (d.includes("next day") || d.includes("next-day") || d.includes("1 day")) return fmt(addBizDays(today, 1));
  if (d.includes("1-2") || d.includes("1–2")) return `${fmt(addBizDays(today, 1))} – ${fmt(addBizDays(today, 2))}`;
  if (d.includes("2-3") || d.includes("2–3")) return `${fmt(addBizDays(today, 2))} – ${fmt(addBizDays(today, 3))}`;
  if (d.includes("3-5") || d.includes("3–5")) return `${fmt(addBizDays(today, 3))} – ${fmt(addBizDays(today, 5))}`;
  return delivery;
}

// ── Product image ──────────────────────────────────────────────────────────────
function ProductImg({ src, name, category }: { src: string; name: string; category: string }) {
  const [err, setErr] = useState(false);
  const meta = CATEGORY_META[category] ?? { color: "#6C3DE8", bg: "#f5f3ff", icon: "inventory_2" };
  if (!src || err) return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: meta.bg }}>
      <span className="material-symbols-outlined text-[22px]" style={{ color: meta.color, fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
    </div>
  );
  return <Image src={src} alt={name} fill className="object-contain p-2" unoptimized onError={() => setErr(true)} />;
}

// ── Status tracker ─────────────────────────────────────────────────────────────
function StatusTracker({ status }: { status: string }) {
  const activeIdx = STATUS_PIPELINE.findIndex(s => s.key === status);
  if (status === "cancelled") return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
      <span className="material-symbols-outlined text-[22px] text-red-400" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
      <div>
        <p className="font-bold text-red-700 text-sm">Order Cancelled</p>
        <p className="text-xs text-red-400 mt-0.5">Contact support@dentago.co.uk with any questions.</p>
      </div>
    </div>
  );
  return (
    <div className="relative py-2">
      <div className="absolute top-[22px] left-[10%] right-[10%] h-[2px] bg-slate-100 hidden sm:block" />
      <div
        className="absolute top-[22px] left-[10%] h-[2px] bg-gradient-to-r from-[#6C3DE8] to-violet-400 hidden sm:block transition-all duration-700"
        style={{ width: activeIdx <= 0 ? "0%" : `${(activeIdx / (STATUS_PIPELINE.length - 1)) * 80}%` }}
      />
      <div className="grid grid-cols-5 relative">
        {STATUS_PIPELINE.map((step, i) => {
          const done = i <= activeIdx;
          const current = i === activeIdx;
          return (
            <div key={step.key} className="flex flex-col items-center gap-2 text-center">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center relative z-10 transition-all duration-300 ${
                current  ? "bg-[#6C3DE8] shadow-lg shadow-[#6C3DE8]/30 scale-110" :
                done     ? "bg-emerald-500 shadow-sm" :
                           "bg-white border-2 border-slate-100"
              }`}>
                <span className="material-symbols-outlined text-[17px]"
                  style={{ color: done ? "white" : "#cbd5e1", fontVariationSettings: "'FILL' 1" }}>
                  {done && !current ? "check" : step.icon}
                </span>
              </div>
              <p className={`text-[10px] font-bold leading-tight ${
                current ? "text-[#6C3DE8]" : done ? "text-emerald-600" : "text-slate-300"
              }`}>{step.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clinic, setClinic] = useState<ReturnType<typeof getClinic>>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setClinic(getClinic()); }, []);

  const fetchOrder = useCallback(async (orderId: string, headers: Record<string, string>): Promise<Order | null> => {
    const res = await fetch(`/api/orders/${orderId}`, { headers });
    const data = await res.json();
    if (!res.ok) return null;
    return data as Order;
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const headers = await freshAuthHeaders();
        const extraIds = (searchParams.get("ids") ?? "").split(",").filter(Boolean);
        const allIds = Array.from(new Set([id, ...extraIds]));
        const results = await Promise.all(allIds.map(oid => fetchOrder(oid, headers)));
        const valid = results.filter(Boolean) as Order[];
        if (valid.length === 0) setError("Order not found");
        else setOrders(valid);
      } catch {
        setError("Failed to load order");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, searchParams, fetchOrder]);

  function copyRef() {
    navigator.clipboard.writeText(id.slice(0, 8).toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Merge all orders into one view
  const allSupplierGroups: SupplierGroup[] = orders.flatMap(o => o.bySupplier);
  const grandTotal = orders.reduce((s, o) => s + o.total, 0);
  const primaryOrder = orders[0];

  // ── Nav ──────────────────────────────────────────────────────────────────────
  const Nav = () => (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-100">
      <div className="flex items-center px-6 h-[60px] max-w-6xl mx-auto gap-3">
        <Link href="/" className="text-lg font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</Link>
        <span className="text-slate-200 text-sm">/</span>
        <span className="text-sm font-semibold text-slate-400">Order Confirmation</span>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/search"
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#6C3DE8] transition-colors border border-slate-200 hover:border-[#6C3DE8]/30 px-3 py-1.5 rounded-xl">
            <span className="material-symbols-outlined text-[14px]">search</span>
            Shop
          </Link>
          <ProfileMenu clinic={clinic} />
        </div>
      </div>
    </nav>
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#f8f7ff]">
      <Nav />
      <div className="pt-20 max-w-6xl mx-auto px-6 pb-20 space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="h-40 bg-white rounded-3xl border border-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !primaryOrder) return (
    <div className="min-h-screen bg-[#f8f7ff]">
      <Nav />
      <div className="pt-20 max-w-6xl mx-auto px-6 flex flex-col items-center justify-center py-40">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-[30px] text-red-400">error</span>
        </div>
        <h2 className="text-xl font-extrabold mb-2">Order not found</h2>
        <p className="text-slate-400 text-sm mb-8">{error ?? "This order doesn't exist or you don't have access."}</p>
        <Link href="/search" className="bg-[#6C3DE8] text-white px-6 py-3 rounded-2xl font-bold text-sm hover:brightness-110 transition-all">
          Back to Search
        </Link>
      </div>
    </div>
  );

  const m = STATUS_META[primaryOrder.status] ?? STATUS_META.pending;

  return (
    <div className="min-h-screen bg-[#f8f7ff] text-[#151121]">
      <Nav />

      {/* Hero confirmation banner */}
      <div className="bg-white border-b border-slate-100 pt-[60px]">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {/* Animated check */}
              <div className="relative w-[52px] h-[52px] flex-shrink-0">
                <div className="absolute inset-0 bg-emerald-400/20 rounded-2xl animate-ping" style={{ animationDuration: "2s" }} />
                <div className="relative w-full h-full bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <span className="material-symbols-outlined text-[24px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-500 mb-0.5">Order Confirmed</p>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#151121]">Thank you, {primaryOrder.clinicName}</h1>
                <p className="text-sm text-slate-400 mt-0.5">{fmtDate(primaryOrder.createdAt)}</p>
              </div>
            </div>

            {/* Reference + total */}
            <div className="flex items-center gap-3">
              <button onClick={copyRef}
                className="group flex flex-col items-start bg-slate-50 hover:bg-[#6C3DE8]/5 border border-slate-200 hover:border-[#6C3DE8]/30 rounded-2xl px-4 py-3 transition-all">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ref</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="font-mono font-extrabold text-[#6C3DE8] text-base tracking-widest">{id.slice(0, 8).toUpperCase()}</p>
                  <span className="material-symbols-outlined text-[13px] text-slate-300 group-hover:text-[#6C3DE8] transition-colors">
                    {copied ? "check" : "content_copy"}
                  </span>
                </div>
              </button>
              <div className="flex flex-col items-end bg-gradient-to-br from-[#6C3DE8] to-violet-500 rounded-2xl px-4 py-3 shadow-lg shadow-[#6C3DE8]/20">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/60">Total</p>
                <p className="font-extrabold text-white text-xl tracking-tight mt-0.5">{fmtGBP(grandTotal)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

          {/* ── Left ── */}
          <div className="space-y-4">

            {/* Status tracker */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(108,61,232,0.06)] p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-extrabold text-sm uppercase tracking-widest text-slate-400">Order Status</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${m.bg} ${m.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                  {m.label}
                </span>
              </div>
              <StatusTracker status={primaryOrder.status} />
              <p className="text-[11px] text-slate-400 mt-5 text-center leading-relaxed">
                Email updates will be sent to <span className="font-semibold text-slate-500">{primaryOrder.clinicEmail}</span>
              </p>
            </div>

            {/* Per-supplier breakdown */}
            {allSupplierGroups.map((group, gi) => (
              <div key={`${group.supplier.name}-${gi}`}
                className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(108,61,232,0.06)] overflow-hidden"
                style={{ animationDelay: `${gi * 60}ms` }}>

                {/* Supplier header */}
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#6C3DE8]/[0.03] to-transparent border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C3DE8] to-violet-500 text-white flex items-center justify-center text-sm font-black shadow-md shadow-[#6C3DE8]/20">
                      {(group.supplier.name?.[0] ?? "?")}
                    </div>
                    <div>
                      <p className="font-extrabold text-[#151121] text-sm">{group.supplier.name}</p>
                      <p className="text-xs text-slate-400">{group.items.length} item{group.items.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {group.delivery && (
                      <div className="flex items-center gap-1 justify-end mb-1">
                        <span className="material-symbols-outlined text-[11px] text-emerald-500">local_shipping</span>
                        <span className="text-[10px] font-bold text-emerald-600">{estimatedDelivery(group.delivery)}</span>
                      </div>
                    )}
                    <p className="text-base font-extrabold text-[#6C3DE8]">{fmtGBP(group.subtotal)}</p>
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-slate-50/80">
                  {group.items.map(item => {
                    const meta = CATEGORY_META[item.product.category] ?? { color: "#6C3DE8", bg: "#f5f3ff", icon: "inventory_2" };
                    return (
                      <div key={item.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                        {/* Product image */}
                        <div className="relative w-[52px] h-[52px] flex-shrink-0 rounded-xl overflow-hidden border border-slate-100"
                          style={{ background: meta.bg }}>
                          <ProductImg src={item.product.image} name={item.product.name} category={item.product.category} />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 mb-0.5">{item.product.brand}</p>
                          <p className="text-sm font-semibold text-[#151121] leading-snug line-clamp-1">{item.product.name}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {item.packSize && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium">{item.packSize}</span>
                            )}
                            {item.sku && (
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">SKU {item.sku}</span>
                            )}
                          </div>
                        </div>

                        {/* Qty + price */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-extrabold text-[#151121]">{fmtGBP(item.unitPrice * item.quantity)}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            ×{item.quantity}
                            {item.quantity > 1 && <span className="ml-0.5 text-slate-300">· {fmtGBP(item.unitPrice)}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-4 lg:sticky lg:top-[76px]">

            {/* Order total */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(108,61,232,0.06)] overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Order Summary</h3>
              </div>
              <div className="px-5 py-4 space-y-2.5">
                {allSupplierGroups.map((group, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-lg bg-[#6C3DE8]/10 flex items-center justify-center text-[9px] font-black text-[#6C3DE8] flex-shrink-0">
                        {(group.supplier.name?.[0] ?? "?")}
                      </div>
                      <span className="text-sm text-slate-600 font-medium truncate">{group.supplier.name}</span>
                      <span className="text-xs text-slate-300 flex-shrink-0">×{group.items.reduce((s,i) => s + i.quantity, 0)}</span>
                    </div>
                    <span className="text-sm font-bold text-[#151121] flex-shrink-0">{fmtGBP(group.subtotal)}</span>
                  </div>
                ))}
                <div className="h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent !my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500">Total paid</span>
                  <span className="text-2xl font-extrabold text-[#151121] tracking-tight">{fmtGBP(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(108,61,232,0.06)] px-5 py-4 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Estimated Delivery</h3>
              {allSupplierGroups.map((group, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[13px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#151121]">{group.supplier.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{estimatedDelivery(group.delivery)}</p>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-300 leading-relaxed pt-1 border-t border-slate-50">
                Estimates based on business days from order placement.
              </p>
            </div>

            {/* What's next */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(108,61,232,0.06)] px-5 py-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">What happens next</h3>
              <div className="space-y-3.5">
                {[
                  { icon: "mail", col: "text-[#6C3DE8] bg-[#6C3DE8]/8", title: "Confirmation sent", desc: `Check ${primaryOrder.clinicEmail}` },
                  { icon: "storefront", col: "text-amber-500 bg-amber-50", title: "Suppliers notified", desc: "Each supplier confirms independently" },
                  { icon: "local_shipping", col: "text-emerald-500 bg-emerald-50", title: "Direct delivery", desc: "Delivered to your practice" },
                ].map(({ icon, col, title, desc }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${col}`}>
                      <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#151121]">{title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Link href="/search"
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#6C3DE8] to-violet-500 text-white py-3.5 rounded-2xl font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#6C3DE8]/25">
                <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                Place Another Order
              </Link>
              <a href={`mailto:support@dentago.co.uk?subject=Order Query — ${id.slice(0,8).toUpperCase()}`}
                className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-[#6C3DE8] py-3 rounded-2xl font-semibold text-sm hover:bg-[#6C3DE8]/5 transition-all">
                <span className="material-symbols-outlined text-[15px]">support_agent</span>
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
