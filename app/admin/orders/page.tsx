"use client";
import { useState, useEffect, useCallback } from "react";

const ADMIN_KEY = "dentago-admin-2024";

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

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:    { label: "Pending",    bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  confirmed:  { label: "Confirmed",  bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400" },
  processing: { label: "Processing", bg: "bg-purple-50",  text: "text-purple-700",  dot: "bg-purple-400" },
  dispatched: { label: "Dispatched", bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-400" },
  delivered:  { label: "Delivered",  bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled:  { label: "Cancelled",  bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-400" },
};

const ALL_STATUSES = ["pending", "confirmed", "processing", "dispatched", "delivered", "cancelled"];

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminOrdersPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?key=${ADMIN_KEY}&page=${p}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.pages ?? 1);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (authed) fetchOrders(page);
  }, [authed, page, fetchOrders]);

  function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_KEY) {
      setAuthed(true);
    } else {
      setAuthError("Incorrect password.");
    }
  }

  async function updateStatus(orderId: string, status: string) {
    setUpdating(orderId);
    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
        body: JSON.stringify({ orderId, status }),
      });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    } finally {
      setUpdating(null);
    }
  }

  const filtered = statusFilter === "all" ? orders : orders.filter(o => o.status === statusFilter);

  const stats = {
    total,
    pending: orders.filter(o => o.status === "pending").length,
    revenue: orders.reduce((sum, o) => sum + parseFloat(String(o.total_amount)), 0),
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 w-full max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#6C3DE8]/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[24px] text-[#6C3DE8]" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
          </div>
          <h1 className="text-xl font-extrabold text-[#151121] mb-1">Admin Panel</h1>
          <p className="text-sm text-slate-400 mb-6">Enter the admin password to continue</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-[#6C3DE8] focus:ring-2 focus:ring-[#6C3DE8]/10 transition-all"
            />
            {authError && <p className="text-xs text-red-500 font-medium">{authError}</p>}
            <button type="submit" className="w-full bg-[#6C3DE8] text-white py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121]">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 px-4 h-14 max-w-7xl mx-auto">
          <span className="text-xl font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</span>
          <span className="text-slate-300 font-light">/</span>
          <span className="text-sm font-bold text-slate-600">Orders Admin</span>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => fetchOrders(page)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 bg-white px-3 py-2 rounded-xl transition-all"
            >
              <span className="material-symbols-outlined text-[15px]">refresh</span>
              Refresh
            </button>
            <button
              onClick={() => setAuthed(false)}
              className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-14 max-w-7xl mx-auto px-4 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Orders", value: stats.total, icon: "receipt_long", color: "#6C3DE8" },
            { label: "Pending Review", value: stats.pending, icon: "pending_actions", color: "#f59e0b" },
            { label: "Total Revenue", value: `£${stats.revenue.toFixed(2)}`, icon: "payments", color: "#10b981" },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
              <div className="flex items-center gap-3 mb-1">
                <span className="material-symbols-outlined text-[20px]" style={{ color: stat.color, fontVariationSettings: "'FILL' 1" }}>{stat.icon}</span>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              </div>
              <p className="text-2xl font-extrabold text-[#151121]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600">
            <span className="material-symbols-outlined text-[14px] text-slate-400">filter_list</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent outline-none cursor-pointer font-bold text-slate-700 text-xs"
            >
              <option value="all">All Statuses</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_STYLES[s]?.label ?? s}</option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-500 ml-2">
            <span className="font-bold text-[#151121]">{filtered.length}</span> order{filtered.length !== 1 ? "s" : ""}
            {loading && <span className="text-slate-300 animate-pulse ml-2">Loading…</span>}
          </p>
        </div>

        {/* Orders table */}
        {filtered.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <span className="material-symbols-outlined text-[56px] text-slate-300 mb-4">inbox</span>
            <h2 className="text-xl font-extrabold text-[#151121] mb-2">No orders yet</h2>
            <p className="text-slate-400 text-sm">Orders placed by clinics will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const isExpanded = expandedId === order.id;
              const s = STATUS_STYLES[order.status] ?? STATUS_STYLES.pending;
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Order header */}
                  <div
                    className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  >
                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${s.dot}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#151121] text-sm">{order.clinic_name}</h3>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mb-1">{order.id}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {order.clinic_email && <span>{order.clinic_email}</span>}
                        <span>{order.dentago_order_items.length} item{order.dentago_order_items.length !== 1 ? "s" : ""}</span>
                        <span>{formatDate(order.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className="text-lg font-extrabold text-[#151121]">£{parseFloat(String(order.total_amount)).toFixed(2)}</p>
                      <span className="material-symbols-outlined text-[16px] text-slate-400 mt-1 block">
                        {isExpanded ? "expand_less" : "expand_more"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {/* Items table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="text-left px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Product</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier</th>
                              <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">SKU</th>
                              <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Qty</th>
                              <th className="text-right px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {order.dentago_order_items.map(item => (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3">
                                  <p className="font-semibold text-[#151121] text-xs">{item.dentago_products?.name ?? `Product #${item.id}`}</p>
                                  <p className="text-[10px] text-slate-400">{item.dentago_products?.brand}</p>
                                </td>
                                <td className="px-3 py-3 text-xs text-slate-600 font-medium">{item.dentago_suppliers?.name ?? "—"}</td>
                                <td className="px-3 py-3 text-[10px] font-mono text-slate-400">{item.sku}</td>
                                <td className="px-3 py-3 text-xs font-bold text-right text-slate-700">{item.quantity}</td>
                                <td className="px-5 py-3 text-xs font-extrabold text-right text-[#6C3DE8]">£{parseFloat(String(item.unit_price)).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer: notes + status update */}
                      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                        <div className="flex-1 min-w-0">
                          {order.notes ? (
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notes</p>
                              <p className="text-xs text-slate-600">{order.notes}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-300 italic">No notes</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Update Status</p>
                          <select
                            value={order.status}
                            disabled={updating === order.id}
                            onChange={e => updateStatus(order.id, e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 bg-white outline-none focus:border-[#6C3DE8] transition-all cursor-pointer disabled:opacity-50"
                          >
                            {ALL_STATUSES.map(s => (
                              <option key={s} value={s}>{STATUS_STYLES[s]?.label ?? s}</option>
                            ))}
                          </select>
                          {updating === order.id && (
                            <svg className="animate-spin w-4 h-4 text-[#6C3DE8]" fill="none" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-[#6C3DE8]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="text-sm font-bold text-slate-600 px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
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
