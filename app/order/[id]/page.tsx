"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getClinic, freshAuthHeaders } from "@/lib/auth";
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
  { key: "pending",    label: "Placed",     icon: "check_circle"  },
  { key: "confirmed",  label: "Confirmed",  icon: "verified"      },
  { key: "processing", label: "Processing", icon: "autorenew"     },
  { key: "dispatched", label: "Dispatched", icon: "local_shipping"},
  { key: "delivered",  label: "Delivered",  icon: "inventory"     },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Order Placed",  color: "#b45309", bg: "#fef9ee" },
  confirmed:  { label: "Confirmed",    color: "#1d4ed8", bg: "#eff6ff" },
  processing: { label: "Processing",   color: "#6C3DE8", bg: "#f3effd" },
  dispatched: { label: "Dispatched",   color: "#0f766e", bg: "#f0fdf9" },
  delivered:  { label: "Delivered",    color: "#15803d", bg: "#f0fdf4" },
  cancelled:  { label: "Cancelled",    color: "#dc2626", bg: "#fef2f2" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
function addBizDays(date: Date, days: number) {
  const r = new Date(date);
  let added = 0;
  while (added < days) { r.setDate(r.getDate() + 1); if (r.getDay() !== 0 && r.getDay() !== 6) added++; }
  return r;
}
function fmtShort(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function estimatedDelivery(delivery: string | null): string {
  if (!delivery) return "Contact supplier";
  const d = delivery.toLowerCase();
  const today = new Date();
  if (d.includes("next day") || d.includes("1 day")) return fmtShort(addBizDays(today, 1));
  if (d.includes("1-2") || d.includes("1–2")) return `${fmtShort(addBizDays(today, 1))} – ${fmtShort(addBizDays(today, 2))}`;
  if (d.includes("2-3") || d.includes("2–3")) return `${fmtShort(addBizDays(today, 2))} – ${fmtShort(addBizDays(today, 3))}`;
  if (d.includes("3-5") || d.includes("3–5")) return `${fmtShort(addBizDays(today, 3))} – ${fmtShort(addBizDays(today, 5))}`;
  return delivery;
}

// ── Product image ──────────────────────────────────────────────────────────────
function ProductImg({ src, name, category }: { src: string; name: string; category: string }) {
  const [err, setErr] = useState(false);
  const meta = CATEGORY_META[category] ?? { color: "#6C3DE8", bg: "#f3effd", icon: "inventory_2" };
  if (!src || err) return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: meta.bg }}>
      <span className="material-symbols-outlined text-[20px]" style={{ color: meta.color, fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
    </div>
  );
  return <Image src={src} alt={name} fill className="object-contain p-2" unoptimized onError={() => setErr(true)} />;
}

// ── Status tracker ─────────────────────────────────────────────────────────────
function StatusTracker({ status }: { status: string }) {
  const activeIdx = STATUS_PIPELINE.findIndex(s => s.key === status);
  if (status === "cancelled") return (
    <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
      <span className="material-symbols-outlined text-[20px]" style={{ color: "#dc2626", fontVariationSettings: "'FILL' 1" }}>cancel</span>
      <div>
        <p className="font-bold text-sm" style={{ color: "#b91c1c" }}>Order Cancelled</p>
        <p className="text-xs mt-0.5" style={{ color: "#ef4444" }}>Contact support@dentago.co.uk for help.</p>
      </div>
    </div>
  );
  return (
    <div className="relative pt-1 pb-2">
      {/* Track line */}
      <div className="absolute top-[26px] left-[10%] right-[10%] h-[2px] hidden sm:block" style={{ background: "rgba(14,15,18,0.06)" }} />
      <div
        className="absolute top-[26px] left-[10%] h-[2px] hidden sm:block transition-all duration-700"
        style={{
          background: "linear-gradient(90deg, #0e0f12, #6C3DE8)",
          width: activeIdx <= 0 ? "0%" : `${(activeIdx / (STATUS_PIPELINE.length - 1)) * 80}%`,
        }}
      />
      <div className="grid grid-cols-5 relative">
        {STATUS_PIPELINE.map((step, i) => {
          const done = i <= activeIdx;
          const current = i === activeIdx;
          return (
            <div key={step.key} className="flex flex-col items-center gap-2 text-center">
              <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center relative z-10 transition-all duration-300" style={{
                background: current ? "#0e0f12" :
                            done    ? "#6C3DE8" :
                                      "#f5f3ff",
                boxShadow: current ? "0 4px 16px rgba(14,15,18,0.25)" :
                            done    ? "0 2px 8px rgba(108,61,232,0.25)" : "none",
                border: done ? "none" : "2px solid rgba(14,15,18,0.08)",
                transform: current ? "scale(1.1)" : "scale(1)",
              }}>
                <span className="material-symbols-outlined text-[16px]" style={{
                  color: done ? "white" : "rgba(14,15,18,0.2)",
                  fontVariationSettings: "'FILL' 1",
                }}>
                  {done && !current ? "check" : step.icon}
                </span>
              </div>
              <p className="text-[10px] font-bold leading-tight" style={{
                color: current ? "#0e0f12" : done ? "#6C3DE8" : "rgba(14,15,18,0.25)",
              }}>{step.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();

  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [clinic, setClinic]   = useState<ReturnType<typeof getClinic>>(null);
  const [copied, setCopied]   = useState(false);

  useEffect(() => { setClinic(getClinic()); }, []);

  const fetchOrder = useCallback(async (orderId: string, headers: Record<string, string>): Promise<Order | null> => {
    const res = await fetch(`/api/orders/${orderId}`, { headers });
    if (!res.ok) return null;
    return res.json() as Promise<Order>;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const headers = await freshAuthHeaders();
        const extraIds = (searchParams.get("ids") ?? "").split(",").filter(Boolean);
        const allIds = Array.from(new Set([id, ...extraIds]));
        const results = await Promise.all(allIds.map(oid => fetchOrder(oid, headers)));
        const valid = results.filter(Boolean) as Order[];
        if (valid.length === 0) setError("Order not found");
        else setOrders(valid);
      } catch { setError("Failed to load order"); }
      finally { setLoading(false); }
    })();
  }, [id, searchParams, fetchOrder]);

  function copyRef() {
    navigator.clipboard.writeText(id.slice(0, 8).toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const allSupplierGroups: SupplierGroup[] = orders.flatMap(o => o.bySupplier);
  const grandTotal = orders.reduce((s, o) => s + o.total, 0);
  const primaryOrder = orders[0];

  // ── Nav ──────────────────────────────────────────────────────────────────────
  const Nav = () => (
    <nav style={{ background: "rgba(240,239,246,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(14,15,18,0.08)" }}
      className="fixed top-0 w-full z-50">
      <div className="flex items-center px-6 h-[58px] max-w-5xl mx-auto gap-3">
        <Link href="/" className="font-black text-[17px] tracking-tight" style={{ color: "#0e0f12", letterSpacing: "-0.03em" }}>
          Dentago
        </Link>
        <span style={{ color: "rgba(14,15,18,0.2)" }} className="text-sm">·</span>
        <span className="text-sm font-semibold" style={{ color: "rgba(14,15,18,0.4)" }}>Order Confirmation</span>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/cart"
            className="flex items-center gap-1.5 text-sm font-bold text-white px-3.5 py-1.5 rounded-xl transition-all"
            style={{ background: "#0e0f12" }}>
            <span className="material-symbols-outlined text-[13px]">shopping_cart</span>
            <span className="hidden sm:inline">Cart</span>
          </Link>
          <ProfileMenu clinic={clinic} />
        </div>
      </div>
    </nav>
  );

  if (loading) return (
    <div style={{ background: "#f0eff6", minHeight: "100vh" }}>
      <Nav />
      <div className="pt-[58px] max-w-5xl mx-auto px-6 pb-20 pt-24 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-36 bg-white rounded-3xl animate-pulse" style={{ border: "1px solid rgba(14,15,18,0.06)" }} />)}
      </div>
    </div>
  );

  if (error || !primaryOrder) return (
    <div style={{ background: "#f0eff6", minHeight: "100vh" }}>
      <Nav />
      <div className="pt-[58px] max-w-5xl mx-auto px-6 flex flex-col items-center justify-center py-40">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "#fef2f2" }}>
          <span className="material-symbols-outlined text-[26px]" style={{ color: "#dc2626" }}>error</span>
        </div>
        <h2 className="text-xl font-black mb-2" style={{ color: "#0e0f12" }}>Order not found</h2>
        <p className="text-sm mb-8" style={{ color: "rgba(14,15,18,0.4)" }}>{error ?? "This order doesn't exist or you don't have access."}</p>
        <Link href="/search" className="text-white px-6 py-3 rounded-2xl font-bold text-sm" style={{ background: "#0e0f12" }}>
          Back to Search
        </Link>
      </div>
    </div>
  );

  const sm = STATUS_META[primaryOrder.status] ?? STATUS_META.pending;

  return (
    <div style={{ background: "#f0eff6", minHeight: "100vh", color: "#0e0f12" }}>
      <Nav />

      {/* ── Hero ── */}
      <div className="pt-[58px]" style={{ background: "#0e0f12" }}>
        <div className="max-w-5xl mx-auto px-6 py-10 pb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">

            {/* Left: status + name */}
            <div className="flex items-center gap-5">
              {/* Animated checkmark */}
              <div className="relative w-[60px] h-[60px] flex-shrink-0">
                <div className="absolute inset-0 rounded-2xl animate-ping" style={{ background: "rgba(108,61,232,0.3)", animationDuration: "2.5s" }} />
                <div className="relative w-full h-full rounded-2xl flex items-center justify-center" style={{ background: "#6C3DE8" }}>
                  <span className="material-symbols-outlined text-[28px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: "#6C3DE8" }}>Order Confirmed</p>
                <h1 className="text-[26px] font-black tracking-tight text-white leading-tight">
                  Thank you, {primaryOrder.clinicName}
                </h1>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>{fmtDate(primaryOrder.createdAt)}</p>
              </div>
            </div>

            {/* Right: ref + total */}
            <div className="flex items-stretch gap-3">
              <button onClick={copyRef}
                className="flex flex-col justify-center rounded-2xl px-5 py-3.5 transition-all"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Ref</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-white text-base tracking-widest">{id.slice(0, 8).toUpperCase()}</span>
                  <span className="material-symbols-outlined text-[12px] transition-colors" style={{ color: copied ? "#6C3DE8" : "rgba(255,255,255,0.25)" }}>
                    {copied ? "check" : "content_copy"}
                  </span>
                </div>
              </button>
              <div className="flex flex-col justify-center rounded-2xl px-5 py-3.5" style={{ background: "#6C3DE8" }}>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>Total</p>
                <span className="font-black text-white text-2xl tracking-tight">{fmtGBP(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-5xl mx-auto px-6 py-7">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* ── Left column ── */}
          <div className="space-y-4">

            {/* Status tracker card */}
            <div className="bg-white rounded-3xl p-6" style={{ border: "1px solid rgba(14,15,18,0.07)", boxShadow: "0 2px 16px rgba(14,15,18,0.05)" }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "rgba(14,15,18,0.35)" }}>Order Status</h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: sm.bg, color: sm.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.color }} />
                  {sm.label}
                </span>
              </div>
              <StatusTracker status={primaryOrder.status} />
              <p className="text-[11px] text-center mt-5" style={{ color: "rgba(14,15,18,0.35)" }}>
                Updates sent to{" "}
                <span className="font-semibold" style={{ color: "rgba(14,15,18,0.6)" }}>{primaryOrder.clinicEmail}</span>
              </p>
            </div>

            {/* Supplier groups */}
            {allSupplierGroups.map((group, gi) => (
              <div key={`${group.supplier.name}-${gi}`} className="bg-white rounded-3xl overflow-hidden"
                style={{ border: "1px solid rgba(14,15,18,0.07)", boxShadow: "0 2px 16px rgba(14,15,18,0.05)" }}>

                {/* Supplier header */}
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(14,15,18,0.06)", background: "rgba(14,15,18,0.015)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-black text-white flex-shrink-0"
                      style={{ background: "#0e0f12" }}>
                      {group.supplier.name?.[0] ?? "?"}
                    </div>
                    <div>
                      <p className="font-black text-sm" style={{ color: "#0e0f12" }}>{group.supplier.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "rgba(14,15,18,0.4)" }}>
                        {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {group.delivery && (
                      <div className="flex items-center gap-1 justify-end mb-1">
                        <span className="material-symbols-outlined text-[11px]" style={{ color: "#6C3DE8" }}>local_shipping</span>
                        <span className="text-[10px] font-bold" style={{ color: "#6C3DE8" }}>{estimatedDelivery(group.delivery)}</span>
                      </div>
                    )}
                    <p className="text-base font-black" style={{ color: "#0e0f12" }}>{fmtGBP(group.subtotal)}</p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  {group.items.map((item, ii) => (
                    <div key={item.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[rgba(14,15,18,0.015)]"
                      style={{ borderBottom: ii < group.items.length - 1 ? "1px solid rgba(14,15,18,0.04)" : "none" }}>

                      {/* Product image */}
                      <div className="relative w-[52px] h-[52px] rounded-xl overflow-hidden flex-shrink-0"
                        style={{ border: "1px solid rgba(14,15,18,0.07)" }}>
                        <ProductImg src={item.product.image} name={item.product.name} category={item.product.category} />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] mb-0.5" style={{ color: "rgba(14,15,18,0.35)" }}>
                          {item.product.brand}
                        </p>
                        <p className="text-sm font-semibold leading-snug line-clamp-1" style={{ color: "#0e0f12" }}>{item.product.name}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          {item.packSize && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: "rgba(14,15,18,0.05)", color: "rgba(14,15,18,0.5)" }}>
                              {item.packSize}
                            </span>
                          )}
                          {item.sku && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md" style={{ background: "rgba(108,61,232,0.06)", color: "#6C3DE8" }}>
                              SKU {item.sku}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Qty + price */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black" style={{ color: "#0e0f12" }}>{fmtGBP(item.unitPrice * item.quantity)}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "rgba(14,15,18,0.35)" }}>
                          ×{item.quantity}
                          {item.quantity > 1 && <span className="ml-1">{fmtGBP(item.unitPrice)} each</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-4 lg:sticky lg:top-[74px]">

            {/* Summary */}
            <div className="bg-white rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(14,15,18,0.07)", boxShadow: "0 2px 16px rgba(14,15,18,0.05)" }}>
              <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(14,15,18,0.06)" }}>
                <h3 className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "rgba(14,15,18,0.35)" }}>Order Summary</h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                {allSupplierGroups.map((group, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
                        style={{ background: "#0e0f12" }}>
                        {group.supplier.name?.[0] ?? "?"}
                      </div>
                      <span className="text-sm font-medium truncate" style={{ color: "rgba(14,15,18,0.7)" }}>{group.supplier.name}</span>
                      <span className="text-[11px] flex-shrink-0" style={{ color: "rgba(14,15,18,0.25)" }}>
                        ×{group.items.reduce((s, i) => s + i.quantity, 0)}
                      </span>
                    </div>
                    <span className="text-sm font-bold flex-shrink-0" style={{ color: "#0e0f12" }}>{fmtGBP(group.subtotal)}</span>
                  </div>
                ))}

                {/* Free platform fee line */}
                <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(14,15,18,0.05)" }}>
                  <span className="text-sm" style={{ color: "rgba(14,15,18,0.4)" }}>Platform fee</span>
                  <span className="text-sm font-bold" style={{ color: "#15803d" }}>Free</span>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between pt-1 pb-1" style={{ borderTop: "2px solid #0e0f12" }}>
                  <span className="text-sm font-bold" style={{ color: "rgba(14,15,18,0.6)" }}>Total paid</span>
                  <span className="text-[22px] font-black tracking-tight" style={{ color: "#0e0f12" }}>{fmtGBP(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="bg-white rounded-3xl px-5 py-4 space-y-3" style={{ border: "1px solid rgba(14,15,18,0.07)", boxShadow: "0 2px 16px rgba(14,15,18,0.05)" }}>
              <h3 className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "rgba(14,15,18,0.35)" }}>Estimated Delivery</h3>
              {allSupplierGroups.map((group, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(108,61,232,0.08)" }}>
                    <span className="material-symbols-outlined text-[13px]" style={{ color: "#6C3DE8", fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "#0e0f12" }}>{group.supplier.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(14,15,18,0.45)" }}>{estimatedDelivery(group.delivery)}</p>
                  </div>
                </div>
              ))}
              <p className="text-[10px] pt-2" style={{ color: "rgba(14,15,18,0.25)", borderTop: "1px solid rgba(14,15,18,0.05)" }}>
                Business days from order placement.
              </p>
            </div>

            {/* What's next */}
            <div className="bg-white rounded-3xl px-5 py-4" style={{ border: "1px solid rgba(14,15,18,0.07)", boxShadow: "0 2px 16px rgba(14,15,18,0.05)" }}>
              <h3 className="text-[11px] font-black uppercase tracking-[0.15em] mb-4" style={{ color: "rgba(14,15,18,0.35)" }}>What happens next</h3>
              <div className="space-y-4">
                {[
                  { icon: "mail",           bg: "rgba(14,15,18,0.06)",    ic: "#0e0f12",  title: "Confirmation sent",    desc: `Check ${primaryOrder.clinicEmail}` },
                  { icon: "storefront",     bg: "rgba(108,61,232,0.08)",  ic: "#6C3DE8",  title: "Suppliers notified",   desc: "Each supplier confirms independently" },
                  { icon: "local_shipping", bg: "rgba(21,128,61,0.08)",   ic: "#15803d",  title: "Direct delivery",      desc: "Delivered to your practice" },
                ].map(({ icon, bg, ic, title, desc }) => (
                  <div key={title} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                      <span className="material-symbols-outlined text-[13px]" style={{ color: ic, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: "#0e0f12" }}>{title}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "rgba(14,15,18,0.4)" }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Link href="/search"
                className="w-full flex items-center justify-center gap-2 text-white py-3.5 rounded-2xl font-bold text-sm transition-all"
                style={{ background: "#6C3DE8", boxShadow: "0 4px 16px rgba(108,61,232,0.3)" }}>
                <span className="material-symbols-outlined text-[15px]">add_shopping_cart</span>
                Place Another Order
              </Link>
              <a href={`mailto:support@dentago.co.uk?subject=Order Query — ${id.slice(0,8).toUpperCase()}`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all"
                style={{ color: "rgba(14,15,18,0.45)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(14,15,18,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span className="material-symbols-outlined text-[14px]">support_agent</span>
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
