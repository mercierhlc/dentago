"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getClinic, freshAuthHeaders, getFreshToken, saveAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffRequest = {
  id: string;
  product_name: string | null;
  quantity: number;
  note: string | null;
  requester_name: string | null;
  status: string;
  created_at: string;
  dentago_products?: { name: string; brand: string; category: string } | null;
};

type ParLevel = {
  id: string;
  product_id: number;
  par_quantity: number;
  reorder_interval_days: number | null;
  last_ordered_at: string | null;
  days_since_order: number | null;
  is_due: boolean;
  product: { name: string; category: string; brand?: string } | null;
};

type Favorite = {
  id: string;
  product_id: number;
  note: string | null;
  dentago_products: { name: string; brand: string; category: string; image_url?: string } | null;
};

type StockAlertRow = {
  id: string;
  product_id: number;
  reason: "never_ordered" | "interval_elapsed";
  days_since_order: number | null;
  reorder_quantity: number | null;
  product: { name: string; brand: string; category: string; sku?: string } | null;
};

type ReorderSuggestionRow = {
  product_id: number;
  typical_days_between: number;
  days_since_last: number;
  urgency: "due" | "soon" | "watch";
  order_count: number;
  product: { name: string; brand: string; category: string; sku?: string } | null;
};

type ClinicPlan = "free" | "pro";

type Budget = {
  monthly_budget: number | null;
  current_month_spend: number;
};

type Analytics = {
  monthRevenue: number;
  monthCount: number;
  total: number;
  avgOrderValue: number;
  estimatedSavings: number;
  connectedSuppliers: number;
  supplierBreakdown: { name: string; spend: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}
function fmtGBPExact(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return fmtDate(iso);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)]">{title}</h2>
      {action && (
        <Link href={action.href} className="text-xs font-semibold text-[var(--dc-accent,#c3b1e1)] hover:underline flex items-center gap-0.5">
          {action.label}
          <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        </Link>
      )}
    </div>
  );
}

function MetricCard({
  icon, label, value, sub, iconBg, loading, children,
}: {
  icon: string; label: string; value: string; sub?: string;
  iconBg: string; loading?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] p-5 flex flex-col gap-3 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)]">{label}</p>
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-6 w-24 bg-neutral-200/70 rounded animate-pulse" />
          <div className="h-3 w-32 bg-neutral-200/70 rounded animate-pulse" />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold tracking-tight clinic-serif text-[var(--dc-text,#0f172a)]">{value}</p>
          {sub && <p className="text-xs text-[var(--dc-muted,#64748b)] mt-0.5">{sub}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function BudgetBar({ spend, budget }: { spend: number; budget: number | null }) {
  if (!budget) return null;
  const pct = Math.min(100, Math.round((spend / budget) * 100));
  const over = spend > budget;
  return (
    <div className="mt-1">
      <div className="flex justify-between text-[10px] text-[var(--dc-muted,#64748b)] mb-1">
        <span>{fmtGBP(spend)} spent</span>
        <span className={over ? "text-red-400 font-semibold" : ""}>{pct}% of {fmtGBP(budget)}</span>
      </div>
      <div className="h-1.5 bg-neutral-200/70 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-400/90" : pct > 80 ? "bg-[var(--dc-warning,#e8b86d)]" : "bg-emerald-400/80"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ icon, title, sub, cta }: { icon: string; title: string; sub: string; cta?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <span className="material-symbols-outlined text-[32px] text-[var(--dc-muted)]/40 mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <p className="text-sm font-semibold text-[var(--dc-muted,#64748b)] mb-1">{title}</p>
      <p className="text-xs text-[var(--dc-muted,#64748b)]/80 mb-3 max-w-[200px]">{sub}</p>
      {cta && <Link href={cta.href} className="text-xs font-semibold text-[var(--dc-accent,#c3b1e1)] hover:underline">{cta.label} →</Link>}
    </div>
  );
}

function RequestCard({ req, onAction }: { req: StaffRequest; onAction: (id: string, status: "approved" | "rejected") => void }) {
  const [acting, setActing] = useState(false);
  const name = req.dentago_products?.name ?? req.product_name ?? "Unknown item";

  async function act(status: "approved" | "rejected") {
    setActing(true);
    onAction(req.id, status);
  }

  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-[var(--dc-border)] last:border-0">
      <div className="w-8 h-8 rounded-xl bg-[rgba(195,177,225,0.12)] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="material-symbols-outlined text-[15px] text-[var(--dc-accent,#c3b1e1)]" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--dc-text,#0f172a)] leading-snug truncate">{name}</p>
        <p className="text-xs text-[var(--dc-muted,#64748b)] mt-0.5">
          Qty {req.quantity}
          {req.requester_name && <> · <span className="font-medium text-[#c9c2d9]">{req.requester_name}</span></>}
          {req.note && <> · <span className="italic text-[var(--dc-muted)]/70">&quot;{req.note}&quot;</span></>}
        </p>
        <p className="text-[10px] text-[var(--dc-muted)]/60 mt-0.5">{timeAgo(req.created_at)}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => act("approved")}
          disabled={acting}
          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 border border-emerald-500/20"
        >
          <span className="material-symbols-outlined text-[13px]">check</span>
          Add to cart
        </button>
        <button
          onClick={() => act("rejected")}
          disabled={acting}
          className="text-[11px] font-semibold text-[var(--dc-muted)] hover:text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

// ─── QR Banner ────────────────────────────────────────────────────────────────

function QRBanner({ clinicId }: { clinicId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    freshAuthHeaders().then(h => {
      fetch("/api/clinic/staff-request-token", { headers: h })
        .then(r => r.ok ? r.json() : null)
        .then(d => d?.token && setToken(d.token))
        .catch(() => {});
    });
  }, [clinicId]);

  const link = token ? `${window.location.origin}/request?token=${token}` : null;

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] p-5 flex items-start gap-4 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
      <div className="w-10 h-10 rounded-xl bg-[rgba(195,177,225,0.12)] flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-[20px] text-[var(--dc-accent,#c3b1e1)]" style={{ fontVariationSettings: "'FILL' 1" }}>qr_code_2</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--dc-text,#0f172a)]">Staff Request Link</p>
        <p className="text-xs text-[var(--dc-muted,#64748b)] mt-0.5">Give your nurses this link — they can submit supply requests from any device without logging in.</p>
        {link ? (
          <div className="flex items-center gap-2 mt-2.5">
            <code className="text-[10px] bg-neutral-100 border border-[var(--dc-border)] px-2.5 py-1 rounded-lg text-[var(--dc-muted)] truncate max-w-[260px]">{link}</code>
            <button onClick={copy} className="flex items-center gap-1 text-[11px] font-semibold text-[var(--dc-accent,#c3b1e1)] hover:underline flex-shrink-0">
              <span className="material-symbols-outlined text-[13px]">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <div className="mt-2 h-6 w-64 bg-neutral-200/70 rounded animate-pulse" />
        )}
      </div>
    </div>
  );
}

// ─── Spend Breakdown ──────────────────────────────────────────────────────────

function SpendBar({ name, spend, max }: { name: string; spend: number; max: number }) {
  const pct = max > 0 ? Math.round((spend / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-[var(--dc-muted,#64748b)] w-28 truncate flex-shrink-0">{name}</p>
      <div className="flex-1 h-1.5 bg-neutral-200/70 rounded-full overflow-hidden">
        <div className="h-full bg-[var(--dc-accent,#c3b1e1)]/70 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs font-semibold text-[var(--dc-text,#0f172a)] w-14 text-right flex-shrink-0">{fmtGBP(spend)}</p>
    </div>
  );
}

function SpendHistogram({ breakdown }: { breakdown: { name: string; spend: number }[] }) {
  const items = breakdown.slice(0, 12);
  if (!items.length) {
    return <p className="text-sm text-[var(--dc-muted,#64748b)] py-6 text-center">Your spend curve appears once you place orders.</p>;
  }
  const max = Math.max(...items.map((i) => i.spend), 1);
  return (
    <div className="flex items-end justify-between gap-1.5 h-36 px-1 pt-2">
      {items.map((s, i) => {
        const h = Math.max(14, Math.round((s.spend / max) * 100));
        return (
          <div key={s.name} className="flex-1 flex flex-col justify-end min-w-0 group">
            <div
              className={`w-full rounded-t-lg transition-all ${i % 2 === 0 ? "bg-[var(--dc-accent,#c3b1e1)]" : "bg-[var(--dc-accent,#c3b1e1)]/45"}`}
              style={{ height: `${h}%` }}
              title={`${s.name}: ${fmtGBP(s.spend)}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function AttentionRow({
  left,
  right,
  rightClassName,
}: {
  left: string;
  right: string;
  rightClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[rgba(195,177,225,0.06)] border border-[var(--dc-border)] px-4 py-3">
      <span className="text-[13px] font-medium text-[var(--dc-text,#0f172a)] truncate">{left}</span>
      <span className={`text-[12px] font-semibold flex-shrink-0 ${rightClassName ?? "text-[var(--dc-muted,#64748b)]"}`}>{right}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [clinic, setClinic] = useState<ReturnType<typeof getClinic>>(null);
  const [plan, setPlan] = useState<ClinicPlan>("free");
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<{ id: string; total_amount: string }[]>([]);
  const [parLevels, setParLevels] = useState<ParLevel[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockAlerts, setStockAlerts] = useState<StockAlertRow[]>([]);
  const [reorderSuggestions, setReorderSuggestions] = useState<ReorderSuggestionRow[]>([]);
  const [dsoChildCount, setDsoChildCount] = useState(0);
  const [parentClinicId, setParentClinicId] = useState<string | null>(null);
  const [procureMsg, setProcureMsg] = useState("");
  const [procureReply, setProcureReply] = useState<string | null>(null);
  const [procureLoading, setProcureLoading] = useState(false);

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const load = useCallback(async () => {
    const token = await getFreshToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setClinic(getClinic());
    try {
      const h = await freshAuthHeaders();
      const res = await fetch("/api/clinic/dashboard-bundle", { headers: h, cache: "no-store" });
      if (!res.ok) {
        setPendingApprovals([]);
        setAnalytics(null);
        setStockAlerts([]);
        setReorderSuggestions([]);
        setDsoChildCount(0);
        setParentClinicId(null);
        return;
      }

      const d = (await res.json()) as {
        clinic: {
          id: string;
          clinic_name: string;
          email: string;
          product_plan?: string;
          parent_clinic_id?: string | null;
        };
        dso?: { child_clinic_count?: number };
        stock_alerts?: StockAlertRow[];
        reorder_suggestions?: ReorderSuggestionRow[];
        requests: StaffRequest[];
        pendingApprovals: { id: string; total_amount: string }[];
        par_levels: ParLevel[];
        favorites: Favorite[];
        budget: Budget;
        stats: {
          monthRevenue: number;
          monthCount: number;
          total: number;
          avgOrderValue: number;
          supplierBreakdown?: { name: string; spend: number }[];
        };
        credentials: unknown[];
      };

      const clinicPayload = {
        id: d.clinic.id,
        clinic_name: d.clinic.clinic_name,
        email: d.clinic.email,
        product_plan: d.clinic.product_plan === "pro" ? ("pro" as const) : ("free" as const),
      };
      saveAuth(token, clinicPayload);
      setClinic(clinicPayload);
      setPlan(clinicPayload.product_plan);
      setRequests(d.requests ?? []);
      setPendingApprovals(d.pendingApprovals ?? []);
      setParLevels(d.par_levels ?? []);
      setFavorites(d.favorites ?? []);
      setBudget(d.budget ?? null);
      setStockAlerts(d.stock_alerts ?? []);
      setReorderSuggestions(d.reorder_suggestions ?? []);
      setDsoChildCount(d.dso?.child_clinic_count ?? 0);
      setParentClinicId(d.clinic.parent_clinic_id ?? null);

      const connectedSuppliers = (d.credentials ?? []).length;
      const sd = d.stats;
      setAnalytics({
        monthRevenue: sd.monthRevenue ?? 0,
        monthCount: sd.monthCount ?? 0,
        total: sd.total ?? 0,
        avgOrderValue: sd.avgOrderValue ?? 0,
        estimatedSavings: (sd.monthRevenue ?? 0) * 0.12,
        connectedSuppliers,
        supplierBreakdown: sd.supplierBreakdown ?? [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRequestAction(id: string, status: "approved" | "rejected") {
    const h = await freshAuthHeaders();
    await fetch("/api/clinic/staff-requests", {
      method: "PATCH",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setRequests(prev => prev.filter(r => r.id !== id));
  }

  // Par-level alerts (due within 14 days)
  const alertItems = parLevels
    .filter(pl => pl.reorder_interval_days != null)
    .map(pl => {
      const interval = pl.reorder_interval_days!;
      const elapsed  = pl.days_since_order ?? 0;
      const daysLeft = interval - elapsed;
      const pct      = Math.min(100, Math.round((elapsed / interval) * 100));
      return { ...pl, daysLeft, pct, overdue: daysLeft <= 0 };
    })
    .filter(pl => pl.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const maxSupplierSpend = Math.max(...(analytics?.supplierBreakdown ?? []).map(s => s.spend), 1);
  const hubSpend = budget?.current_month_spend ?? analytics?.monthRevenue ?? 0;
  const approvalPendingTotal = pendingApprovals.reduce((a, o) => a + parseFloat(String(o.total_amount ?? "0")), 0);
  const firstAlert = alertItems[0];
  const topStock = stockAlerts[0];

  const cardClass = "rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]";

  return (
    <div className="pb-16 px-4 sm:px-6 lg:px-10 pt-6 md:pt-10">
      <div className="max-w-[1200px] mx-auto">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-2">{today}</p>
            <h1 className="clinic-serif text-3xl sm:text-[2.35rem] leading-[1.15] text-[var(--dc-text,#0f172a)] font-normal tracking-tight">
              Today&apos;s procurement{" "}
              <em className="italic text-[var(--dc-accent,#c3b1e1)]">at a glance.</em>
            </h1>
            <p className="mt-3 text-sm text-[var(--dc-muted,#64748b)] max-w-xl leading-relaxed">
              {analytics?.connectedSuppliers ?? 0} supplier account{(analytics?.connectedSuppliers ?? 0) !== 1 ? "s" : ""} connected
              {analytics?.monthCount ? ` · ${analytics.monthCount} order${analytics.monthCount !== 1 ? "s" : ""} this month` : ""}
              {" · "}
              everything routed through one hub.
            </p>
            {!loading && (parentClinicId || dsoChildCount > 0) ? (
              <p className="mt-2 text-[11px] text-[var(--dc-muted,#64748b)]">
                {parentClinicId ? "This site is linked to a hub account. " : ""}
                {dsoChildCount > 0 ? `${dsoChildCount} linked site${dsoChildCount !== 1 ? "s" : ""} on this hub.` : null}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${
                  plan === "pro"
                    ? "text-[var(--dc-accent,#c3b1e1)] border-[rgba(195,177,225,0.25)] bg-[rgba(195,177,225,0.08)]"
                    : "text-[var(--dc-muted,#64748b)] border-[var(--dc-border)] bg-neutral-50"
                }`}
              >
                {plan === "pro" ? "Dentago Pro" : "Free plan"}
              </span>
              {plan === "free" ? (
                <Link
                  href="/upgrade?from=dashboard"
                  className="text-[10px] font-bold uppercase tracking-wide text-[var(--dc-accent,#c3b1e1)] hover:underline"
                >
                  Dentago Pro — deeper automation →
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/clinic/analytics"
              className="flex items-center gap-1.5 text-sm font-semibold text-[var(--dc-text,#0f172a)] border border-[var(--dc-border)] bg-neutral-50 hover:bg-neutral-100 px-4 py-2.5 rounded-xl transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-[var(--dc-accent,#c3b1e1)]">bar_chart</span>
              Analytics
            </Link>
            <Link
              href="/search"
              className="flex items-center gap-1.5 text-sm font-semibold text-[#121019] bg-[var(--dc-accent,#c3b1e1)] hover:brightness-110 px-4 py-2.5 rounded-xl transition-all shadow-[0_8px_24px_rgba(17,17,17,0.22)]"
            >
              <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
              Place order
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] p-6 md:p-7 shadow-[0_8px_30px_rgba(15,23,42,0.07)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-4">Spend · snapshot</p>
            <p className="clinic-serif text-4xl md:text-[2.75rem] text-[var(--dc-text,#0f172a)] font-normal tracking-tight">
              {loading ? "—" : fmtGBP(hubSpend)}
            </p>
            <p className="text-xs text-[var(--dc-muted,#64748b)] mt-1 mb-6">This month · clinic total</p>
            <SpendHistogram breakdown={analytics?.supplierBreakdown ?? []} />
          </div>

          <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] p-6 md:p-7 shadow-[0_8px_30px_rgba(15,23,42,0.07)] flex flex-col min-h-[280px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-4">Needs attention</p>
            <div className="flex flex-col gap-2.5 flex-1 justify-center">
              {loading ? (
                <>
                  <div className="h-12 bg-neutral-200/70 rounded-xl animate-pulse" />
                  <div className="h-12 bg-neutral-200/70 rounded-xl animate-pulse" />
                  <div className="h-12 bg-neutral-200/70 rounded-xl animate-pulse" />
                </>
              ) : (
                <>
                  {topStock ? (
                    <Link href="/clinic/par-levels" className="block">
                      <AttentionRow
                        left={`${topStock.product?.name ?? `Product #${topStock.product_id}`} · ${
                          topStock.reason === "never_ordered" ? "never ordered" : `${topStock.days_since_order ?? 0}d since order`
                        }`}
                        right={`${stockAlerts.length} par alert${stockAlerts.length !== 1 ? "s" : ""}`}
                        rightClassName="text-[var(--dc-warning,#e8b86d)]"
                      />
                    </Link>
                  ) : firstAlert ? (
                    <Link href="/clinic/par-levels" className="block">
                      <AttentionRow
                        left={`${firstAlert.product?.name ?? `Product #${firstAlert.product_id}`} · ${firstAlert.overdue ? "overdue" : `${firstAlert.daysLeft}d left`}`}
                        right="Par alert"
                        rightClassName="text-[var(--dc-warning,#e8b86d)]"
                      />
                    </Link>
                  ) : (
                    <Link href="/clinic/par-levels" className="block">
                      <AttentionRow left="Stock & par levels" right="On track" />
                    </Link>
                  )}

                  <Link href="/clinic/staff-requests" className="block">
                    <AttentionRow
                      left={`${requests.length} staff request${requests.length !== 1 ? "s" : ""}`}
                      right={requests.length ? "Review" : "Clear"}
                      rightClassName={requests.length ? "text-[var(--dc-warning,#e8b86d)]" : undefined}
                    />
                  </Link>

                  <Link href="/approvals" className="block">
                    <AttentionRow
                      left={`${pendingApprovals.length} order${pendingApprovals.length !== 1 ? "s" : ""} · approve`}
                      right={fmtGBP(approvalPendingTotal)}
                      rightClassName={pendingApprovals.length ? "text-[var(--dc-warning,#e8b86d)]" : undefined}
                    />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon="payments"
            label="This Month"
            iconBg="bg-[rgba(195,177,225,0.15)] text-[var(--dc-accent,#c3b1e1)]"
            value={loading ? "—" : fmtGBP(budget?.current_month_spend ?? analytics?.monthRevenue ?? 0)}
            sub={analytics?.monthCount ? `${analytics.monthCount} order${analytics.monthCount !== 1 ? "s" : ""}` : "No orders this month"}
            loading={loading}
          >
            {budget && !loading && <BudgetBar spend={budget.current_month_spend} budget={budget.monthly_budget} />}
          </MetricCard>

          <MetricCard
            icon="trending_down"
            label="Est. Savings"
            iconBg="bg-emerald-500/15 text-emerald-300"
            value={loading ? "—" : fmtGBP(analytics?.estimatedSavings ?? 0)}
            sub="~12% vs list benchmark · tracked on every order"
            loading={loading}
          />

          <MetricCard
            icon="storefront"
            label="Suppliers"
            iconBg="bg-sky-500/15 text-sky-300"
            value={loading ? "—" : String(analytics?.connectedSuppliers ?? 0)}
            sub={analytics?.connectedSuppliers ? "Connected accounts" : "Add your first supplier"}
            loading={loading}
          />

          <MetricCard
            icon="person_raised_hand"
            label="Staff Requests"
            iconBg="bg-[var(--dc-warning,#e8b86d)]/15 text-[var(--dc-warning,#e8b86d)]"
            value={loading ? "—" : String(requests.length)}
            sub={requests.length > 0 ? "Pending your review" : "No pending requests"}
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <div className={cardClass}>
              <SectionHeader title="Staff Requests" action={{ label: "View all", href: "/clinic/staff-requests" }} />
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 bg-neutral-200/70 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <EmptyState
                  icon="person_raised_hand"
                  title="No pending requests"
                  sub="Staff can submit supply requests via your QR link below."
                />
              ) : (
                <div>
                  {requests.slice(0, 5).map((r) => (
                    <RequestCard key={r.id} req={r} onAction={handleRequestAction} />
                  ))}
                  {requests.length > 5 && (
                    <p className="text-xs text-[var(--dc-muted,#64748b)] pt-3 text-center">
                      +{requests.length - 5} more —{" "}
                      <Link href="/clinic/staff-requests" className="text-[var(--dc-accent,#c3b1e1)] font-semibold hover:underline">
                        view all
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className={cardClass}>
              <SectionHeader
                title="Stock Alerts"
                action={{
                  label: "Manage par levels",
                  href: "/clinic/par-levels",
                }}
              />
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-neutral-200/70 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : stockAlerts.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[11px] text-[var(--dc-muted,#64748b)]">
                    Due against your par rules (same logic as email alerts; shown here even during a send cooldown).
                  </p>
                  {stockAlerts.slice(0, 8).map((row) => (
                    <div key={row.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--dc-text,#0f172a)] truncate">
                          {row.product?.name ?? `Product #${row.product_id}`}
                        </p>
                        <p className="text-[11px] text-[var(--dc-muted,#64748b)] mt-0.5">
                          {row.reason === "never_ordered"
                            ? "Never ordered on record"
                            : row.days_since_order != null
                              ? `${row.days_since_order}d since last order`
                              : "Reorder interval elapsed"}
                          {row.reorder_quantity != null ? ` · suggest qty ${row.reorder_quantity}` : ""}
                        </p>
                      </div>
                      <Link
                        href={`/search?q=${encodeURIComponent(row.product?.name ?? "")}`}
                        className="text-[11px] font-semibold text-[var(--dc-accent,#c3b1e1)] hover:underline flex-shrink-0"
                      >
                        Restock
                      </Link>
                    </div>
                  ))}
                </div>
              ) : alertItems.length === 0 ? (
                <EmptyState
                  icon="inventory_2"
                  title={parLevels.length === 0 ? "No par levels set" : "All items on track"}
                  sub={
                    parLevels.length === 0
                      ? "Set reorder thresholds and we'll alert you when stock is running low."
                      : "No reorders due in the next 14 days."
                  }
                  cta={parLevels.length === 0 ? { label: "Set par levels", href: "/clinic/par-levels" } : undefined}
                />
              ) : (
                <div className="space-y-3">
                  {alertItems.slice(0, 6).map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-[var(--dc-text,#0f172a)] truncate">
                            {item.product?.name ?? `Product #${item.product_id}`}
                          </p>
                          <span
                            className={`text-[11px] font-semibold ml-2 flex-shrink-0 ${
                              item.overdue ? "text-red-400" : item.daysLeft <= 3 ? "text-[var(--dc-warning,#e8b86d)]" : "text-[var(--dc-muted,#64748b)]"
                            }`}
                          >
                            {item.overdue ? "Overdue" : `${item.daysLeft}d left`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-neutral-200/70 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.overdue ? "bg-red-400/90" : item.daysLeft <= 3 ? "bg-[var(--dc-warning,#e8b86d)]" : "bg-[var(--dc-muted)]/50"}`}
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                      <Link
                        href={`/search?q=${encodeURIComponent(item.product?.name ?? "")}`}
                        className="text-[11px] font-semibold text-[var(--dc-accent,#c3b1e1)] hover:underline flex-shrink-0"
                      >
                        Restock
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {reorderSuggestions.length > 0 ? (
              <div className={cardClass}>
                <SectionHeader title="Reorder rhythm" action={{ label: "Search", href: "/search" }} />
                <p className="text-[11px] text-[var(--dc-muted,#64748b)] mb-3">
                  From your last 120 days of orders — typical gap between order days vs days since you last bought (heuristic, not a forecast).
                </p>
                <div className="space-y-2">
                  {reorderSuggestions.slice(0, 6).map((r) => (
                    <div key={r.product_id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--dc-border)] px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--dc-text,#0f172a)] truncate">
                          {r.product?.name ?? `Product #${r.product_id}`}
                        </p>
                        <p className="text-[10px] text-[var(--dc-muted,#64748b)]">
                          ~every {r.typical_days_between}d · last {r.days_since_last}d ago · {r.order_count} order days
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase flex-shrink-0 px-2 py-0.5 rounded-full ${
                          r.urgency === "due"
                            ? "bg-red-500/15 text-red-400"
                            : r.urgency === "soon"
                              ? "bg-[var(--dc-warning,#e8b86d)]/15 text-[var(--dc-warning,#e8b86d)]"
                              : "bg-neutral-100 text-[var(--dc-muted,#64748b)]"
                        }`}
                      >
                        {r.urgency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {plan === "pro" ? (
              <div className={cardClass}>
                <SectionHeader title="Procurement assistant" />
                <p className="text-xs text-[var(--dc-muted,#64748b)] mb-3">
                  Ask about restocks, approvals, or spend. Replies use a live snapshot of par alerts, reorder hints, and pending approvals (advice only — no auto-orders).
                </p>
                <textarea
                  value={procureMsg}
                  onChange={(e) => setProcureMsg(e.target.value)}
                  rows={3}
                  placeholder="e.g. What should I reorder this week?"
                  className="w-full text-sm rounded-xl border border-[var(--dc-border)] bg-neutral-50/80 px-3 py-2.5 text-[var(--dc-text,#0f172a)] placeholder:text-[var(--dc-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--dc-accent,#c3b1e1)]/30"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    disabled={procureLoading || !procureMsg.trim()}
                    onClick={async () => {
                      setProcureLoading(true);
                      setProcureReply(null);
                      try {
                        const h = await freshAuthHeaders();
                        const res = await fetch("/api/clinic/procurement-assistant", {
                          method: "POST",
                          headers: { ...h, "Content-Type": "application/json" },
                          body: JSON.stringify({ message: procureMsg.trim() }),
                        });
                        const j = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
                        if (!res.ok) setProcureReply(j.error ?? "Something went wrong.");
                        else setProcureReply(j.reply ?? "");
                      } catch {
                        setProcureReply("Network error.");
                      } finally {
                        setProcureLoading(false);
                      }
                    }}
                    className="text-xs font-semibold text-[#121019] bg-[var(--dc-accent,#c3b1e1)] hover:brightness-110 disabled:opacity-40 px-4 py-2 rounded-xl transition-all"
                  >
                    {procureLoading ? "Thinking…" : "Ask"}
                  </button>
                </div>
                {procureReply ? (
                  <div className="mt-4 text-sm text-[var(--dc-text,#0f172a)] whitespace-pre-wrap leading-relaxed border-t border-[var(--dc-border)] pt-4">
                    {procureReply}
                  </div>
                ) : null}
              </div>
            ) : null}

            {clinic && <QRBanner clinicId={clinic.id} />}
          </div>

          <div className="space-y-6">
            <div className={cardClass}>
              <SectionHeader title="Quick Reorder" action={{ label: "All favourites", href: "/clinic/favorites" }} />
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-neutral-200/70 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : favorites.length === 0 ? (
                <EmptyState
                  icon="favorite"
                  title="No saved products"
                  sub="Save products you order regularly for one-tap reorder."
                  cta={{ label: "Browse products", href: "/search" }}
                />
              ) : (
                <div className="space-y-1">
                  {favorites.slice(0, 6).map((fav) => {
                    const product = fav.dentago_products;
                    if (!product) return null;
                    return (
                      <Link
                        key={fav.id}
                        href={`/search?q=${encodeURIComponent(product.name)}`}
                        className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-neutral-100 transition-colors group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-neutral-200/70 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-[13px] text-[var(--dc-muted)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            inventory_2
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--dc-text,#0f172a)] truncate">{product.name}</p>
                          <p className="text-[10px] text-[var(--dc-muted,#64748b)]">{product.brand}</p>
                        </div>
                        <span className="material-symbols-outlined text-[14px] text-[var(--dc-muted)] group-hover:text-[var(--dc-accent,#c3b1e1)] transition-colors">
                          shopping_cart
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {analytics && analytics.supplierBreakdown.length > 0 ? (
              <div className={cardClass}>
                <SectionHeader
                  title="Spend by Supplier"
                  action={{
                    label: "Full analytics",
                    href: "/clinic/analytics",
                  }}
                />
                <div className="space-y-3">
                  {analytics.supplierBreakdown.slice(0, 5).map((s) => (
                    <SpendBar key={s.name} name={s.name} spend={s.spend} max={maxSupplierSpend} />
                  ))}
                </div>
              </div>
            ) : null}

            <BudgetCard budget={budget} loading={loading} onUpdate={(b) => setBudget((prev) => (prev ? { ...prev, monthly_budget: b } : prev))} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Budget Card (inline edit) ────────────────────────────────────────────────

function BudgetCard({ budget, loading, onUpdate }: {
  budget: Budget | null;
  loading: boolean;
  onUpdate: (b: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const h = await freshAuthHeaders();
    const monthly_budget = val === "" ? null : parseFloat(val);
    const res = await fetch("/api/clinic/budget", {
      method: "PUT",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ monthly_budget }),
    });
    if (res.ok) {
      onUpdate(monthly_budget);
      setEditing(false);
    }
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)]">Monthly Budget</h2>
        {!editing && (
          <button
            onClick={() => {
              setVal(String(budget?.monthly_budget ?? ""));
              setEditing(true);
            }}
            className="text-xs font-semibold text-[var(--dc-accent,#c3b1e1)] hover:underline"
          >
            {budget?.monthly_budget ? "Edit" : "Set budget"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-12 bg-neutral-200/70 rounded-xl animate-pulse" />
      ) : editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dc-muted)] text-sm">£</span>
            <input
              type="number"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="e.g. 2000"
              className="w-full pl-7 pr-3 py-2 text-sm bg-neutral-50 border border-[var(--dc-border)] rounded-xl text-[var(--dc-text,#0f172a)] placeholder:text-[var(--dc-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--dc-accent)]/35"
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-2 text-sm font-semibold bg-[var(--dc-accent,#c3b1e1)] text-[#121019] rounded-xl hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {saving ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="px-2.5 py-2 text-sm text-[var(--dc-muted)] hover:text-[var(--dc-text)] rounded-xl">
            Cancel
          </button>
        </div>
      ) : budget?.monthly_budget ? (
        <div>
          <p className="text-2xl font-bold clinic-serif text-[var(--dc-text,#0f172a)]">
            {fmtGBPExact(budget.monthly_budget)}
            <span className="text-sm font-normal text-[var(--dc-muted,#64748b)] ml-1">/mo</span>
          </p>
          <BudgetBar spend={budget.current_month_spend} budget={budget.monthly_budget} />
        </div>
      ) : (
        <p className="text-sm text-[var(--dc-muted,#64748b)]">No budget set. Set a monthly limit to track overspend.</p>
      )}
    </div>
  );
}
