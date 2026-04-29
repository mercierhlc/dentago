"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getToken, getClinic, freshAuthHeaders } from "@/lib/auth";
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

  useEffect(() => { setClinic(getClinic()); }, []);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    try {
      // 1. Fetch all orders
      const res = await fetch("/api/orders?limit=500", { headers: await freshAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl border-b border-slate-100/80 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-center px-8 h-16 max-w-5xl mx-auto gap-4">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-[#6C3DE8] flex-shrink-0">Dentago</Link>
          <span className="text-slate-200">/</span>
          <span className="font-semibold text-slate-400">My Savings</span>
          <Link href="/search" className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#6C3DE8] transition-colors">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to search
          </Link>
          <ProfileMenu clinic={clinic} />
        </div>
      </nav>

      <div className="pt-24 max-w-5xl mx-auto px-6 pb-20">

        {/* Not logged in */}
        {!getToken() && !loading && (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[40px] text-slate-400">lock</span>
            </div>
            <h2 className="text-2xl font-extrabold mb-2">Sign in to view your savings</h2>
            <p className="text-slate-400 mb-8">Your savings are calculated from your order history.</p>
            <Link href="/onboarding/login.html" className="bg-[#6C3DE8] text-white px-8 py-3.5 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg shadow-[#6C3DE8]/20">
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
        {loading && (
          <div className="space-y-4">
            <div className="h-40 shimmer rounded-3xl" />
            <div className="h-64 shimmer rounded-3xl" />
          </div>
        )}

        {/* No orders yet */}
        {!loading && !error && getToken() && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[44px] text-emerald-300" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
            </div>
            <h2 className="text-2xl font-extrabold text-[#151121] mb-2">No savings data yet</h2>
            <p className="text-slate-400 mb-8 text-center max-w-sm">
              Place your first order through Dentago and we&apos;ll track how much you save vs. other suppliers.
            </p>
            <Link href="/search" className="bg-[#6C3DE8] text-white px-8 py-3.5 rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg shadow-[#6C3DE8]/20">
              Browse Products
            </Link>
          </div>
        )}

        {/* Savings data */}
        {!loading && !error && rows.length > 0 && (
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] px-7 py-6 animate-card-reveal" style={{ animationDelay: "0ms", opacity: 0 }}>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Total Saved</p>
                <p className="text-4xl font-extrabold tracking-tight text-emerald-600">{fmtGBP(totalSaved)}</p>
                <p className="text-xs text-slate-400 mt-1">{isConnected ? "vs. most expensive connected supplier" : "vs. most expensive market price"}</p>
              </div>
              <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] px-7 py-6 animate-card-reveal" style={{ animationDelay: "60ms", opacity: 0 }}>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Annual Projection</p>
                <p className="text-4xl font-extrabold tracking-tight text-[#6C3DE8]">
                  {annualSaved >= 1000 ? `£${(annualSaved / 1000).toFixed(1)}k` : fmtGBP(annualSaved)}
                </p>
                <p className="text-xs text-slate-400 mt-1">if you order at this rate weekly</p>
              </div>
              <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] px-7 py-6 animate-card-reveal" style={{ animationDelay: "120ms", opacity: 0 }}>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Products Saving On</p>
                <p className="text-4xl font-extrabold tracking-tight text-[#151121]">{rows.length}</p>
                <p className="text-xs text-slate-400 mt-1">line items in your history</p>
              </div>
            </div>

            {/* Breakdown table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden animate-card-reveal" style={{ animationDelay: "180ms", opacity: 0 }}>
              <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
                <h2 className="text-base font-extrabold text-[#151121] tracking-tight">Savings Breakdown</h2>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{fmtGBP(totalSaved)} found</span>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-7 py-3 border-b border-slate-50 bg-slate-50/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-20">Units</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-28">Price Paid → Market</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-20">Saved</p>
              </div>

              <div className="divide-y divide-slate-50">
                {rows.map((row, i) => (
                  <div
                    key={row.productId}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-7 py-4 hover:bg-slate-50/50 transition-colors"
                    style={{ animationDelay: `${200 + i * 30}ms` }}
                  >
                    <div className="min-w-0">
                      {row.brand && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 truncate">{row.brand}</p>
                      )}
                      <Link href={`/product/${row.productId}`} className="font-semibold text-[#151121] text-sm line-clamp-1 hover:text-[#6C3DE8] transition-colors">
                        {row.name}
                      </Link>
                    </div>
                    <p className="text-sm font-bold text-slate-500 text-right w-20 tabular-nums">{row.totalUnits}</p>
                    <div className="text-right w-28">
                      <p className="text-sm font-bold text-slate-500 tabular-nums">
                        {fmtGBP(row.pricePaid)}
                        <span className="text-slate-300 mx-1">→</span>
                        <span className="text-slate-700">{fmtGBP(row.marketHigh)}</span>
                      </p>
                    </div>
                    <p className="text-sm font-extrabold text-emerald-600 text-right w-20 tabular-nums">-{fmtGBP(row.totalSaving)}</p>
                  </div>
                ))}
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
