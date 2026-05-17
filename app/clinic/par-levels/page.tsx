"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockedUntilFirstOrder } from "@/components/LockedUntilFirstOrder";
import { getClinic, freshAuthHeaders } from "@/lib/auth";

type Product = { id: number; name: string; brand: string; category: string; sku: string };
type ParLevel = {
  id: string;
  product_id: number;
  par_quantity: number;
  reorder_quantity: number;
  reorder_interval_days: number | null;
  last_ordered_at: string | null;
  alert_sent_at: string | null;
  notes: string | null;
  product: Product | null;
  days_since_order: number | null;
  is_due: boolean;
};

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ParLevelsPage() {
  const router = useRouter();
  const clinic = typeof window !== "undefined" ? getClinic() : null;

  const [parLevels, setParLevels] = useState<ParLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [parQty, setParQty] = useState(1);
  const [reorderQty, setReorderQty] = useState(2);
  const [intervalDays, setIntervalDays] = useState<number | "">(30);
  const [notes, setNotes] = useState("");

  const loadParLevels = useCallback(async () => {
    setLoading(true);
    const headers = await freshAuthHeaders();
    const res = await fetch("/api/clinic/par-levels", { headers });
    if (res.status === 401) { router.push("/login"); return; }
    const json = await res.json();
    setParLevels(json.par_levels ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => { loadParLevels(); }, [loadParLevels]);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
    const json = await res.json();
    setSearchResults((json.results ?? json.products ?? []).slice(0, 8));
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchProducts]);

  function openAdd() {
    setSelectedProduct(null);
    setParQty(1);
    setReorderQty(2);
    setIntervalDays(30);
    setNotes("");
    setEditingId(null);
    setSearchQuery("");
    setSearchResults([]);
    setShowAddPanel(true);
  }

  function openEdit(pl: ParLevel) {
    setSelectedProduct(pl.product);
    setParQty(pl.par_quantity);
    setReorderQty(pl.reorder_quantity);
    setIntervalDays(pl.reorder_interval_days ?? "");
    setNotes(pl.notes ?? "");
    setEditingId(pl.id);
    setSearchQuery(pl.product?.name ?? "");
    setSearchResults([]);
    setShowAddPanel(true);
  }

  async function saveParLevel() {
    if (!selectedProduct) return;
    setSaving(true);
    const headers = await freshAuthHeaders();
    const res = await fetch("/api/clinic/par-levels", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: selectedProduct.id,
        par_quantity: parQty,
        reorder_quantity: reorderQty,
        reorder_interval_days: intervalDays === "" ? null : Number(intervalDays),
        notes: notes || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setShowAddPanel(false);
      loadParLevels();
    }
  }

  async function deleteParLevel(id: string) {
    const headers = await freshAuthHeaders();
    await fetch(`/api/clinic/par-levels?id=${id}`, { method: "DELETE", headers });
    setParLevels(prev => prev.filter(p => p.id !== id));
  }

  const dueCount = parLevels.filter(p => p.is_due).length;

  return (
    <LockedUntilFirstOrder
      featureName="Par levels & inventory"
      featureIcon="inventory_2"
      featureDesc="Set minimum stock levels per SKU and get alerts before you run out mid-session.">
    <div className="min-h-screen bg-[var(--dc-bg,#eef0f7)]">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)]">Inventory</p>
            <h1 className="clinic-serif text-3xl font-normal tracking-tight text-[var(--dc-text,#0f172a)]">
              Par levels &amp; <em className="italic text-[var(--dc-accent,#c3b1e1)]">alerts</em>
            </h1>
            <p className="text-sm text-[var(--dc-muted,#64748b)] max-w-md leading-relaxed">
              Set minimum stock and reorder rhythm — we surface due lines on your dashboard and in email alerts.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {dueCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--dc-warning,#e8b86d)]/15 text-[var(--dc-warning,#b45309)] text-xs font-bold border border-[var(--dc-warning,#e8b86d)]/25">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                {dueCount} due
              </span>
            )}
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-[var(--dc-accent,#c3b1e1)] text-[#121019] text-sm font-bold px-4 py-2.5 rounded-xl hover:brightness-110 transition-all shadow-[0_8px_24px_rgba(17,17,17,0.12)]"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add product
            </button>
          </div>
        </div>

        {/* Add/Edit panel */}
        {showAddPanel && (
          <div className="bg-white rounded-2xl border border-violet-100 shadow-md p-6 mb-6">
            <h2 className="font-bold text-slate-800 mb-4 text-base">
              {editingId ? "Edit par level" : "Add par level"}
            </h2>

            {/* Product search */}
            {!editingId && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Product
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                  {searching && (
                    <span className="absolute right-3 top-2.5 text-slate-400 text-xs">searching…</span>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                    {searchResults.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedProduct(p); setSearchQuery(p.name); setSearchResults([]); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 border-b border-slate-100 last:border-0"
                      >
                        <span className="font-semibold text-slate-800">{p.name}</span>
                        {p.brand && <span className="text-slate-400 ml-2">{p.brand}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {selectedProduct && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    {selectedProduct.name}
                    {selectedProduct.brand && ` · ${selectedProduct.brand}`}
                  </div>
                )}
              </div>
            )}
            {editingId && selectedProduct && (
              <div className="mb-4 px-3 py-2 bg-violet-50 rounded-xl text-sm text-violet-800 font-semibold">
                {selectedProduct.name}
                {selectedProduct.brand && <span className="text-violet-500 font-normal ml-2">{selectedProduct.brand}</span>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Par quantity (minimum)
                </label>
                <input
                  type="number" min={1} value={parQty}
                  onChange={e => setParQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Reorder quantity
                </label>
                <input
                  type="number" min={1} value={reorderQty}
                  onChange={e => setReorderQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Reorder every (days) <span className="normal-case font-normal text-slate-400">— leave blank to disable time-based alerts</span>
              </label>
              <input
                type="number" min={1} placeholder="e.g. 30"
                value={intervalDays}
                onChange={e => setIntervalDays(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Notes (optional)
              </label>
              <input
                type="text" placeholder="e.g. order from Henry Schein"
                value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveParLevel}
                disabled={!selectedProduct || saving}
                className="bg-[#111111] disabled:opacity-40 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#5B32D6] transition-colors"
              >
                {saving ? "Saving…" : editingId ? "Update" : "Save par level"}
              </button>
              <button
                onClick={() => setShowAddPanel(false)}
                className="text-slate-500 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Par levels list */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading…</div>
        ) : parLevels.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-slate-300 mb-4 block">inventory_2</span>
            <p className="text-slate-600 font-semibold mb-1">No par levels set yet</p>
            <p className="text-slate-400 text-sm">Add your first product to start getting stockout alerts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {parLevels.map(pl => (
              <div
                key={pl.id}
                className={`bg-white rounded-2xl border ${pl.is_due ? "border-amber-200 shadow-[0_0_0_2px_rgba(245,158,11,0.1)]" : "border-slate-100"} p-5 flex items-center gap-4`}
              >
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${pl.is_due ? "bg-amber-400" : "bg-emerald-400"}`} />

                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm truncate">
                      {pl.product?.name ?? `Product #${pl.product_id}`}
                    </span>
                    {pl.product?.brand && (
                      <span className="text-slate-400 text-xs">{pl.product.brand}</span>
                    )}
                    {pl.is_due && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                        DUE FOR REORDER
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>Par: <strong className="text-slate-600">{pl.par_quantity}</strong></span>
                    <span>Reorder: <strong className="text-slate-600">{pl.reorder_quantity}</strong></span>
                    {pl.reorder_interval_days && (
                      <span>Every <strong className="text-slate-600">{pl.reorder_interval_days}d</strong></span>
                    )}
                    {pl.last_ordered_at && (
                      <span>Last ordered: <strong className="text-slate-600">{fmtDate(pl.last_ordered_at)}</strong>
                        {pl.days_since_order !== null && ` (${pl.days_since_order}d ago)`}
                      </span>
                    )}
                    {!pl.last_ordered_at && <span className="text-amber-500">Never ordered</span>}
                  </div>
                  {pl.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{pl.notes}</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pl.is_due && (
                    <Link
                      href={`/search?q=${encodeURIComponent(pl.product?.name ?? "")}`}
                      className="text-xs font-bold px-3 py-1.5 bg-[#111111] text-white rounded-lg hover:bg-[#5B32D6] transition-colors"
                    >
                      Reorder
                    </Link>
                  )}
                  <button
                    onClick={() => openEdit(pl)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    onClick={() => deleteParLevel(pl.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </LockedUntilFirstOrder>
  );
}
