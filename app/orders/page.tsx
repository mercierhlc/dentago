"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getToken, getClinic, clearAuth, freshAuthHeaders } from "@/lib/auth";
import ProfileMenu from "@/components/ProfileMenu";

// ── Types ──────────────────────────────────────────────────────────────────────
type OrderItem = {
  id: number;
  sku: string;
  quantity: number;
  unit_price: number;
  pack_size: string;
  product_id: number;
  supplier_id: number;
  dentago_products?: { id: number; name: string; brand: string; category: string };
  dentago_suppliers?: { id: number; name: string };
};

type Order = {
  id: string;
  clinic_name: string;
  clinic_email: string;
  status: string;
  total_amount: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  dentago_order_items: OrderItem[];
};

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:    { label: "Pending",    bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  confirmed:  { label: "Confirmed",  bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  processing: { label: "Processing", bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-500" },
  dispatched: { label: "Dispatched", bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-500" },
  delivered:  { label: "Delivered",  bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled:  { label: "Cancelled",  bg: "bg-red-50",     text: "text-red-500",     dot: "bg-red-400" },
};

const STATUSES = ["all", "pending", "confirmed", "processing", "dispatched", "delivered", "cancelled"];

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function OrderHistoryPage() {
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [reordering, setReordering] = useState<string | null>(null);
  const [reorderSuccess, setReorderSuccess] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [clinic, setClinic]       = useState<ReturnType<typeof getClinic>>(null);

  // Filters
  const [status, setStatus]       = useState("all");
  const [search, setSearch]       = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [supplier, setSupplier]   = useState("all");

  // Pagination
  const [page, setPage]     = useState(1);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(1);
  const LIMIT = 20;

  // Derived supplier list from loaded orders
  const [supplierList, setSupplierList] = useState<string[]>([]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setClinic(getClinic()); }, []);

  const fetchOrders = useCallback(async (pg = 1, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(LIMIT) });
      if (status !== "all") params.set("status", status);
      if (q) params.set("search", q);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/orders?${params}`, { headers: await freshAuthHeaders() });
      if (!res.ok) { setError("Failed to load orders"); return; }
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
      setPage(pg);

      // Build supplier list from all fetched orders
      const names = new Set<string>();
      for (const o of data.orders ?? []) {
        for (const item of o.dentago_order_items ?? []) {
          if (item.dentago_suppliers?.name) names.add(item.dentago_suppliers.name);
        }
      }
      setSupplierList(prev => {
        const merged = new Set([...prev, ...names]);
        return Array.from(merged).sort();
      });
    } catch {
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [status, dateFrom, dateTo, search]);

  useEffect(() => {
    if (!getToken()) return;
    fetchOrders(1);
  }, [status, dateFrom, dateTo]);

  function onSearchChange(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchOrders(1, val), 350);
  }

  // Filter by supplier client-side (it's already fetched)
  const displayed = supplier === "all"
    ? orders
    : orders.filter(o => o.dentago_order_items?.some(i => i.dentago_suppliers?.name === supplier));

  // ── Reorder ────────────────────────────────────────────────────────────────
  async function reorder(order: Order) {
    setReordering(order.id);
    try {
      const headers = await freshAuthHeaders();

      // Fetch the full order details via /api/orders/[id] for clean item data
      const detailRes = await fetch(`/api/orders/${order.id}`, { headers });
      if (!detailRes.ok) throw new Error("Could not load order details");
      const detail = await detailRes.json();

      // Add each item to cart
      for (const item of detail.items ?? []) {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            productId:   item.product.id,
            supplierId:  item.supplier.id,
            supplierName: item.supplier.name,
            unitPrice:   item.unitPrice,
            quantity:    item.quantity,
            packSize:    item.packSize,
            sku:         item.sku,
          }),
        });
      }

      setReorderSuccess(order.id);
      setTimeout(() => setReorderSuccess(null), 3000);
    } catch {
      alert("Failed to reorder. Please try again.");
    } finally {
      setReordering(null);
    }
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!getToken()) return (
    <div className="min-h-screen bg-[#f8f7ff] flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-500 mb-4">Sign in to view your order history</p>
        <a href="/onboarding/login.html" className="bg-[#6C3DE8] text-white px-6 py-3 rounded-2xl font-bold text-sm">Sign in</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f7ff] text-[#151121]">

      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-100">
        <div className="flex items-center px-6 h-[60px] max-w-6xl mx-auto gap-3">
          <Link href="/" className="text-lg font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</Link>
          <span className="text-slate-200 text-sm">/</span>
          <span className="text-sm font-semibold text-slate-500">Order History</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/search"
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 hover:border-[#6C3DE8]/30 px-3 py-1.5 rounded-xl transition-all">
              <span className="material-symbols-outlined text-[14px]">search</span>
              Shop
            </Link>
            <ProfileMenu clinic={clinic} />
          </div>
        </div>
      </nav>

      <div className="pt-[60px]">
        {/* ── Header ── */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Order History</h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  {total > 0 ? `${total} order${total !== 1 ? "s" : ""} placed` : "No orders yet"}
                </p>
              </div>
              <Link href="/search"
                className="flex items-center gap-2 bg-gradient-to-r from-[#6C3DE8] to-violet-500 text-white px-4 py-2.5 rounded-2xl font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-[#6C3DE8]/20">
                <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                New Order
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-6">

          {/* ── Filters ── */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(108,61,232,0.05)] p-5 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">

              {/* Search */}
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
                <input
                  value={search}
                  onChange={e => onSearchChange(e.target.value)}
                  placeholder="Search orders…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#6C3DE8]/50 focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
                />
              </div>

              {/* Status */}
              <select
                value={status}
                onChange={e => { setStatus(e.target.value); }}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#6C3DE8]/50 focus:ring-2 focus:ring-[#6C3DE8]/10 bg-white text-slate-700 font-medium transition-all"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s === "all" ? "All statuses" : STATUS_META[s]?.label ?? s}</option>
                ))}
              </select>

              {/* Supplier */}
              {supplierList.length > 0 && (
                <select
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#6C3DE8]/50 focus:ring-2 focus:ring-[#6C3DE8]/10 bg-white text-slate-700 font-medium transition-all"
                >
                  <option value="all">All suppliers</option>
                  {supplierList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}

              {/* Date range */}
              <div className="flex items-center gap-2">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#6C3DE8]/50 focus:ring-2 focus:ring-[#6C3DE8]/10 bg-white text-slate-700 transition-all" />
                <span className="text-slate-300 text-sm">–</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#6C3DE8]/50 focus:ring-2 focus:ring-[#6C3DE8]/10 bg-white text-slate-700 transition-all" />
              </div>

              {/* Clear */}
              {(search || status !== "all" || dateFrom || dateTo || supplier !== "all") && (
                <button
                  onClick={() => { setSearch(""); setStatus("all"); setDateFrom(""); setDateTo(""); setSupplier("all"); fetchOrders(1, ""); }}
                  className="text-xs font-bold text-slate-400 hover:text-red-500 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-all whitespace-nowrap">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Reorder success toast ── */}
          {reorderSuccess && (
            <div className="mb-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-3.5 rounded-2xl text-sm font-semibold">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Items added to cart —{" "}
              <Link href="/cart" className="underline underline-offset-2 font-bold">View cart</Link>
            </div>
          )}

          {/* ── Loading ── */}
          {loading && (
            <div className="space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-24 bg-white rounded-3xl border border-slate-100 animate-pulse" />
              ))}
            </div>
          )}

          {/* ── Error ── */}
          {error && !loading && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-600 px-5 py-4 rounded-2xl text-sm font-semibold">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          {/* ── Empty ── */}
          {!loading && !error && displayed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#6C3DE8]/8 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[30px] text-[#6C3DE8]/50">receipt_long</span>
              </div>
              <h3 className="font-extrabold text-lg mb-2">No orders yet</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-xs">
                {status !== "all" || search || dateFrom || supplier !== "all"
                  ? "No orders match your filters. Try adjusting them."
                  : "Your order history will appear here once you place your first order."}
              </p>
              <Link href="/search"
                className="bg-[#6C3DE8] text-white px-6 py-3 rounded-2xl font-bold text-sm hover:brightness-110 transition-all shadow-md shadow-[#6C3DE8]/20">
                Browse Products
              </Link>
            </div>
          )}

          {/* ── Order list ── */}
          {!loading && !error && displayed.length > 0 && (
            <div className="space-y-3">
              {displayed.map(order => {
                const total = parseFloat(order.total_amount);
                const supplierNames = [...new Set(
                  (order.dentago_order_items ?? []).map(i => i.dentago_suppliers?.name).filter(Boolean)
                )];
                const productNames = (order.dentago_order_items ?? [])
                  .map(i => i.dentago_products?.name)
                  .filter(Boolean);
                const isReordering = reordering === order.id;
                const wasReordered = reorderSuccess === order.id;

                return (
                  <div key={order.id}
                    className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(108,61,232,0.04)] hover:shadow-[0_4px_24px_rgba(108,61,232,0.08)] transition-all overflow-hidden group">

                    <div className="flex items-center gap-4 px-5 py-4">

                      {/* Date column */}
                      <div className="flex-shrink-0 w-[52px] h-[52px] rounded-2xl bg-[#6C3DE8]/5 flex flex-col items-center justify-center border border-[#6C3DE8]/10">
                        <p className="text-[10px] font-black uppercase tracking-wide text-[#6C3DE8]/60">
                          {new Date(order.created_at).toLocaleDateString("en-GB", { month: "short" })}
                        </p>
                        <p className="text-xl font-extrabold text-[#6C3DE8] leading-none">
                          {new Date(order.created_at).getDate()}
                        </p>
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                            {order.id.slice(0, 8).toUpperCase()}
                          </span>
                          <StatusBadge status={order.status} />
                          {supplierNames.map(n => (
                            <span key={n} className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                              {n}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-slate-500 truncate">
                          {productNames.length > 0
                            ? productNames.slice(0, 3).join(", ") + (productNames.length > 3 ? ` +${productNames.length - 3} more` : "")
                            : <span className="text-slate-300 italic">No product details</span>
                          }
                        </p>
                      </div>

                      {/* Total + date */}
                      <div className="text-right flex-shrink-0 hidden sm:block">
                        <p className="text-lg font-extrabold text-[#151121]">{fmtGBP(total)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtDate(order.created_at)}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link href={`/order/${order.id}`}
                          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 hover:border-[#6C3DE8]/30 px-3 py-2 rounded-xl transition-all">
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          <span className="hidden sm:inline">View</span>
                        </Link>
                        <button
                          onClick={() => reorder(order)}
                          disabled={isReordering}
                          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all ${
                            wasReordered
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : "bg-[#6C3DE8]/8 text-[#6C3DE8] hover:bg-[#6C3DE8] hover:text-white border border-[#6C3DE8]/20 hover:border-[#6C3DE8]"
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {isReordering
                            ? <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                            : wasReordered
                            ? <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            : <span className="material-symbols-outlined text-[14px]">replay</span>
                          }
                          <span className="hidden sm:inline">
                            {isReordering ? "Adding…" : wasReordered ? "Added!" : "Reorder"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Mobile total */}
                    <div className="sm:hidden px-5 pb-3 flex items-center justify-between border-t border-slate-50 pt-3">
                      <span className="text-xs text-slate-400">{fmtDate(order.created_at)}</span>
                      <span className="font-extrabold text-[#151121]">{fmtGBP(total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Pagination ── */}
          {pages > 1 && !loading && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => fetchOrders(page - 1)}
                disabled={page === 1}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:border-[#6C3DE8]/40 hover:text-[#6C3DE8] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const p = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i;
                return (
                  <button key={p} onClick={() => fetchOrders(p)}
                    className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                      p === page
                        ? "bg-[#6C3DE8] text-white shadow-md shadow-[#6C3DE8]/25"
                        : "border border-slate-200 text-slate-500 hover:border-[#6C3DE8]/40 hover:text-[#6C3DE8]"
                    }`}>
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => fetchOrders(page + 1)}
                disabled={page === pages}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:border-[#6C3DE8]/40 hover:text-[#6C3DE8] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
