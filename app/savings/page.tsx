"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getClinic, freshAuthHeaders, getFreshToken } from "@/lib/auth";
import ProfileMenu from "@/components/ProfileMenu";

type SavingsRow = {
  productId: number;
  name: string;
  brand: string;
  totalUnits: number;
  pricePaid: number;       // weighted avg unit price paid
  marketHigh: number;      // highest supplier price (connected suppliers if connected, else all)
  totalSaving: number;     // (marketHigh - pricePaid) * totalUnits
};

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);
}

export default function SavingsPage() {
  const [clinic, setClinic] = useState<ReturnType<typeof getClinic>>(null);
  const [rows, setRows] = useState<SavingsRow[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [annualSaved, setAnnualSaved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false); // has ≥1 connected supplier
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => { setClinic(getClinic()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getFreshToken();
    setClinic(getClinic());
    setAuthChecked(true);
    setHasSession(!!token);
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch all orders
      const res = await fetch("/api/orders?limit=500", { headers: await freshAuthHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
      }
      const data = await res.json();
      const orders: any[] = data.orders ?? data ?? [];

      // 2. Aggregate units + spend per productId
      const agg: Record<number, { name: string; brand: string; totalSpend: number; totalUnits: number; lastPrice: number }> = {};

      for (const order of orders) {
        for (const item of (order.dentago_order_items ?? [])) {
          const pid: number = item.product_id ?? item.dentago_products?.id;
          if (!pid) continue;
          const qty: number = item.quantity ?? 1;
          const price: number = parseFloat(item.unit_price) || 0;
          const name: string = item.dentago_products?.name ?? item.name ?? "Unknown Product";
          const brand: string = item.dentago_products?.brand ?? "";
          if (!agg[pid]) agg[pid] = { name, brand, totalSpend: 0, totalUnits: 0, lastPrice: price };
          agg[pid].totalSpend += price * qty;
          agg[pid].totalUnits += qty;
          agg[pid].lastPrice = price;
        }
      }

      const productIds = Object.keys(agg).map(Number);
      if (productIds.length === 0) { setLoading(false); return; }

      // 3. Check if clinic has connected suppliers
      const credsRes = await fetch("/api/clinic/credentials", { headers: await freshAuthHeaders() });
      const credsData = credsRes.ok ? await credsRes.json() : {};
      const connectedCount = (credsData.credentials ?? []).length;
      const hasConnected = connectedCount > 0;
      setIsConnected(hasConnected);

      // 4. For each product, fetch supplier prices
      //    - With auth: returns only connected supplier prices (if connected)
      //    - Without auth context: returns all market prices
      //    We fetch with auth to get the connected prices, and without auth to get market high
      const priceMap: Record<number, { connected: number[]; allMarket: number[] }> = {};
      const authHeaders = await freshAuthHeaders();

      await Promise.all(
        productIds.map(async (pid) => {
          try {
            const [connRes, mktRes] = await Promise.all([
              fetch(`/api/products/${pid}`, { headers: authHeaders }),
              hasConnected ? fetch(`/api/products/${pid}`) : Promise.resolve(null),
            ]);
            if (!connRes.ok) return;
            const connData = await connRes.json();
            const connectedPrices: number[] = (connData.suppliers ?? []).map((s: any) => s.price).filter((v: number) => v > 0);

            let allPrices = connectedPrices;
            if (mktRes && mktRes.ok) {
              const mktData = await mktRes.json();
              allPrices = (mktData.suppliers ?? []).map((s: any) => s.price).filter((v: number) => v > 0);
            }

            if (connectedPrices.length) priceMap[pid] = { connected: connectedPrices, allMarket: allPrices };
          } catch { /* skip */ }
        })
      );

      // 5. Compute savings rows
      const savingsRows: SavingsRow[] = [];
      let total = 0;

      for (const [pidStr, info] of Object.entries(agg)) {
        const pid = parseInt(pidStr);
        const prices = priceMap[pid];
        if (!prices) continue;

        const avgPricePaid = info.totalSpend / info.totalUnits;

        // When connected: compare against highest price among their connected suppliers
        // When not connected: compare against highest market price
        const comparisonPrices = hasConnected ? prices.connected : prices.allMarket;
        if (comparisonPrices.length < 1) continue;

        const marketHigh = Math.max(...comparisonPrices);
        const totalSaving = Math.max(0, (marketHigh - avgPricePaid) * info.totalUnits);
        if (totalSaving < 0.01) continue;
        savingsRows.push({
          productId: pid,
          name: info.name,
          brand: info.brand,
          totalUnits: info.totalUnits,
          pricePaid: parseFloat(avgPricePaid.toFixed(2)),
          marketHigh: parseFloat(marketHigh.toFixed(2)),
          totalSaving: parseFloat(totalSaving.toFixed(2)),
        });
        total += totalSaving;
      }

      // Sort by biggest saving first
      savingsRows.sort((a, b) => b.totalSaving - a.totalSaving);
      setRows(savingsRows);
      setTotalSaved(parseFloat(total.toFixed(2)));
      setAnnualSaved(parseFloat((total * 52).toFixed(2)));
    } catch (e: any) {
      setError(e.message ?? "Failed to load savings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121] animate-page-in">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-100">
        <div className="flex items-center px-6 h-[60px] max-w-6xl mx-auto gap-3">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-[#111111] flex-shrink-0">Dentago</Link>
          <span className="text-slate-200">/</span>
          <span className="font-semibold text-slate-400">My Savings</span>
          <Link href="/cart"
            className="ml-auto flex items-center gap-1.5 text-sm font-bold text-white bg-[#111111] hover:brightness-110 px-3 py-1.5 rounded-xl transition-all shadow-md shadow-[#111111]/20">
            <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
            <span className="hidden sm:inline">Cart</span>
          </Link>
          <ProfileMenu clinic={clinic} />
        </div>
      </nav>

      <div className="pt-[60px] max-w-6xl mx-auto px-6 pb-20 mt-8">

        {/* Not logged in */}
        {authChecked && !hasSession && !loading && (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[40px] text-slate-400">lock</span>
            </div>
            <h2 className="text-2xl font-extrabold mb-2">Sign in to view your savings</h2>
            <p className="text-slate-400 mb-8">Your savings are calculated from your order history.</p>
            <Link href="/login" className="bg-[#111111] text-white px-8 py-3.5 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg shadow-[#111111]/20">
              Sign In
            </Link>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-40">
            <span className="material-symbols-outlined text-[48px] text-red-300 mb-4">error</span>
            <p className="text-slate-500 font-mono text-sm">{error}</p>
          </div>
        )}

        {/* Loading */}
        {(!authChecked || (hasSession && loading)) && !error && (
          <div className="space-y-4">
            <div className="h-40 shimmer rounded-3xl" />
            <div className="h-64 shimmer rounded-3xl" />
          </div>
        )}

        {/* No orders yet */}
        {authChecked && hasSession && !loading && !error && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[44px] text-emerald-300" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#151121] mb-2">No savings data yet</h2>
            <p className="text-slate-400 mb-8 text-center max-w-sm">
              Place your first order through Dentago and we&apos;ll track how much you save vs. other suppliers.
            </p>
            <Link href="/search" className="bg-[#111111] text-white px-8 py-3.5 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg shadow-[#111111]/20">
              Browse Products
            </Link>
          </div>
        )}

        {/* Savings data */}
        {authChecked && hasSession && !loading && !error && rows.length > 0 && (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-extrabold tracking-tight text-[#151121] mb-1">My Savings</h1>
              <p className="text-slate-400 font-medium">
            {isConnected
              ? "Based on your order history vs. your connected supplier prices"
              : "Based on your order history vs. market prices"}
          </p>
            </div>

            {/* Hero stats */}
            {(() => {
              const avgPct = rows.length > 0
                ? rows.reduce((sum, r) => sum + (r.marketHigh > 0 ? (r.totalSaving / (r.marketHigh * r.totalUnits)) * 100 : 0), 0) / rows.length
                : 0;
              const totalSpend = rows.reduce((sum, r) => sum + r.pricePaid * r.totalUnits, 0);
              const totalMarket = rows.reduce((sum, r) => sum + r.marketHigh * r.totalUnits, 0);
              const overallPct = totalMarket > 0 ? ((totalMarket - totalSpend) / totalMarket) * 100 : 0;
              return (
                <>
                  {/* Highlight banner */}
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-6 py-4 mb-6 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-600 font-black text-sm">%</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800">
                        You&apos;re paying <span className="text-emerald-600">{overallPct.toFixed(1)}% less</span> than market price on average
                      </p>
                      <p className="text-xs text-emerald-600/70 mt-0.5">
                        That&apos;s {fmtGBP(totalSaved)} back in your pocket across {rows.length} product{rows.length !== 1 ? "s" : ""} — equivalent to {fmtGBP(annualSaved >= 1000 ? annualSaved : annualSaved)} saved per year at this rate
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] px-7 py-6 animate-card-reveal" style={{ animationDelay: "0ms", opacity: 0 }}>
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Total Saved</p>
                      <p className="text-4xl font-extrabold tracking-tight text-emerald-600">{fmtGBP(totalSaved)}</p>
                      <p className="text-xs text-slate-400 mt-1">{isConnected ? "vs. connected supplier prices" : "vs. market prices"}</p>
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] px-7 py-6 animate-card-reveal" style={{ animationDelay: "60ms", opacity: 0 }}>
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Avg. Saving</p>
                      <p className="text-4xl font-extrabold tracking-tight text-emerald-600">{overallPct.toFixed(1)}%</p>
                      <p className="text-xs text-slate-400 mt-1">cheaper than market on your orders</p>
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] px-7 py-6 animate-card-reveal" style={{ animationDelay: "120ms", opacity: 0 }}>
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Annual Projection</p>
                      <p className="text-4xl font-extrabold tracking-tight text-[#111111]">
                        {annualSaved >= 1000 ? `£${(annualSaved / 1000).toFixed(1)}k` : fmtGBP(annualSaved)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">if you order at this rate weekly</p>
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] px-7 py-6 animate-card-reveal" style={{ animationDelay: "180ms", opacity: 0 }}>
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Products Saving On</p>
                      <p className="text-4xl font-extrabold tracking-tight text-[#151121]">{rows.length}</p>
                      <p className="text-xs text-slate-400 mt-1">line items in your history</p>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Breakdown table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden animate-card-reveal" style={{ animationDelay: "240ms", opacity: 0 }}>
              <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
                <h2 className="text-base font-extrabold text-[#151121] tracking-tight">Savings Breakdown</h2>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{fmtGBP(totalSaved)} found</span>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[1fr_60px_180px_140px_100px] gap-4 px-7 py-3 border-b border-slate-50 bg-slate-50/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Units</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">You Paid → Market</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">% Cheaper</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">You Saved</p>
              </div>

              <div className="divide-y divide-slate-50">
                {rows.map((row, i) => {
                  const pct = row.marketHigh > 0 ? ((row.marketHigh - row.pricePaid) / row.marketHigh) * 100 : 0;
                  const barWidth = Math.min(100, pct);
                  return (
                    <div
                      key={row.productId}
                      className="grid grid-cols-[1fr_60px_180px_140px_100px] gap-4 items-center px-7 py-4 hover:bg-slate-50/50 transition-colors"
                      style={{ animationDelay: `${260 + i * 30}ms` }}
                    >
                      <div className="min-w-0">
                        {row.brand && (
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">{row.brand}</p>
                        )}
                        <Link href={`/product/${row.productId}`} className="font-semibold text-[#151121] text-sm line-clamp-1 hover:text-[#111111] transition-colors">
                          {row.name}
                        </Link>
                      </div>
                      <p className="text-sm font-bold text-slate-500 text-right tabular-nums">{row.totalUnits}</p>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-500 tabular-nums">
                          {fmtGBP(row.pricePaid)}
                          <span className="text-slate-300 mx-1">→</span>
                          <span className="text-slate-700">{fmtGBP(row.marketHigh)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-emerald-600 tabular-nums w-12 text-right flex-shrink-0">{pct.toFixed(1)}%</span>
                        <div className="flex-1 h-1.5 bg-emerald-50 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                      <p className="text-sm font-extrabold text-emerald-600 text-right tabular-nums">-{fmtGBP(row.totalSaving)}</p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between px-7 py-5 border-t border-slate-100 bg-emerald-50/40">
                <span className="text-sm font-extrabold text-slate-700">Total Savings</span>
                <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">-{fmtGBP(totalSaved)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-5 text-center leading-relaxed">
              {isConnected
                ? "Savings calculated by comparing your price paid against the highest price among your connected suppliers. Connect more suppliers to widen the comparison."
                : "Savings calculated by comparing your price paid against the highest market price across all suppliers on Dentago. Connect your supplier accounts for personalised savings."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
