"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getClinic, getToken, clearAuth, authHeaders } from "@/lib/auth";

type Supplier = { id: number; name: string; website?: string };

type ConnectedSupplier = {
  supplier_id: number;
  account_number?: string;
  connected_at: string;
  dentago_suppliers: Supplier;
};

export default function ClinicSuppliersPage() {
  const router = useRouter();
  const clinic = getClinic();
  const token = getToken();

  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [connected, setConnected] = useState<Set<number>>(new Set());
  const [accountNumbers, setAccountNumbers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) { router.push("/login"); return; }

    // Fetch real supplier list from DB + clinic's existing connections in parallel
    Promise.all([
      fetch("/api/suppliers").then(r => r.json()),
      fetch("/api/clinic/suppliers", { headers: authHeaders() }).then(r => r.json()),
    ]).then(([suppliersData, connectedData]) => {
      setAllSuppliers(suppliersData.suppliers ?? []);

      const ids = new Set<number>();
      const nums: Record<number, string> = {};
      (connectedData.suppliers ?? []).forEach((s: ConnectedSupplier) => {
        ids.add(s.supplier_id);
        if (s.account_number) nums[s.supplier_id] = s.account_number;
      });
      setConnected(ids);
      setAccountNumbers(nums);
    }).finally(() => setLoading(false));
  }, [token, router]);

  async function toggle(supplierId: number) {
    setToggling(supplierId);
    const isConnected = connected.has(supplierId);

    try {
      if (isConnected) {
        await fetch("/api/clinic/suppliers", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ supplierId }),
        });
        setConnected(prev => { const n = new Set(prev); n.delete(supplierId); return n; });
      } else {
        await fetch("/api/clinic/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ supplierId, accountNumber: accountNumbers[supplierId] || null }),
        });
        setConnected(prev => new Set([...prev, supplierId]));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setToggling(null);
    }
  }

  async function updateAccountNumber(supplierId: number, value: string) {
    setAccountNumbers(prev => ({ ...prev, [supplierId]: value }));
    if (!connected.has(supplierId)) return;
    await fetch("/api/clinic/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ supplierId, accountNumber: value }),
    });
  }

  if (!clinic) return null;

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121]">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 px-4 h-14 max-w-3xl mx-auto">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-[#6C3DE8]">Dentago</Link>
          <span className="text-slate-300 font-light">/</span>
          <span className="text-sm font-bold text-slate-600">My Suppliers</span>
          <div className="ml-auto flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Saved
              </span>
            )}
            <Link href="/search" className="flex items-center gap-1.5 text-xs font-bold text-[#6C3DE8] border border-[#6C3DE8]/30 bg-[#6C3DE8]/5 px-3 py-1.5 rounded-xl hover:bg-[#6C3DE8]/10 transition-all">
              <span className="material-symbols-outlined text-[14px]">search</span>
              Search Products
            </Link>
            <button
              onClick={() => { clearAuth(); router.push("/"); }}
              className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
            >Sign out</button>
          </div>
        </div>
      </nav>

      <div className="pt-14 max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-[#151121] mb-1">Your Supplier Connections</h1>
          <p className="text-sm text-slate-500">
            Connect the suppliers your clinic has accounts with. Once connected, the search will only show pricing from <em>your</em> suppliers.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#6C3DE8]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-[#6C3DE8]" style={{ fontVariationSettings: "'FILL' 1" }}>business</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[#151121]">{clinic.clinic_name}</p>
              <p className="text-xs text-slate-400">{clinic.email}</p>
            </div>
            <span className="ml-auto text-sm font-bold text-[#6C3DE8]">
              {connected.size} of {allSuppliers.length} connected
            </span>
          </div>
        </div>

        {!loading && connected.size === 0 && (
          <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
            <span className="material-symbols-outlined text-[20px] text-amber-500 flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
            <div>
              <p className="text-sm font-bold text-amber-800">No suppliers connected yet</p>
              <p className="text-xs text-amber-600 mt-0.5">Connect at least one to see personalised pricing. Until then, search shows all market prices.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {allSuppliers.map(supplier => {
              const isConnected = connected.has(supplier.id);
              const isToggling = toggling === supplier.id;
              return (
                <div
                  key={supplier.id}
                  className={`bg-white rounded-2xl border transition-all ${
                    isConnected ? "border-[#6C3DE8]/30 shadow-sm shadow-[#6C3DE8]/5" : "border-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 transition-colors ${
                      isConnected ? "bg-[#6C3DE8] text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      {supplier.name[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#151121]">{supplier.name}</p>
                      {supplier.website && (
                        <p className="text-[10px] text-slate-400">{supplier.website}</p>
                      )}
                    </div>

                    <button
                      onClick={() => toggle(supplier.id)}
                      disabled={isToggling}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                        isConnected
                          ? "bg-[#6C3DE8]/10 text-[#6C3DE8] hover:bg-red-50 hover:text-red-500"
                          : "bg-slate-50 text-slate-500 hover:bg-[#6C3DE8]/10 hover:text-[#6C3DE8] border border-slate-200"
                      }`}
                    >
                      {isToggling ? (
                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15"/></svg>
                      ) : (
                        <span className="material-symbols-outlined text-[14px]">
                          {isConnected ? "link_off" : "add_link"}
                        </span>
                      )}
                      {isConnected ? "Connected" : "Connect"}
                    </button>
                  </div>

                  {isConnected && (
                    <div className="px-5 pb-4 flex items-center gap-3">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">tag</span>
                      <input
                        type="text"
                        value={accountNumbers[supplier.id] ?? ""}
                        onChange={e => updateAccountNumber(supplier.id, e.target.value)}
                        placeholder="Account number (optional)"
                        className="flex-1 text-xs font-medium text-slate-600 placeholder:text-slate-300 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#6C3DE8] transition-all bg-slate-50"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-[#6C3DE8] text-white px-8 py-3.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-md shadow-[#6C3DE8]/20"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            Search with My Suppliers
          </Link>
          <p className="text-xs text-slate-400 mt-3">
            {connected.size === 0
              ? "You'll see all market prices until you connect a supplier"
              : `Prices filtered to ${connected.size} connected supplier${connected.size !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
    </div>
  );
}
