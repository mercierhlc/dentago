"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockedUntilFirstOrder } from "@/components/LockedUntilFirstOrder";
import { getClinic, freshAuthHeaders } from "@/lib/auth";

type SavingEntry = {
  id: string;
  product_name: string;
  supplier_name: string | null;
  dentago_price: number;
  list_price: number | null;
  saving_amount: number | null;
  saving_pct: number | null;
  quantity: number;
  saved_at: string;
};

type SavingsData = {
  total_saved: number;
  avg_saving_pct: number;
  entries_count: number;
  savings: SavingEntry[];
};

function fmt(n: number) {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}


export default function SavingsPage() {
  const router = useRouter();
  const clinic = typeof window !== "undefined" ? getClinic() : null;

  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const headers = await freshAuthHeaders();
      const res = await fetch("/api/clinic/savings", { headers });
      if (res.status === 401) { router.push("/login"); return; }
      const json = await res.json();
      setData(json);
      setLoading(false);
    })();
  }, [router]);

  return (
    <LockedUntilFirstOrder
      featureName="Savings tracker"
      featureIcon="savings"
      featureDesc="See every pound saved against list price across your suppliers.">
    <div className="min-h-screen bg-[#F8F9FA]">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-black text-[#151121]">Savings History</h1>
          <p className="text-sm text-slate-500 mt-0.5">How much you&apos;ve saved by using Dentago</p>
          <p className="text-xs text-slate-400 mt-2 max-w-2xl">
            Savings history is included on every plan. Dentago Pro (coming) will add deeper automation—think conversational procurement and advanced orchestration—on top of this foundation.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Hero stat */}
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm text-center">
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Total saved with Dentago</p>
              <p className="text-5xl font-black text-[#111111]">
                {fmt(data?.total_saved ?? 0)}
              </p>
              {(data?.total_saved ?? 0) === 0 && (
                <p className="text-sm text-slate-400 mt-3">
                  Connect a supplier and start searching to track your savings
                </p>
              )}
            </div>

            {/* Sub-stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg. below list price</p>
                <p className="text-3xl font-black text-emerald-600 mt-1">
                  {data?.avg_saving_pct ? `${data.avg_saving_pct}%` : "—"}
                </p>
                <p className="text-xs text-slate-400 mt-1">average across tracked products</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Products tracked</p>
                <p className="text-3xl font-black text-[#151121] mt-1">{data?.entries_count ?? 0}</p>
                <p className="text-xs text-slate-400 mt-1">savings entries recorded</p>
              </div>
            </div>

            {/* Savings table */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <h2 className="text-base font-black text-[#151121] mb-4">Recent Savings</h2>

              {(data?.savings.length ?? 0) === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-4xl mb-4">£</div>
                  <p className="text-slate-500 font-semibold">No savings tracked yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Connect a supplier and start searching to track your savings
                  </p>
                  <Link
                    href="/settings?tab=integrations"
                    className="mt-4 inline-block px-4 py-2 rounded-lg bg-[#111111] text-white text-sm font-semibold hover:bg-[#5b2fd4] transition-colors"
                  >
                    Connect a Supplier
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                        <th className="text-left py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Supplier</th>
                        <th className="text-right py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Dentago Price</th>
                        <th className="text-right py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">List Price</th>
                        <th className="text-right py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">You Saved</th>
                        <th className="text-right py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.savings.map(entry => (
                        <tr key={entry.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-2.5 font-medium text-slate-700">{entry.product_name}</td>
                          <td className="py-2.5 text-slate-500">{entry.supplier_name ?? "—"}</td>
                          <td className="py-2.5 text-right text-slate-700">{fmt(entry.dentago_price)}</td>
                          <td className="py-2.5 text-right text-slate-500">{entry.list_price != null ? fmt(entry.list_price) : "—"}</td>
                          <td className="py-2.5 text-right">
                            {entry.saving_amount != null ? (
                              <span className="font-bold text-emerald-600">
                                {fmt(entry.saving_amount)}
                                {entry.saving_pct != null && (
                                  <span className="text-xs font-normal text-emerald-400 ml-1">({entry.saving_pct}%)</span>
                                )}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-2.5 text-right text-slate-400 text-xs">{fmtDate(entry.saved_at)}</td>
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
