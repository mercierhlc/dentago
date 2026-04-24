"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

const ADMIN_KEY = "dentago-admin-2024";

// ── Types ──────────────────────────────────────────────────────────────────────
type OrderItem = {
  id: number;
  sku: string;
  quantity: number;
  unit_price: number;
  pack_size?: string;
  dentago_products?: { id: number; name: string; brand: string; category: string };
  dentago_suppliers?: { id: number; name: string };
};

type Order = {
  id: string;
  clinic_name: string;
  clinic_email?: string;
  status: string;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  dentago_order_items: OrderItem[];
};

type Stats = {
  total: number;
  revenue: number;
  monthCount: number;
  monthRevenue: number;
  avgOrderValue: number;
  byStatus: Record<string, number>;
};

// ── Constants ──────────────────────────────────────────────────────────────────
const ALL_STATUSES = ["pending", "confirmed", "processing", "dispatched", "delivered", "cancelled"];

const STATUS_META: Record<string, { label: string; bg: string; text: string; border: string; dot: string; icon: string }> = {
  pending:    { label: "Pending",    bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",  dot: "bg-amber-400",   icon: "schedule" },
  confirmed:  { label: "Confirmed",  bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",   dot: "bg-blue-500",    icon: "check_circle" },
  processing: { label: "Processing", bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200", dot: "bg-violet-500",  icon: "autorenew" },
  dispatched: { label: "Dispatched", bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200", dot: "bg-indigo-500",  icon: "local_shipping" },
  delivered:  { label: "Delivered",  bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200",dot: "bg-emerald-500", icon: "inventory" },
  cancelled:  { label: "Cancelled",  bg: "bg-red-50",     text: "text-red-600",     border: "border-red-200",    dot: "bg-red-400",     icon: "cancel" },
};

const STATUS_PIPELINE = ["pending", "confirmed", "processing", "dispatched", "delivered"];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtGBP(n: number | string) {
  return "£" + parseFloat(String(n)).toFixed(2);
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400", icon: "circle" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${m.bg} ${m.text} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function StatusPipeline({ status }: { status: string }) {
  const activeIdx = STATUS_PIPELINE.indexOf(status);
  const isCancelled = status === "cancelled";
  return (
    <div className="flex items-center gap-0 w-full">
      {STATUS_PIPELINE.map((s, i) => {
        const done    = !isCancelled && i <= activeIdx;
        const current = !isCancelled && i === activeIdx;
        const m = STATUS_META[s];
        return (
          <div key={s} className="flex items-center flex-1 min-w-0">
            <div className={`flex flex-col items-center flex-shrink-0 ${current ? "scale-110" : ""} transition-transform`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white transition-all ${
                done ? (current ? "bg-[#6C3DE8] shadow-lg shadow-[#6C3DE8]/30" : "bg-emerald-500") : "bg-slate-200"
              }`}>
                <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {done && !current ? "check" : m.icon}
                </span>
              </div>
              <p className={`text-[9px] font-bold mt-1 whitespace-nowrap ${done ? (current ? "text-[#6C3DE8]" : "text-emerald-600") : "text-slate-300"}`}>
                {m.label}
              </p>
            </div>
            {i < STATUS_PIPELINE.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 rounded transition-all ${i < activeIdx && !isCancelled ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
      {isCancelled && (
        <div className="flex items-center gap-1.5 ml-3 px-2.5 py-1 bg-red-50 border border-red-200 rounded-full">
          <span className="material-symbols-outlined text-[13px] text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
          <span className="text-[10px] font-bold text-red-600">Cancelled</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
          <span className="material-symbols-outlined text-[15px]" style={{ color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-tight">{label}</p>
      </div>
      <p className="text-xl font-extrabold text-[#151121] tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{sub}</p>}
    </div>
  );
}

// ── Order row ──────────────────────────────────────────────────────────────────
function OrderRow({ order, onStatusChange }: {
  order: Order;
  onStatusChange: (id: string, status: string, notify: boolean) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [notifyOnUpdate, setNotifyOnUpdate] = useState(true);

  // Group items by supplier
  const bySupplier: Record<string, OrderItem[]> = {};
  for (const item of order.dentago_order_items) {
    const key = item.dentago_suppliers?.name ?? "Unknown Supplier";
    if (!bySupplier[key]) bySupplier[key] = [];
    bySupplier[key].push(item);
  }

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    await onStatusChange(order.id, newStatus, notifyOnUpdate);
    setUpdating(false);
  }

  function copyId() {
    navigator.clipboard.writeText(order.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportOrderCSV() {
    const rows = [
      ["Order ID", "Clinic", "Email", "Status", "Total", "Date"],
      [order.id, order.clinic_name, order.clinic_email ?? "", order.status, fmtGBP(order.total_amount), fmtDate(order.created_at)],
      [],
      ["Product", "Brand", "Supplier", "SKU", "Pack Size", "Qty", "Unit Price", "Line Total"],
      ...order.dentago_order_items.map(i => [
        i.dentago_products?.name ?? "",
        i.dentago_products?.brand ?? "",
        i.dentago_suppliers?.name ?? "",
        i.sku ?? "",
        i.pack_size ?? "",
        String(i.quantity),
        fmtGBP(i.unit_price),
        fmtGBP(parseFloat(String(i.unit_price)) * i.quantity),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `order-${order.id.slice(0, 8)}.csv`;
    a.click();
  }

  const m = STATUS_META[order.status] ?? STATUS_META.pending;
  const itemCount = order.dentago_order_items.length;
  const supplierCount = Object.keys(bySupplier).length;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 ${expanded ? "border-[#6C3DE8]/20 shadow-[0_4px_24px_rgba(108,61,232,0.07)]" : "border-slate-100 hover:border-slate-200"}`}>

      {/* ── Header row ── */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Status indicator */}
        <div className={`w-1 h-12 rounded-full flex-shrink-0 ${m.dot}`} />

        {/* Clinic info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-bold text-[#151121]">{order.clinic_name}</span>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {order.clinic_email && (
              <a href={`mailto:${order.clinic_email}`} onClick={e => e.stopPropagation()}
                className="hover:text-[#6C3DE8] transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">mail</span>
                {order.clinic_email}
              </a>
            )}
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">inventory_2</span>
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">store</span>
              {supplierCount} supplier{supplierCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              {fmtDate(order.created_at)}
            </span>
          </div>
        </div>

        {/* Amount + expand */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-xl font-extrabold text-[#151121] tracking-tight">{fmtGBP(order.total_amount)}</p>
            <button
              onClick={e => { e.stopPropagation(); copyId(); }}
              className="text-[10px] font-mono text-slate-400 hover:text-[#6C3DE8] transition-colors flex items-center gap-0.5 ml-auto"
            >
              <span className="material-symbols-outlined text-[10px]">{copied ? "check" : "content_copy"}</span>
              {order.id.slice(0, 8).toUpperCase()}
            </button>
          </div>
          <span className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
            expand_more
          </span>
        </div>
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="border-t border-slate-100">

          {/* Status pipeline */}
          <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-100">
            <StatusPipeline status={order.status} />
          </div>

          {/* Items grouped by supplier */}
          <div className="divide-y divide-slate-50">
            {Object.entries(bySupplier).map(([supplierName, items]) => {
              const supplierSubtotal = items.reduce((s, i) => s + parseFloat(String(i.unit_price)) * i.quantity, 0);
              return (
                <div key={supplierName}>
                  {/* Supplier sub-header */}
                  <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50/80">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#6C3DE8] text-white flex items-center justify-center text-[10px] font-black">
                        {supplierName[0]}
                      </div>
                      <span className="text-xs font-bold text-slate-700">{supplierName}</span>
                      <span className="text-[10px] text-slate-400">· {items.length} item{items.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-xs font-extrabold text-[#6C3DE8]">{fmtGBP(supplierSubtotal)}</span>
                  </div>

                  {/* Items table */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-50">
                        <th className="text-left px-5 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Product</th>
                        <th className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">SKU</th>
                        <th className="text-left px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hidden md:table-cell">Pack Size</th>
                        <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Qty</th>
                        <th className="text-right px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Unit</th>
                        <th className="text-right px-5 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-semibold text-[#151121] text-xs leading-snug">{item.dentago_products?.name ?? `Item #${item.id}`}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{item.dentago_products?.brand} · {item.dentago_products?.category}</p>
                          </td>
                          <td className="px-3 py-3 text-[10px] font-mono text-slate-400 hidden sm:table-cell">{item.sku || "—"}</td>
                          <td className="px-3 py-3 text-xs text-slate-500 hidden md:table-cell">{item.pack_size || "—"}</td>
                          <td className="px-3 py-3 text-xs font-bold text-right text-slate-700">{item.quantity}</td>
                          <td className="px-3 py-3 text-xs font-semibold text-right text-slate-600">{fmtGBP(item.unit_price)}</td>
                          <td className="px-5 py-3 text-xs font-extrabold text-right text-[#6C3DE8]">
                            {fmtGBP(parseFloat(String(item.unit_price)) * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Footer: total + actions */}
          <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-5">

              {/* Notes */}
              <div className="flex-1 min-w-0">
                {order.notes ? (
                  <>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Notes</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{order.notes}</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-300 italic">No notes</p>
                )}

                {/* Full order total */}
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-200">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Order Total</span>
                  <span className="text-xl font-extrabold text-[#151121]">{fmtGBP(order.total_amount)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 flex-shrink-0 min-w-[220px]">

                {/* Status update */}
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Update Status</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={order.status}
                      disabled={updating}
                      onChange={e => handleStatusChange(e.target.value)}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-white outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                      ))}
                    </select>
                    {updating && (
                      <svg className="animate-spin w-4 h-4 text-[#6C3DE8] flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15"/>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Notify clinic toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setNotifyOnUpdate(n => !n)}
                    className={`relative w-8 h-4 rounded-full transition-colors ${notifyOnUpdate ? "bg-[#6C3DE8]" : "bg-slate-200"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${notifyOnUpdate ? "translate-x-4" : ""}`} />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">Email clinic on status change</span>
                </label>

                {/* Quick actions */}
                <div className="flex items-center gap-2 pt-1">
                  {order.clinic_email && (
                    <a
                      href={`mailto:${order.clinic_email}?subject=Re: Your Dentago Order ${order.id.slice(0,8).toUpperCase()}`}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 hover:border-[#6C3DE8]/30 bg-white px-3 py-2 rounded-xl transition-all"
                    >
                      <span className="material-symbols-outlined text-[13px]">mail</span>
                      Email Clinic
                    </a>
                  )}
                  <button
                    onClick={exportOrderCSV}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 hover:border-[#6C3DE8]/30 bg-white px-3 py-2 rounded-xl transition-all"
                  >
                    <span className="material-symbols-outlined text-[13px]">download</span>
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdminOrdersPage() {
  // Auth
  const [authed,    setAuthed]    = useState(false);
  const [password,  setPassword]  = useState("");
  const [authError, setAuthError] = useState("");

  // Data
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search,       setSearch]       = useState("");
  const [searchInput,  setSearchInput]  = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const res = await fetch(`/api/orders?key=${ADMIN_KEY}&stats=1`);
    if (res.ok) setStats(await res.json());
  }, []);

  const fetchOrders = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({
      key: ADMIN_KEY,
      page: String(p),
      limit: "25",
      ...(statusFilter !== "all" && { status: statusFilter }),
      ...(search && { search }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    });
    try {
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    if (authed) {
      fetchStats();
      fetchOrders(1);
      setPage(1);
    }
  }, [authed, statusFilter, search, dateFrom, dateTo, fetchStats, fetchOrders]);

  useEffect(() => {
    if (authed) fetchOrders(page);
  }, [page]); // eslint-disable-line

  // Debounced search
  function handleSearchInput(val: string) {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(val), 350);
  }

  async function handleStatusChange(orderId: string, status: string, notify: boolean) {
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
      body: JSON.stringify({ orderId, status, notifyClinic: notify }),
    });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    fetchStats();
  }

  function exportAllCSV() {
    const rows = [
      ["Order ID", "Clinic", "Email", "Status", "Items", "Total", "Created"],
      ...orders.map(o => [
        o.id,
        o.clinic_name,
        o.clinic_email ?? "",
        o.status,
        String(o.dentago_order_items.length),
        fmtGBP(o.total_amount),
        fmtDate(o.created_at),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dentago-orders-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.08)] border border-slate-100 p-10 w-full max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#6C3DE8]/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[24px] text-[#6C3DE8]" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#151121] mb-1 tracking-tight">Orders Admin</h1>
          <p className="text-sm text-slate-400 mb-7">Enter the admin password to continue.</p>
          <form onSubmit={e => { e.preventDefault(); password === ADMIN_KEY ? setAuthed(true) : setAuthError("Incorrect password."); }} className="space-y-4">
            <input
              type="password" autoFocus value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
            />
            {authError && <p className="text-xs text-red-500 font-semibold">{authError}</p>}
            <button type="submit" className="w-full bg-[#6C3DE8] text-white py-3.5 rounded-2xl font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#6C3DE8]/25">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121]">

      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3 px-6 h-14 max-w-7xl mx-auto">
          <span className="text-xl font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</span>
          <span className="text-slate-300">/</span>
          <Link href="/admin" className="text-sm font-semibold text-slate-400 hover:text-slate-700 transition-colors">Admin</Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-bold text-slate-700">Orders</span>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin" className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 bg-white px-3 py-2 rounded-xl transition-all">
              <span className="material-symbols-outlined text-[14px]">people</span>
              Clinics
            </Link>
            <button
              onClick={() => { fetchStats(); fetchOrders(page); }}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 bg-white px-3 py-2 rounded-xl transition-all"
            >
              <span className={`material-symbols-outlined text-[14px] ${loading ? "animate-spin" : ""}`}>refresh</span>
              Refresh
            </button>
            <button
              onClick={exportAllCSV}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 bg-white px-3 py-2 rounded-xl transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              Export CSV
            </button>
            <button
              onClick={() => setAuthed(false)}
              className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-2"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-24 max-w-7xl mx-auto px-6 pb-10">

        {/* ── Stats ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
            <StatCard icon="receipt_long"    label="Total Orders"   value={String(stats.total)}               color="#6C3DE8" />
            <StatCard icon="schedule"        label="Pending"        value={String(stats.byStatus.pending ?? 0)} sub="Awaiting action" color="#f59e0b" />
            <StatCard icon="autorenew"       label="Processing"     value={String((stats.byStatus.confirmed ?? 0) + (stats.byStatus.processing ?? 0))} sub="In progress" color="#8b5cf6" />
            <StatCard icon="local_shipping"  label="Dispatched"     value={String(stats.byStatus.dispatched ?? 0)} sub="On the way" color="#6366f1" />
            <StatCard icon="payments"        label="Total Revenue"  value={fmtGBP(stats.revenue)}             sub={`${fmtGBP(stats.monthRevenue)} this month`} color="#10b981" />
            <StatCard icon="trending_up"     label="Avg Order"      value={fmtGBP(stats.avgOrderValue)}       sub={`${stats.monthCount} orders this month`} color="#0ea5e9" />
          </div>
        )}

        {/* ── Status tab bar ── */}
        <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {["all", ...ALL_STATUSES].map(s => {
            const m = STATUS_META[s];
            const count = s === "all" ? total : (stats?.byStatus[s] ?? 0);
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? "bg-[#6C3DE8] text-white shadow-md shadow-[#6C3DE8]/25"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {m && <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>{m.icon}</span>}
                {m ? m.label : "All"}
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Search + date filters ── */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 flex-1 min-w-[200px] max-w-sm focus-within:border-[#6C3DE8] focus-within:ring-2 focus-within:ring-[#6C3DE8]/10 transition-all">
            <span className="material-symbols-outlined text-[16px] text-slate-400">search</span>
            <input
              type="text" value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder="Search clinic, email, order ID…"
              className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder-slate-400 font-medium"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(""); setSearch(""); }}
                className="text-slate-300 hover:text-slate-500 transition-colors">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 focus-within:border-[#6C3DE8] transition-all">
              <span className="material-symbols-outlined text-[14px] text-slate-400">calendar_today</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-transparent outline-none text-xs text-slate-700 cursor-pointer" />
            </div>
            <span className="text-slate-400 text-xs font-bold">→</span>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 focus-within:border-[#6C3DE8] transition-all">
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-transparent outline-none text-xs text-slate-700 cursor-pointer" />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">close</span>
                Clear
              </button>
            )}
          </div>

          {/* Result count */}
          <p className="text-sm text-slate-500 ml-auto">
            <span className="font-bold text-[#151121]">{total.toLocaleString()}</span> order{total !== 1 ? "s" : ""}
            {loading && <span className="ml-2 text-[#6C3DE8] animate-pulse text-xs">Loading…</span>}
          </p>
        </div>

        {/* ── Orders list ── */}
        {!loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[44px] text-slate-300">receipt_long</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#151121] mb-2">No orders found</h2>
            <p className="text-sm text-slate-400">
              {search || statusFilter !== "all" || dateFrom || dateTo
                ? "Try adjusting your filters."
                : "Orders placed by clinics will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {loading && orders.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 h-20 shimmer" style={{ animationDelay: `${i * 60}ms` }} />
                ))
              : orders.map(order => (
                  <OrderRow key={order.id} order={order} onStatusChange={handleStatusChange} />
                ))
            }
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-[#6C3DE8]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
              return (
                <button
                  key={p} onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-xl border text-sm font-bold transition-all ${
                    p === page
                      ? "bg-[#6C3DE8] text-white border-[#6C3DE8] shadow-md shadow-[#6C3DE8]/25"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#6C3DE8]/40"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-[#6C3DE8]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
