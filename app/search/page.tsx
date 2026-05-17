"use client";
import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ALL_CATEGORIES, ALL_SUPPLIERS } from "@/lib/products";
import { getClinic, getToken, freshAuthHeaders, getFreshToken } from "@/lib/auth";
import { SupplierLogo } from "@/components/SupplierLogo";
import { loadGuestCartLines, upsertGuestCartLine } from "@/lib/guest-cart";

type ApiSupplier = {
  name: string; id: number; price: number; stock: boolean;
  delivery: string; sku: string; packSize?: string;
  isConnected?: boolean;
  priceCompareIncVat?: number;
  priceExVat?: number;
  priceIncVat?: number;
  per_unit_price?: number | null;
  is_best_value?: boolean;
};

type ApiProduct = {
  id: number; name: string; brand: string; category: string;
  image: string; packSize: string; description: string;
  suppliers: ApiSupplier[];
  bestPrice: number | null;
  bestPriceCompareIncVat?: number | null;
  bestSupplier: ApiSupplier | null;
  saving: number;
  inStockCount: number;
  totalSuppliers: number;
  bestValueName?: string | null;
  bestValueFormatted?: string | null;
};

type CartItem = { supplier: string; price: number; name: string; category: string; saving: number };
type CartApiItem = {
  productId: number;
  name: string;
  category: string;
  supplier: string;
  unitPrice: number;
};

function supplierRankPrice(s: Pick<ApiSupplier, "price" | "priceCompareIncVat">): number {
  return s.priceCompareIncVat ?? s.price;
}

function isSearchSupplierBest(s: ApiSupplier, best: ApiSupplier | null | undefined): boolean {
  if (!best || !s.stock) return false;
  return s.name === best.name && Math.abs(supplierRankPrice(s) - supplierRankPrice(best)) < 0.001;
}

const PLACEHOLDERS = [
  "Try 'Septanest', 'nitrile gloves M', or paste a SKU…",
  "Search by brand: Septodont, 3M ESPE…",
  "Search by SKU or product name…",
  "Search gloves, articaine, composite…",
];

function useCyclingPlaceholder() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(t);
  }, []);
  return PLACEHOLDERS[i];
}

const CATEGORIES = ALL_CATEGORIES;
const QUICK_CATS = ["Composites", "Anaesthetics", "Impression", "PPE", "Burs & instruments", "Endo", "Hygiene", "Lab consumables"];

function SearchContent() {
  const searchParams = useSearchParams();
  const placeholder = useCyclingPlaceholder();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"category_az" | "best_price" | "saving" | "name">("category_az");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceMax, setPriceMax] = useState(1000);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [cart, setCart] = useState<Record<number, CartItem>>({});
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [clinic, setClinic] = useState<{ id: string; clinic_name: string; email: string } | null>(null);
  const [clinicFiltered, setClinicFiltered] = useState(false);
  const [connectedSupplierCount, setConnectedSupplierCount] = useState<number | null>(null);

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<number>>(new Set());

  const [justAdded, setJustAdded] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hydrateCart = useCallback(async () => {
    const headers = await freshAuthHeaders();
    if (!headers.Authorization) {
      const next: Record<number, CartItem> = {};
      for (const it of loadGuestCartLines()) {
        next[it.productId] = {
          supplier: it.supplier,
          price: it.unitPrice,
          name: it.name,
          category: it.category,
          saving: 0,
        };
      }
      setCart(next);
      return;
    }

    try {
      const res = await fetch("/api/cart", { headers });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: CartApiItem[] };
      const mapped: Record<number, CartItem> = {};
      for (const item of data.items ?? []) {
        if (!item.productId) continue;
        mapped[item.productId] = {
          supplier: item.supplier,
          price: item.unitPrice,
          name: item.name,
          category: item.category,
          saving: 0,
        };
      }
      setCart(mapped);
    } catch {
      // Cart hydration should never block product search.
    }
  }, []);

  useEffect(() => {
    setClinic(getClinic());
    setIsLoggedIn(!!getToken());
    const q = searchParams.get("q");
    if (q) setQuery(q);
    hydrateCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clinic/favorites", { headers: await freshAuthHeaders() });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setFavorites(new Set((data.favorites ?? []).map((f: { product_id: number }) => f.product_id)));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  async function toggleFavorite(productId: number, supplierName?: string, price?: number) {
    const headers = await freshAuthHeaders();
    if (!headers.Authorization) return;
    const isFav = favorites.has(productId);
    setFavorites(prev => { const n = new Set(prev); if (isFav) n.delete(productId); else n.add(productId); return n; });
    try {
      if (isFav) {
        await fetch(`/api/clinic/favorites?product_id=${productId}`, { method: "DELETE", headers });
      } else {
        await fetch("/api/clinic/favorites", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: productId, preferred_supplier_name: supplierName ?? null, preferred_price: price ?? null }),
        });
      }
    } catch {
      setFavorites(prev => { const n = new Set(prev); if (isFav) n.add(productId); else n.delete(productId); return n; });
    }
  }

  const fetchProducts = useCallback(async (resetPage = false) => {
    setLoading(true);
    const p = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    const params = new URLSearchParams({
      q: query,
      category: activeCategory === "All" ? "" : activeCategory,
      inStock: inStockOnly ? "true" : "false",
      maxPrice: priceMax < 1000 ? String(priceMax) : "0",
      sort: sortBy,
      page: String(p),
      limit: "9",
    });
    if (selectedSuppliers.length === 1) params.set("supplier", selectedSuppliers[0]);
    try {
      const res = await fetch(`/api/search?${params}`, { headers: await freshAuthHeaders() });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setProducts(data.products ?? []);
      setFailedImageIds(new Set());
      setTotal(data.total ?? 0);
      setTotalPages(data.pages ?? 1);
      setClinicFiltered(data.clinicFiltered ?? false);
      setConnectedSupplierCount(data.connectedSupplierCount ?? null);
      setClinic(getClinic());
      setFetchError(null);
    } catch (err) {
      setProducts([]);
      setTotal(0);
      setTotalPages(1);
      setFetchError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [query, activeCategory, inStockOnly, priceMax, sortBy, selectedSuppliers, page]);

  useEffect(() => {
    const t = setTimeout(() => fetchProducts(true), query ? 300 : 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeCategory, inStockOnly, priceMax, sortBy, selectedSuppliers]);

  useEffect(() => { fetchProducts(false); /* eslint-disable-next-line */ }, [page]);

  async function addToCart(id: number, supplier: string, price: number, name: string, category: string, saving: number) {
      const product = products.find(p => p.id === id);
      const supplierRow = product?.suppliers.find(s => s.name === supplier);
    if (!supplierRow) { alert("Could not match supplier. Try refreshing."); return; }
    await getFreshToken();
    const headers = await freshAuthHeaders();
    const displayName = product?.name ?? name;

    if (!headers.Authorization) {
      upsertGuestCartLine({
        productId: id,
        supplierId: supplierRow.id,
        supplier: supplierRow.name,
        name: displayName,
        brand: product?.brand ?? "",
        category,
        image: product?.image ?? "",
        packSize: supplierRow.packSize ?? product?.packSize ?? "",
        sku: supplierRow.sku || null,
        quantity: 1,
        unitPrice: price,
        inStock: supplierRow.stock,
      });
      setCart(prev => ({ ...prev, [id]: { supplier, price, name: displayName, category, saving } }));
      setJustAdded(id);
      setTimeout(() => setJustAdded(null), 1400);
      return;
    }

    setCart(prev => ({ ...prev, [id]: { supplier, price, name: displayName, category, saving } }));
    setJustAdded(id);
    setTimeout(() => setJustAdded(null), 1400);
    const res = await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ productId: id, supplierId: supplierRow.id, quantity: 1, unitPrice: price, sku: supplierRow.sku || undefined, packSize: supplierRow.packSize ?? product?.packSize }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setCart(prev => { const n = { ...prev }; delete n[id]; return n; });
      alert(typeof data.error === "string" ? data.error : `Could not add to cart (${res.status})`);
      return;
    }

    await hydrateCart();
  }

  const cartItems = Object.entries(cart);

  function toggleSupplier(s: string) {
    setSelectedSuppliers(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  return (
    <div className="pb-16 px-4 sm:px-6 lg:px-10 pt-6 md:pt-10">
      <div className="max-w-[1320px] mx-auto">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-2">Marketplace · Search</p>
            <h1 className="clinic-serif text-3xl sm:text-[2.35rem] leading-[1.15] text-[var(--dc-text,#0f172a)] font-normal tracking-tight">
              Every UK supplier in <em className="italic text-[var(--dc-accent-strong,#111111)]">one tab.</em>
            </h1>
            <p className="mt-3 text-sm text-[var(--dc-muted,#64748b)] max-w-xl leading-relaxed">
              {ALL_SUPPLIERS.length} UK suppliers · live prices, real-time stock, and your negotiated rates when you connect your account.
            </p>
            </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/cart"
              className="flex items-center gap-1.5 text-sm font-semibold text-[var(--dc-text,#0f172a)] border border-[var(--dc-border)] bg-neutral-50 hover:bg-neutral-100 px-4 py-2.5 rounded-xl transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-[var(--dc-accent,#c3b1e1)]">shopping_cart</span>
              Cart{cartItems.length ? ` · ${cartItems.length}` : ""}
            </Link>
            <Link
              href="/settings?tab=integrations"
              className="flex items-center gap-1.5 text-sm font-semibold text-[#121019] bg-[var(--dc-accent,#c3b1e1)] hover:brightness-110 px-4 py-2.5 rounded-xl transition-all shadow-[0_8px_24px_rgba(17,17,17,0.22)]"
            >
              <span className="material-symbols-outlined text-[18px]">link</span>
              Connect supplier
            </Link>
          </div>
        </header>

        {/* Search bar */}
        <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] p-2 flex items-center gap-2 shadow-[0_4px_24px_rgba(15,23,42,0.06)] mb-4">
          <div className="w-11 h-11 rounded-xl bg-neutral-100 text-[var(--dc-muted,#64748b)] flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
            <input
            ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 border-0 outline-none bg-transparent text-[15px] font-medium text-[var(--dc-text,#0f172a)] placeholder:text-[var(--dc-muted,#64748b)]/80 px-3 py-3 tracking-tight"
          />
          <span className="hidden sm:inline-flex items-center gap-0.5 bg-neutral-50 border border-[var(--dc-border)] px-2 py-1 rounded-md text-[11px] font-medium text-[var(--dc-muted,#64748b)] mr-1 font-mono">
            ⌘K
          </span>
          </div>

        {/* Quick chips */}
        <div className="flex flex-wrap gap-2 items-center mb-8">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mr-1">Quick ·</span>
          {QUICK_CATS.map(cat => {
            const active = activeCategory === cat || (cat === "Composites" && activeCategory === "Composite");
                  return (
                    <button
                      key={cat}
                onClick={() => setActiveCategory(cat === "Composites" ? "Composite" : cat === activeCategory ? "All" : cat)}
                className={`text-[13px] font-medium px-3.5 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-[var(--dc-accent-strong,#111111)] border-[var(--dc-accent-strong,#111111)] text-white"
                    : "bg-[var(--dc-surface,#ffffff)] border-[var(--dc-border)] text-[var(--dc-text,#0f172a)] hover:bg-neutral-50"
                }`}
              >
                      {cat}
                    </button>
                  );
                })}
            </div>

        {/* Mobile filter toggle */}
        <button
          className="lg:hidden flex items-center gap-2 text-sm font-semibold text-[var(--dc-text,#0f172a)] border border-[var(--dc-border)] bg-[var(--dc-surface,#fff)] px-4 py-2.5 rounded-xl mb-4 transition-colors hover:bg-neutral-50"
          onClick={() => setFiltersOpen(o => !o)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
          </svg>
          Filters
          {(selectedSuppliers.length > 0 || inStockOnly || activeCategory !== "All") && (
            <span className="ml-1 text-[10px] font-bold bg-[var(--dc-accent,#c3b1e1)] text-[#121019] px-1.5 py-0.5 rounded-full">
              {selectedSuppliers.length + (inStockOnly ? 1 : 0) + (activeCategory !== "All" ? 1 : 0)}
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`ml-auto transition-transform ${filtersOpen ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Layout: filters · results */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
          {/* FILTER SIDEBAR */}
          <aside className={`lg:sticky lg:top-6 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)] ${filtersOpen ? "block" : "hidden"} lg:block`}>
            <div className="pb-5 border-b border-[var(--dc-border)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-3">
                Suppliers · {ALL_SUPPLIERS.length} available
              </p>
              <div className="flex flex-col gap-1 max-h-[min(520px,55vh)] overflow-y-auto pr-1 -mr-1">
                {ALL_SUPPLIERS.map(s => {
                  const on = selectedSuppliers.includes(s);
                  return (
              <button
                      key={s}
                      onClick={() => toggleSupplier(s)}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                        on
                          ? "bg-[rgba(17,17,17,0.08)] text-[var(--dc-accent-strong,#111111)] font-semibold"
                          : "text-[var(--dc-text,#0f172a)] hover:bg-neutral-50"
                      }`}
                    >
                      <SupplierLogo supplierName={s} size={22} />
                      <span className="truncate">{s}</span>
              </button>
                  );
                })}
              </div>
            </div>

            <div className="py-5 border-b border-[var(--dc-border)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-3">Price · per unit</p>
              <div className="flex justify-between text-xs text-[var(--dc-muted,#64748b)] mb-2">
                <span>£0</span>
                <span>£{priceMax === 1000 ? "200+" : priceMax}</span>
              </div>
              <input
                type="range"
                min="5"
                max="1000"
                step="5"
                value={priceMax}
                onChange={e => setPriceMax(Number(e.target.value))}
                className="w-full h-1 rounded accent-[var(--dc-accent-strong,#111111)]"
              />
            </div>

            <div className="py-5 border-b border-[var(--dc-border)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-3">Category</p>
              <div className="flex flex-col">
                {CATEGORIES.slice(0, 8).map(cat => {
                  const on = activeCategory === cat;
                  return (
                    <label
                      key={cat}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
                        on ? "text-[var(--dc-accent-strong,#111111)] font-semibold" : "text-[var(--dc-text,#0f172a)] hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setActiveCategory(on ? "All" : cat)}
                        className="accent-[var(--dc-accent-strong,#111111)]"
                      />
                      <span className="truncate">{cat}</span>
                    </label>
                  );
                })}
                    </div>
              </div>

            <div className="pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] mb-3">Stock</p>
              <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm cursor-pointer text-[var(--dc-text,#0f172a)] hover:bg-neutral-50">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={() => setInStockOnly(!inStockOnly)}
                  className="accent-[var(--dc-accent-strong,#111111)]"
                />
                In stock now
              </label>
          </div>
        </aside>

          {/* RESULTS */}
          <main className="min-w-0">
          {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-sm text-[var(--dc-muted,#64748b)] truncate">
                {loading
                  ? "Searching…"
                  : (
                    <>
                      <b className="text-[var(--dc-text,#0f172a)]">{total}</b> products · {ALL_SUPPLIERS.length} suppliers · sorted by
                      <b className="text-[var(--dc-text,#0f172a)]">best price for you</b>
                    </>
                  )}
              </p>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-2 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] text-sm font-medium text-[var(--dc-text,#0f172a)] outline-none focus:ring-2 focus:ring-[var(--dc-accent-strong,#111111)]/30"
              >
                <option value="category_az">Category A–Z</option>
                <option value="best_price">Best Price</option>
                <option value="saving">Top Savings</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>

            {/* Connected indicator */}
            {!loading && clinicFiltered && connectedSupplierCount !== null && connectedSupplierCount > 0 && (
              <div className="mb-4 rounded-2xl border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.06)] px-4 py-2.5 flex items-center gap-2 text-sm text-[var(--dc-text,#0f172a)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold">{connectedSupplierCount} supplier{connectedSupplierCount !== 1 ? "s" : ""} connected</span>
                <span className="text-[var(--dc-muted,#64748b)]">— your prices are highlighted below</span>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div
                    key={i}
                    className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] p-5 h-[340px] animate-pulse"
                    style={{ opacity: 0.5 + i * 0.1 }}
                  />
              ))}
            </div>
            )}

            {/* Error */}
            {!loading && fetchError && (
              <div className="text-center py-20 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)]">
                <p className="text-base font-semibold text-[var(--dc-text,#0f172a)] mb-2">Couldn&apos;t load products</p>
                <p className="text-sm text-[var(--dc-muted,#64748b)] mb-6">{fetchError}</p>
                <button
                  onClick={() => fetchProducts(true)}
                  className="px-5 py-2.5 rounded-xl bg-[var(--dc-accent,#c3b1e1)] text-[#121019] text-sm font-semibold hover:brightness-110 transition-all shadow-[0_8px_24px_rgba(17,17,17,0.22)]"
                >
                  Try again
                </button>
                </div>
            )}

            {/* Empty */}
            {!loading && !fetchError && products.length === 0 && (
              <div className="text-center py-20 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)]">
                <p className="text-base font-semibold text-[var(--dc-text,#0f172a)] mb-2">
                  No results{query ? ` for "${query}"` : ""}
                </p>
                <p className="text-sm text-[var(--dc-muted,#64748b)] mb-6">Try a different spelling, brand name, or SKU.</p>
                <button
                  onClick={() => { setQuery(""); setActiveCategory("All"); setInStockOnly(false); setPriceMax(1000); setSelectedSuppliers([]); }}
                  className="px-5 py-2.5 rounded-xl bg-[var(--dc-accent,#c3b1e1)] text-[#121019] text-sm font-semibold hover:brightness-110 transition-all shadow-[0_8px_24px_rgba(17,17,17,0.22)]"
                >
                  Clear filters
                </button>
            </div>
          )}

            {/* Product grid */}
          {!loading && products.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map((p, idx) => {
                  const sorted = [...p.suppliers].sort((a, b) => {
                    if (a.stock && !b.stock) return -1;
                    if (!a.stock && b.stock) return 1;
                    return supplierRankPrice(a) - supplierRankPrice(b);
                  });
                  const best = p.bestSupplier;
                  const inCart = cart[p.id];
                  const cartTarget = clinicFiltered
                    ? (sorted.find(s => s.stock && s.isConnected) ?? sorted.find(s => s.stock) ?? null)
                    : (sorted.find(s => s.stock) ?? null);
                  const isJustAdded = justAdded === p.id;
                  const image = p.image?.trim();
                  const showImage = !!image && !failedImageIds.has(p.id);

                  const iconColors = ["#111111,#c3b1e1", "#1f6f5c,#3aa884", "#c97a3a,#f5c8a8", "#b04a72,#e8b6c2", "#1a4f6e,#4a8fb0", "#5b606b,#9a9fa8"];
                  const iconGrad = iconColors[idx % iconColors.length];

                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl border bg-[var(--dc-surface,#ffffff)] overflow-hidden transition-all shadow-[0_4px_24px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(15,23,42,0.1)] ${
                        inCart ? "border-[rgba(17,17,17,0.32)]" : "border-[var(--dc-border)]"
                      }`}
                    >
                      <div className="relative h-[170px] bg-gradient-to-br from-white to-neutral-50 border-b border-[var(--dc-border)] flex items-center justify-center p-5">
                        {showImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt={p.name}
                            className="max-h-[132px] max-w-[82%] object-contain mix-blend-multiply"
                            onError={() => setFailedImageIds(prev => new Set(prev).add(p.id))}
                          />
                        ) : (
                          <div
                            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white clinic-serif text-3xl italic"
                            style={{ background: `linear-gradient(135deg,${iconGrad})` }}
                          >
                            {p.name.charAt(0)}
                        </div>
                        )}
                        <span className="absolute left-3 top-3 rounded-full bg-[var(--dc-accent-strong,#111111)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white">
                          {p.category}
                        </span>
                        {p.saving > 1 && (
                          <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white">
                            Save £{p.saving.toFixed(0)}
                              </span>
                            )}
                          </div>

                      <div className="p-4">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dc-muted,#64748b)] truncate">
                              {p.brand || p.category}
                            </p>
                            <Link
                              href={`/product/${p.id}`}
                              className="block min-h-[42px] text-[15px] font-semibold text-[var(--dc-text,#0f172a)] tracking-tight mt-1 leading-snug hover:text-[var(--dc-accent-strong,#111111)]"
                            >
                              {p.name}
                                </Link>
                          </div>
                                <button
                            type="button"
                            onClick={() => toggleFavorite(p.id, best?.name, best?.price)}
                            className="inline-flex p-1 rounded-md text-[var(--dc-muted,#64748b)] hover:text-[var(--dc-accent-strong,#111111)] hover:bg-neutral-50"
                            aria-label={favorites.has(p.id) ? "Remove favourite" : "Add favourite"}
                          >
                            {favorites.has(p.id) ? "★" : "☆"}
                                </button>
                            </div>

                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {p.packSize && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-neutral-100 text-[var(--dc-muted,#64748b)]">
                              {p.packSize}
                            </span>
                          )}
                          {favorites.has(p.id) && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-[rgba(244,63,94,0.08)] text-rose-600">
                              ★ Favourite
                            </span>
                        )}
                      </div>

                        {/* Compare table */}
                        <div className="mt-4 flex flex-col gap-1.5">
                        {sorted.slice(0, 3).map(s => {
                          const isBest = isSearchSupplierBest(s, best);
                          const maxPrice = Math.max(...p.suppliers.filter(x => x.stock).map(x => x.price));
                          return (
                            <div
                              key={s.name}
                              className={`grid grid-cols-[1fr_auto] gap-2 items-center px-2.5 py-1.5 rounded-lg text-[12px] ${
                                isBest
                                  ? "bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.22)]"
                                  : "bg-neutral-50"
                              } ${!s.stock ? "opacity-60" : ""}`}
                            >
                              <span className="flex flex-col gap-0.5 text-[var(--dc-text,#0f172a)] overflow-hidden min-w-0">
                                <span className="flex items-center gap-2 min-w-0">
                                  <SupplierLogo supplierName={s.name} size={18} />
                                  <span className="truncate">{s.name}</span>
                                </span>
                                {s.sku ? (
                                  <span className="pl-[26px] font-mono text-[10px] text-[var(--dc-muted,#64748b)] truncate" title={s.sku}>
                                    SKU {s.sku}
                                  </span>
                                ) : null}
                              </span>
                              <span className={`font-mono text-[12px] font-semibold flex items-center gap-1.5 justify-end ${!s.stock ? "line-through text-[var(--dc-muted,#64748b)]" : "text-[var(--dc-text,#0f172a)]"}`}>
                                £{s.price.toFixed(2)}
                                {isBest && best && p.suppliers.filter(x => x.stock).length > 1 && (
                                  <span className="hidden 2xl:inline font-mono text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-semibold tracking-wider whitespace-nowrap">
                                    −£{Math.max(0, maxPrice - s.price).toFixed(2)}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                        {sorted.length > 3 && (
                          <p className="mt-2 text-center text-[11px] text-[var(--dc-muted,#64748b)]">
                            + {sorted.length - 3} more supplier{sorted.length - 3 !== 1 ? "s" : ""}
                          </p>
                        )}

                        {/* CTA — guests and signed-in users can add; checkout still requires sign-in + supplier link */}
                        {cartTarget ? (
                <button
                            type="button"
                            onClick={() => addToCart(p.id, cartTarget.name, cartTarget.price, p.name, p.category, p.saving ?? 0)}
                            className={`mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                              inCart
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-[var(--dc-accent,#c3b1e1)] text-[#121019] hover:brightness-110 shadow-[0_8px_24px_rgba(17,17,17,0.22)]"
                            } ${isJustAdded ? "scale-[0.98]" : ""}`}
                          >
                            {inCart ? "✓ Added to cart" : `Add to cart · £${cartTarget.price.toFixed(2)}`}
                </button>
                        ) : null}
              </div>
            </div>
                  );
                })}
              </div>
            )}

            {/* Connect banner */}
            {!loading && products.length > 0 && clinicFiltered && connectedSupplierCount === 0 && (
              <div className="mt-6 rounded-2xl border border-[var(--dc-border)] bg-gradient-to-br from-[rgba(17,17,17,0.05)] to-[rgba(195,177,225,0.1)] p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--dc-surface,#ffffff)] flex items-center justify-center clinic-serif text-2xl italic text-[var(--dc-accent-strong,#111111)] flex-shrink-0">
                  +
              </div>
                <div className="flex-1 text-sm leading-relaxed text-[var(--dc-text,#0f172a)] min-w-0">
                  <b>Connect a supplier?</b> Henry Schein, Kent Express or Dental Sky in 2 minutes — Dentago pulls your account prices automatically.
                </div>
                <Link
                  href="/settings?tab=integrations"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--dc-accent,#c3b1e1)] text-[#121019] text-sm font-semibold hover:brightness-110 transition-all shadow-[0_8px_24px_rgba(17,17,17,0.22)] flex-shrink-0"
                >
                  Connect supplier
                </Link>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                  className="px-4 py-2 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] text-sm font-medium text-[var(--dc-text,#0f172a)] hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                  ← Prev
              </button>
                <span className="font-mono text-xs text-[var(--dc-muted,#64748b)]">
                  Page {page} of {totalPages}
                </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                  className="px-4 py-2 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface,#ffffff)] text-sm font-medium text-[var(--dc-text,#0f172a)] hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                  Next →
              </button>
            </div>
          )}
        </main>
      </div>
            </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[var(--dc-muted,#64748b)] text-sm">
          Loading marketplace…
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
