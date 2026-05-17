"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getToken, getClinic, freshAuthHeaders, getFreshToken } from "@/lib/auth";

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
  on_hold:    { label: "On hold",    bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
  confirmed:  { label: "Confirmed",  bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  processing: { label: "Processing", bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-500" },
  dispatched: { label: "Dispatched", bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-500" },
  delivered:  { label: "Delivered",  bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled:  { label: "Cancelled",  bg: "bg-red-50",     text: "text-red-500",     dot: "bg-red-400" },
};

const STATUSES = ["all", "pending", "on_hold", "confirmed", "processing", "dispatched", "delivered", "cancelled"];

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
  const [showXeroInfo, setShowXeroInfo] = useState(false);
  /** Session resolved from Supabase + legacy token sync (avoid stuck loading / false “signed out”). */
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

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
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => { setClinic(getClinic()); }, []);

  const fetchOrders = useCallback(async (pg = 1, q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(LIMIT) });
      if (status !== "all") params.set("status", status);
      const searchQ = q !== undefined ? q : searchRef.current;
      if (searchQ) params.set("search", searchQ);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/orders?${params}`, { headers: await freshAuthHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body?.error === "string" ? body.error : `Failed to load orders (${res.status})`);
        return;
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
      setPage(pg);
      setClinic(getClinic());

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
  }, [status, dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await getFreshToken();
      setClinic(getClinic());
      if (cancelled) return;
      const token = getToken();
      setAuthChecked(true);
      setHasSession(!!token);
      if (!token) {
        setLoading(false);
        return;
      }
      await fetchOrders(1);
    })();
    return () => { cancelled = true; };
  }, [fetchOrders]);

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

  // ── Session check / not logged in ──────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--dc-accent-strong)]/25 border-t-[var(--dc-accent-strong)]" />
          <p className="text-sm font-medium text-[var(--dc-muted)]">Loading…</p>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="rounded-2xl border border-[var(--dc-border)] bg-white px-8 py-10 text-center">
          <p className="mb-4 text-sm text-[var(--dc-muted)]">Sign in to view your order history</p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--dc-accent-strong)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-5xl px-6 py-8">

        {/* ── Header ── */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--dc-muted)]">Workspace</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.02em] text-[var(--dc-text)]">Orders</h1>
            <p className="mt-1 text-sm text-[var(--dc-muted)]">
              {total > 0 ? `${total} order${total !== 1 ? "s" : ""} placed` : "No orders yet"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowXeroInfo(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--dc-border)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-elevated)]"
            >
              <span className="material-symbols-outlined text-[16px] text-[var(--dc-muted)]">download</span>
              <span className="hidden sm:inline">Export to Xero</span>
            </button>
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--dc-accent-strong)] px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
              <span>New order</span>
            </Link>
          </div>
        </header>

        {/* ── Xero Export panel ── */}
        {showXeroInfo && (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:flex-row sm:items-start">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100">
              <span className="material-symbols-outlined text-[20px] text-blue-600">receipt_long</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1 text-sm font-semibold text-blue-900">Export orders to Xero</h3>
              <p className="mb-3 text-xs leading-relaxed text-blue-700">
                Download a Xero-compatible CSV and import it via{" "}
                <strong>Accounts Payable → Import</strong> in your Xero account.
                Each order item appears as a purchase invoice line.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/clinic/orders/export?format=csv"
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-700"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Download all orders (CSV)
                </a>
                {dateFrom && dateTo && (
                  <a
                    href={`/api/clinic/orders/export?format=csv&from=${dateFrom}&to=${dateTo}`}
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition-all hover:bg-blue-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">filter_alt</span>
                    Download filtered range
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowXeroInfo(false)}
              className="flex-shrink-0 text-blue-400 transition-colors hover:text-blue-600"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="mb-6 rounded-2xl border border-[var(--dc-border)] bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row">

            {/* Search */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] text-[var(--dc-muted)]">search</span>
              <input
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search orders…"
                className="w-full rounded-lg border border-[var(--dc-border)] bg-white py-2.5 pl-9 pr-4 text-sm text-[var(--dc-text)] transition-all placeholder:text-[var(--dc-muted)] focus:border-[var(--dc-accent-strong)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--dc-accent-strong)]/10"
              />
            </div>

            {/* Status */}
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); }}
              className="rounded-lg border border-[var(--dc-border)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--dc-text)] transition-all focus:border-[var(--dc-accent-strong)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--dc-accent-strong)]/10"
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
                className="rounded-lg border border-[var(--dc-border)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--dc-text)] transition-all focus:border-[var(--dc-accent-strong)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--dc-accent-strong)]/10"
              >
                <option value="all">All suppliers</option>
                {supplierList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}

            {/* Date range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="rounded-lg border border-[var(--dc-border)] bg-white px-3 py-2.5 text-sm text-[var(--dc-text)] transition-all focus:border-[var(--dc-accent-strong)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--dc-accent-strong)]/10"
              />
              <span className="text-sm text-[var(--dc-muted)]">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="rounded-lg border border-[var(--dc-border)] bg-white px-3 py-2.5 text-sm text-[var(--dc-text)] transition-all focus:border-[var(--dc-accent-strong)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--dc-accent-strong)]/10"
              />
            </div>

            {/* Clear */}
            {(search || status !== "all" || dateFrom || dateTo || supplier !== "all") && (
              <button
                onClick={() => { setSearch(""); setStatus("all"); setDateFrom(""); setDateTo(""); setSupplier("all"); fetchOrders(1, ""); }}
                className="whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-semibold text-[var(--dc-muted)] transition-all hover:bg-rose-50 hover:text-rose-500"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Reorder success toast ── */}
        {reorderSuccess && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Items added to cart —{" "}
            <Link href="/cart" className="font-semibold underline underline-offset-2">View cart</Link>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-[var(--dc-border)] bg-white" />
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && displayed.length === 0 && (
          <div className="rounded-2xl border border-[var(--dc-border)] bg-white py-16">
            <div className="mx-auto flex max-w-sm flex-col items-center text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--dc-accent-strong)]/8">
                <span className="material-symbols-outlined text-[28px] text-[var(--dc-accent-strong)]/60">receipt_long</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--dc-text)]">No orders yet</h3>
              <p className="mt-1.5 text-sm text-[var(--dc-muted)]">
                {status !== "all" || search || dateFrom || supplier !== "all"
                  ? "No orders match your filters. Try adjusting them."
                  : "Your order history will appear here once you place your first order."}
              </p>
              <Link
                href="/search"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--dc-accent-strong)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Browse products
              </Link>
            </div>
          </div>
        )}

        {/* ── Order list ── */}
        {!loading && !error && displayed.length > 0 && (
          <div className="space-y-3">
            {displayed.map(order => {
              const orderTotal = parseFloat(order.total_amount);
              const supplierNames = [...new Set(
                (order.dentago_order_items ?? []).map(i => i.dentago_suppliers?.name).filter(Boolean)
              )];
              const productNames = (order.dentago_order_items ?? [])
                .map(i => i.dentago_products?.name)
                .filter(Boolean);
              const isReordering = reordering === order.id;
              const wasReordered = reorderSuccess === order.id;

              return (
                <div
                  key={order.id}
                  className="group overflow-hidden rounded-2xl border border-[var(--dc-border)] bg-white transition-all hover:shadow-[0_4px_16px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-center gap-4 px-5 py-4">

                    {/* Date column */}
                    <div className="flex h-[52px] w-[52px] flex-shrink-0 flex-col items-center justify-center rounded-xl border border-[var(--dc-accent-strong)]/12 bg-[var(--dc-accent-strong)]/6">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--dc-accent-strong)]/70">
                        {new Date(order.created_at).toLocaleDateString("en-GB", { month: "short" })}
                      </p>
                      <p className="text-xl font-bold leading-none text-[var(--dc-accent-strong)]">
                        {new Date(order.created_at).getDate()}
                      </p>
                    </div>

                    {/* Main info */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-[var(--dc-bg)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--dc-muted)]">
                          {order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <StatusBadge status={order.status} />
                        {supplierNames.map(n => (
                          <span
                            key={n}
                            className="rounded-md border border-[var(--dc-border)] bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--dc-muted)]"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                      <p className="truncate text-sm text-[var(--dc-muted)]">
                        {productNames.length > 0
                          ? productNames.slice(0, 3).join(", ") + (productNames.length > 3 ? ` +${productNames.length - 3} more` : "")
                          : <span className="italic text-slate-300">No product details</span>
                        }
                      </p>
                    </div>

                    {/* Total + date */}
                    <div className="hidden flex-shrink-0 text-right sm:block">
                      <p className="text-lg font-bold tracking-[-0.01em] tabular-nums text-[var(--dc-text)]">{fmtGBP(orderTotal)}</p>
                      <p className="mt-0.5 text-xs text-[var(--dc-muted)]">{fmtDate(order.created_at)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Link
                        href={`/order/${order.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-elevated)]"
                      >
                        <span className="material-symbols-outlined text-[14px] text-[var(--dc-muted)]">open_in_new</span>
                        <span className="hidden sm:inline">View</span>
                      </Link>
                      <button
                        onClick={() => reorder(order)}
                        disabled={isReordering}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                          wasReordered
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-600"
                            : "bg-[var(--dc-accent-strong)] text-white hover:brightness-110 active:scale-[0.98]"
                        }`}
                      >
                        {isReordering
                          ? <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
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
                  <div className="flex items-center justify-between border-t border-[var(--dc-border)] px-5 pb-3 pt-3 sm:hidden">
                    <span className="text-xs text-[var(--dc-muted)]">{fmtDate(order.created_at)}</span>
                    <span className="text-base font-bold tabular-nums text-[var(--dc-text)]">{fmtGBP(orderTotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {pages > 1 && !loading && (
          <div className="mt-8 flex items-center justify-center gap-1.5">
            <button
              onClick={() => fetchOrders(page - 1)}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--dc-border)] bg-white text-[var(--dc-muted)] transition-all hover:border-[var(--dc-accent-strong)]/40 hover:text-[var(--dc-accent-strong)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
              const p = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i;
              return (
                <button
                  key={p}
                  onClick={() => fetchOrders(p)}
                  className={`h-9 w-9 rounded-lg text-sm font-semibold transition-all ${
                    p === page
                      ? "bg-[var(--dc-accent-strong)] text-white"
                      : "border border-[var(--dc-border)] bg-white text-[var(--dc-muted)] hover:border-[var(--dc-accent-strong)]/40 hover:text-[var(--dc-accent-strong)]"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => fetchOrders(page + 1)}
              disabled={page === pages}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--dc-border)] bg-white text-[var(--dc-muted)] transition-all hover:border-[var(--dc-accent-strong)]/40 hover:text-[var(--dc-accent-strong)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
