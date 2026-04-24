"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getToken, getClinic, freshAuthHeaders } from "@/lib/auth";
import ProfileMenu from "@/components/ProfileMenu";

type Order = {
  id: string;
  status: string;
  total_amount: string;
  created_at: string;
  dentago_order_items: {
    product_id: number;
    supplier_id: number;
    quantity: number;
    unit_price: number;
    dentago_products?: { name: string; category: string };
    dentago_suppliers?: { name: string };
  }[];
};

type Stats = {
  total: number;
  revenue: number;
  monthCount: number;
  monthRevenue: number;
  avgOrderValue: number;
  byStatus: Record<string, number>;
};

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:    { label: "Pending",    bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  confirmed:  { label: "Confirmed",  bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  processing: { label: "Processing", bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-500" },
  dispatched: { label: "Dispatched", bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-500" },
  delivered:  { label: "Delivered",  bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled:  { label: "Cancelled",  bg: "bg-red-50",     text: "text-red-500",     dot: "bg-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

function MetricCard({ icon, label, value, sub, accent, trend, loading }: {
  icon: string; label: string; value: string; sub?: string;
  accent: string; trend?: { dir: "up" | "down" | "flat"; label: string };
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(108,61,232,0.05)] p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accent}`}>
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[11px] font-bold px-2 py-1 rounded-full ${
            trend.dir === "up" ? "bg-emerald-50 text-emerald-600" :
            trend.dir === "down" ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"
          }`}>
            <span className="material-symbols-outlined text-[12px]">
              {trend.dir === "up" ? "trending_up" : trend.dir === "down" ? "trending_down" : "trending_flat"}
            </span>
            {trend.label}
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-20 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-extrabold tracking-tight text-[#151121]">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{sub}</p>}
        </div>
      )}
      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</p>
    </div>
  );
}

const LOW_STOCK = [
  { name: "Nitrile Exam Gloves (L)", category: "PPE",               stock: 12, threshold: 50,  icon: "back_hand",        urgent: true  },
  { name: "Surgical Face Masks IIR", category: "PPE",               stock: 3,  threshold: 100, icon: "masks",            urgent: true  },
  { name: "Optim 33 Surface Wipes",  category: "Infection Control", stock: 8,  threshold: 24,  icon: "cleaning_services", urgent: false },
];

export default function DashboardPage() {
  const [clinic,       setClinic]       = useState<ReturnType<typeof getClinic>>(null);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [suppliers,    setSuppliers]    = useState<string[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => { setClinic(getClinic()); }, []);

  const load = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    setLoading(true);
    try {
      const headers = await freshAuthHeaders();
      const [statsRes, ordersRes] = await Promise.all([
        fetch("/api/orders?stats=1", { headers }),
        fetch("/api/orders?limit=5&page=1", { headers }),
      ]);
      if (statsRes.ok)  setStats(await statsRes.json());
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        const orders: Order[] = data.orders ?? [];
        setRecentOrders(orders);
        const names = new Set<string>();
        for (const o of orders)
          for (const i of o.dentago_order_items ?? [])
            if (i.dentago_suppliers?.name) names.add(i.dentago_suppliers.name);
        setSuppliers(Array.from(names));
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const estimatedSavings = stats ? stats.revenue * 0.12 : 0;
  const hour    = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const clinicName = clinic?.clinic_name ?? "Your Clinic";

  return (
    <div className="min-h-screen bg-[#f8f7ff] text-[#151121]">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-100">
        <div className="flex items-center px-6 h-[60px] max-w-6xl mx-auto gap-3">
          <Link href="/" className="text-lg font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</Link>
          <span className="text-slate-200 text-sm">/</span>
          <span className="text-sm font-semibold text-slate-500">Dashboard</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/search"
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#6C3DE8] border border-slate-200 hover:border-[#6C3DE8]/30 px-3 py-1.5 rounded-xl transition-all">
              <span className="material-symbols-outlined text-[14px]">search</span>
              <span className="hidden sm:inline">Shop</span>
            </Link>
            <Link href="/cart"
              className="flex items-center gap-1.5 text-sm font-bold text-white bg-[#6C3DE8] hover:brightness-110 px-3 py-1.5 rounded-xl transition-all shadow-md shadow-[#6C3DE8]/20">
              <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
              <span className="hidden sm:inline">Cart</span>
            </Link>
            <ProfileMenu clinic={clinic} />
          </div>
        </div>
      </nav>

      <div className="pt-[60px]">

        {/* Hero */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#6C3DE8]/50 mb-1">{greeting}</p>
              <h1 className="text-2xl font-extrabold tracking-tight">{clinicName}</h1>
              <p className="text-sm text-slate-400 mt-0.5">Your procurement overview</p>
            </div>
            <Link href="/search"
              className="flex items-center gap-2 bg-gradient-to-r from-[#6C3DE8] to-violet-500 text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#6C3DE8]/20">
              <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
              Place Order
            </Link>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon="payments" label="Monthly Spend"
              value={loading ? "—" : fmtGBP(stats?.monthRevenue ?? 0)}
              sub={stats?.avgOrderValue ? `${fmtGBP(stats.avgOrderValue)} avg order` : "No orders this month"}
              accent="bg-[#6C3DE8]/10 text-[#6C3DE8]"
              trend={stats?.monthRevenue ? { dir: "up", label: "This month" } : undefined}
              loading={loading}
            />
            <MetricCard
              icon="receipt_long" label="Orders This Month"
              value={loading ? "—" : String(stats?.monthCount ?? 0)}
              sub={stats?.total ? `${stats.total} all time` : "No orders yet"}
              accent="bg-violet-50 text-violet-500"
              loading={loading}
            />
            <MetricCard
              icon="storefront" label="Suppliers Used"
              value={loading ? "—" : suppliers.length ? String(suppliers.length) : "—"}
              sub={suppliers.length ? suppliers.slice(0,2).join(", ") + (suppliers.length > 2 ? ` +${suppliers.length - 2} more` : "") : "Place an order to connect"}
              accent="bg-indigo-50 text-indigo-500"
              loading={loading}
            />
            <MetricCard
              icon="savings" label="Est. Savings vs Retail"
              value={loading ? "—" : fmtGBP(estimatedSavings)}
              sub="~12% vs list price benchmark"
              accent="bg-emerald-50 text-emerald-500"
              trend={estimatedSavings > 0 ? { dir: "up", label: "Saved" } : undefined}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

            {/* Recent orders */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(108,61,232,0.05)] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Recent Orders</h2>
                <Link href="/orders" className="text-xs font-bold text-[#6C3DE8] hover:underline flex items-center gap-1">
                  View all <span className="material-symbols-outlined text-[13px]">chevron_right</span>
                </Link>
              </div>

              {loading ? (
                <div className="divide-y divide-slate-50">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                        <div className="h-3 w-44 bg-slate-100 rounded animate-pulse" />
                      </div>
                      <div className="h-5 w-14 bg-slate-100 rounded-full animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#6C3DE8]/8 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[22px] text-[#6C3DE8]/30">receipt_long</span>
                  </div>
                  <p className="font-bold text-slate-600 text-sm mb-1">No orders yet</p>
                  <p className="text-xs text-slate-400 mb-4">Your recent orders will appear here</p>
                  <Link href="/search" className="text-xs font-bold text-[#6C3DE8] hover:underline">Browse products →</Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {recentOrders.map(order => {
                    const total    = parseFloat(order.total_amount);
                    const supplier = order.dentago_order_items?.[0]?.dentago_suppliers?.name;
                    const products = order.dentago_order_items?.map(i => i.dentago_products?.name).filter(Boolean) ?? [];
                    return (
                      <Link key={order.id} href={`/order/${order.id}`}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors group">
                        <div className="w-10 h-10 rounded-2xl bg-[#6C3DE8]/5 border border-[#6C3DE8]/10 flex flex-col items-center justify-center flex-shrink-0">
                          <p className="text-[8px] font-black uppercase text-[#6C3DE8]/50 leading-none">
                            {new Date(order.created_at).toLocaleDateString("en-GB", { month: "short" })}
                          </p>
                          <p className="text-sm font-extrabold text-[#6C3DE8] leading-none mt-0.5">
                            {new Date(order.created_at).getDate()}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[11px] font-bold text-slate-400">{order.id.slice(0,8).toUpperCase()}</span>
                            {supplier && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md font-semibold">{supplier}</span>}
                          </div>
                          <p className="text-sm text-slate-500 truncate">
                            {products.length > 0
                              ? products.slice(0,2).join(", ") + (products.length > 2 ? ` +${products.length - 2}` : "")
                              : `${order.dentago_order_items?.length ?? 0} items`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <StatusBadge status={order.status} />
                          <p className="text-sm font-extrabold text-[#151121]">{fmtGBP(total)}</p>
                          <span className="material-symbols-outlined text-[16px] text-slate-200 group-hover:text-[#6C3DE8] transition-colors">chevron_right</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">

              {/* Low stock */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(108,61,232,0.05)] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Low Stock</h2>
                    <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                      {LOW_STOCK.length}
                    </span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-200">Demo</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {LOW_STOCK.map(item => {
                    const pct = Math.round((item.stock / item.threshold) * 100);
                    return (
                      <div key={item.name} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${item.urgent ? "bg-red-50" : "bg-amber-50"}`}>
                              <span className={`material-symbols-outlined text-[13px] ${item.urgent ? "text-red-400" : "text-amber-400"}`}
                                style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#151121] leading-snug">{item.name}</p>
                              <p className="text-[10px] text-slate-400">{item.category}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-extrabold ${item.urgent ? "text-red-500" : "text-amber-500"}`}>{item.stock}</p>
                            <p className="text-[10px] text-slate-300">/ {item.threshold}</p>
                          </div>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.urgent ? "bg-red-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-3 border-t border-slate-100">
                  <Link href="/search" className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#6C3DE8] hover:underline">
                    <span className="material-symbols-outlined text-[13px]">add_shopping_cart</span>
                    Restock now
                  </Link>
                </div>
              </div>

              {/* Quick actions */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_20px_rgba(108,61,232,0.05)] px-5 py-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-3">Quick Actions</h3>
                <div className="space-y-1">
                  {[
                    { href: "/search",  icon: "search",        label: "Browse products",  sub: "Search 10k+ items" },
                    { href: "/orders",  icon: "receipt_long",  label: "Order history",    sub: "View & reorder" },
                    { href: "/cart",    icon: "shopping_cart", label: "View cart",        sub: "Complete your order" },
                  ].map(({ href, icon, label, sub }) => (
                    <Link key={href} href={href}
                      className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#6C3DE8]/5 transition-colors group">
                      <div className="w-8 h-8 rounded-xl bg-[#6C3DE8]/8 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[15px] text-[#6C3DE8]"
                          style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#151121]">{label}</p>
                        <p className="text-[11px] text-slate-400">{sub}</p>
                      </div>
                      <span className="material-symbols-outlined text-[15px] text-slate-200 group-hover:text-[#6C3DE8] transition-colors">chevron_right</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Tip */}
              <div className="bg-gradient-to-br from-[#6C3DE8] to-violet-500 rounded-3xl p-5 text-white shadow-lg shadow-[#6C3DE8]/20">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[18px] text-white/70 flex-shrink-0 mt-0.5"
                    style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Pro tip</p>
                    <p className="text-sm font-semibold text-white leading-relaxed">
                      Use <strong>Reorder</strong> in Order History to restock your most-used items in one click.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
