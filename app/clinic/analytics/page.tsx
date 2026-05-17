"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getClinic, freshAuthHeaders } from "@/lib/auth";
import { LockedUntilFirstOrder } from "@/components/LockedUntilFirstOrder";

type SpendBySupplier = { supplier: string; total: number; order_count: number };
type SpendByMonth = { month: string; total: number };
type TopProduct = { name: string; total_spend: number; order_count: number };

type Analytics = {
  total_spend: number;
  spend_by_supplier: SpendBySupplier[];
  spend_by_month: SpendByMonth[];
  savings_vs_list: number;
  savings_pct?: number;
  top_products: TopProduct[];
};

function fmt(n: number) {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BarRow({ label, value, max, count }: { label: string; value: number; max: number; count: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--dc-border)] last:border-0">
      <div className="w-32 text-sm font-semibold text-[var(--dc-text,#0f172a)] truncate flex-shrink-0">{label}</div>
      <div className="flex-1 bg-neutral-200/60 rounded-full h-2 overflow-hidden">
        <div className="h-2 rounded-full bg-[var(--dc-accent,#c3b1e1)]/85 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right flex-shrink-0 w-28">
        <span className="text-sm font-bold text-[var(--dc-text,#0f172a)]">{fmt(value)}</span>
        <span className="text-[11px] text-[var(--dc-muted,#64748b)] ml-1.5">
          {count} order{count !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

function MonthBar({ month, value, max }: { month: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const heightPx = Math.max(4, Math.round((pct / 100) * 80));
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <span className="text-[11px] font-bold text-[var(--dc-text,#0f172a)]">{value > 0 ? fmt(value) : ""}</span>
      <div className="w-full flex items-end justify-center" style={{ height: 80 }}>
        <div
          className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-[var(--dc-accent,#c3b1e1)]/35 to-[var(--dc-accent,#c3b1e1)] transition-all"
          style={{ height: heightPx }}
        />
      </div>
      <span className="text-[10px] text-[var(--dc-muted,#64748b)] text-center leading-tight font-medium">{month}</span>
    </div>
  );
}

const cardClass = "rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)]";

export default function AnalyticsPage() {
  const router = useRouter();
  const _clinic = typeof window !== "undefined" ? getClinic() : null;
  void _clinic;

  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const headers = await freshAuthHeaders();
      const res = await fetch("/api/clinic/analytics", { headers });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = await res.json();
      setData(json);
      setLoading(false);
    })();
  }, [router]);

  const maxSupplierSpend = Math.max(...(data?.spend_by_supplier.map((s) => s.total) ?? [0]), 1);
  const maxMonthSpend = Math.max(...(data?.spend_by_month.map((m) => m.total) ?? [0]), 1);
  const orderCount = data?.spend_by_supplier.reduce((s, r) => s + r.order_count, 0) ?? 0;

  return (
    <LockedUntilFirstOrder
      featureName="Spend analytics"
      featureIcon="bar_chart"
      featureDesc="Track exactly where every pound goes across all your suppliers.">
    <div className="min-h-screen bg-[var(--dc-bg,#eef0f7)] pb-20">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10 space-y-8">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)]">Insights</p>
          <h1 className="clinic-serif text-3xl sm:text-[2.1rem] font-normal tracking-tight text-[var(--dc-text,#0f172a)]">
            Spend <em className="italic text-[var(--dc-accent,#c3b1e1)]">analytics</em>
          </h1>
          <p className="text-sm text-[var(--dc-muted,#64748b)] max-w-2xl leading-relaxed">
            Full procurement spend view — suppliers, trend, and top SKUs. Included on every plan so you always know where money goes.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <div className="w-7 h-7 border-2 border-[var(--dc-accent-strong,#111)] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-[var(--dc-muted,#64748b)]">Loading your analytics…</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`${cardClass} p-5`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--dc-muted,#64748b)]">Total spend</p>
                <p className="clinic-serif text-3xl font-normal text-[var(--dc-text,#0f172a)] mt-2">{fmt(data?.total_spend ?? 0)}</p>
                <p className="text-[11px] text-[var(--dc-muted,#64748b)] mt-1">All time · ex. cancelled</p>
              </div>
              <div className={`${cardClass} p-5`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--dc-muted,#64748b)]">Orders placed</p>
                <p className="clinic-serif text-3xl font-normal text-[var(--dc-text,#0f172a)] mt-2">{orderCount}</p>
                <p className="text-[11px] text-[var(--dc-muted,#64748b)] mt-1">
                  Across {data?.spend_by_supplier.length ?? 0} supplier{(data?.spend_by_supplier.length ?? 0) !== 1 ? "s" : ""}
                </p>
              </div>
              <div className={`${cardClass} p-5 ring-1 ring-[rgba(195,177,225,0.25)]`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--dc-muted,#64748b)]">Savings vs list</p>
                <p className="clinic-serif text-3xl font-normal text-emerald-600 mt-2">{fmt(data?.savings_vs_list ?? 0)}</p>
                <p className="text-[11px] text-[var(--dc-muted,#64748b)] mt-1">
                  {(data?.savings_vs_list ?? 0) > 0 ? (
                    <>
                      vs. market prices
                      {data?.savings_pct ? (
                        <span className="ml-1 font-bold text-emerald-600">({data.savings_pct}% cheaper)</span>
                      ) : null}
                    </>
                  ) : (
                    "Place an order to start tracking"
                  )}
                </p>
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-4">Spend by supplier</h2>
              {(data?.spend_by_supplier.length ?? 0) === 0 ? (
                <p className="text-sm text-[var(--dc-muted,#64748b)] py-10 text-center">No orders yet — connect a supplier and place your first basket.</p>
              ) : (
                <div>
                  {data!.spend_by_supplier.map((row) => (
                    <BarRow key={row.supplier} label={row.supplier} value={row.total} max={maxSupplierSpend} count={row.order_count} />
                  ))}
                </div>
              )}
            </div>

            <div className={cardClass}>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-4">Monthly trend · last 6 months</h2>
              {maxMonthSpend <= 0 ? (
                <p className="text-sm text-[var(--dc-muted,#64748b)] py-10 text-center">No spend data yet</p>
              ) : (
                <div className="flex items-end gap-2 pt-2">
                  {data!.spend_by_month.map((row) => (
                    <MonthBar key={row.month} month={row.month} value={row.total} max={maxMonthSpend} />
                  ))}
                </div>
              )}
            </div>

            <div className={cardClass}>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-4">Top products</h2>
              {(data?.top_products.length ?? 0) === 0 ? (
                <p className="text-sm text-[var(--dc-muted,#64748b)] py-10 text-center">No product data yet</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--dc-border)]">
                  <table className="w-full text-sm min-w-[320px]">
                    <thead>
                      <tr className="bg-[rgba(17,17,17,0.03)] border-b border-[var(--dc-border)]">
                        <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--dc-muted,#64748b)]">Product</th>
                        <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--dc-muted,#64748b)]">Orders</th>
                        <th className="text-right py-3 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--dc-muted,#64748b)]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.top_products.map((p, i) => (
                        <tr key={i} className="border-b border-[var(--dc-border)] last:border-0 hover:bg-black/[0.02] transition-colors">
                          <td className="py-3 px-4 font-medium text-[var(--dc-text,#0f172a)]">{p.name}</td>
                          <td className="py-3 px-4 text-right text-[var(--dc-muted,#64748b)]">{p.order_count}</td>
                          <td className="py-3 px-4 text-right font-bold text-[var(--dc-text,#0f172a)]">{fmt(p.total_spend)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
    </LockedUntilFirstOrder>
  );
}
