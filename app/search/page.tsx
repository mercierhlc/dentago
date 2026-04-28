"use client";
import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CATEGORY_META, ALL_CATEGORIES, ALL_SUPPLIERS } from "@/lib/products";
import { getClinic, getToken, clearAuth, freshAuthHeaders } from "@/lib/auth";
import ProfileMenu from "@/components/ProfileMenu";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiSupplier = {
  name: string; id: number; price: number; stock: boolean;
  delivery: string; sku: string; packSize?: string;
};

type ApiProduct = {
  id: number; name: string; brand: string; category: string;
  image: string; packSize: string; description: string;
  suppliers: ApiSupplier[];
  bestPrice: number | null;
  bestSupplier: ApiSupplier | null;
  saving: number;
  inStockCount: number;
  totalSuppliers: number;
};

type CartItem = { supplier: string; price: number; name: string; category: string; saving: number };

// ─── Placeholder cycling search ───────────────────────────────────────────────

const PLACEHOLDERS = [
  "Search gloves, articaine, composite…",
  "Try ProTaper Gold or FFP2 masks…",
  "Search by brand: Septodont, 3M ESPE…",
  "Search by SKU or product name…",
];

function useCyclingPlaceholder() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(t);
  }, []);
  return PLACEHOLDERS[i];
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product, cart, onAdd,
}: { product: ApiProduct; cart: Record<number, CartItem>; onAdd: (id: number, supplier: string, price: number, name: string, category: string, saving: number) => void }) {
  const [imgError, setImgError] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const inCart = cart[product.id];

  // Silently fetch live DD Group prices for this product
  useEffect(() => {
    const ddSuppliers = product.suppliers.filter(s => s.name === "DD Group" && s.sku);
    if (ddSuppliers.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const s of ddSuppliers) {
        try {
          const res = await fetch(`/api/live-price?sku=${encodeURIComponent(s.sku)}`);
          if (!res.ok || cancelled) continue;
          const data = await res.json();
          if (data.price && Math.abs(data.price - s.price) > 0.001) {
            setLivePrices(prev => ({ ...prev, [s.sku]: data.price }));
          }
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [product.id]);

  function handleAdd(supplierName: string, price: number) {
    // saving = difference between this price and the most expensive supplier (in-stock or not)
    const allPrices = product.suppliers.map(s => s.price).filter(p => p > 0);
    const maxPrice = allPrices.length > 1 ? Math.max(...allPrices) : price;
    const saving = parseFloat(Math.max(0, maxPrice - price).toFixed(2));
    onAdd(product.id, supplierName, price, product.name, product.category, saving);
    setJustAdded(supplierName);
    setTimeout(() => setJustAdded(null), 1400);
  }
  const meta = CATEGORY_META[product.category] ?? { icon: "inventory_2", color: "#6C3DE8", bg: "#f5f3ff" };
  const sorted = [...product.suppliers].sort((a, b) => {
    if (a.stock && !b.stock) return -1;
    if (!a.stock && b.stock) return 1;
    return a.price - b.price;
  });
  const best = product.bestSupplier;

  return (
    <div
      className={`group relative bg-white rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col ${
        inCart
          ? "border-[#6C3DE8]/40 shadow-[0_0_0_2px_rgba(108,61,232,0.08),0_8px_32px_rgba(108,61,232,0.08)]"
          : "border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_56px_rgba(108,61,232,0.12)] hover:border-[#6C3DE8]/20 hover:-translate-y-1.5"
      }`}
    >
      {/* Product image — taller */}
      <Link href={`/product/${product.id}`} className="block relative h-52 overflow-hidden flex-shrink-0 bg-white">
        {!imgError && product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            unoptimized
            className="object-contain p-6 group-hover:scale-105 transition-transform duration-700 ease-out"
            sizes="400px"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: `${meta.color}15`, border: `1.5px solid ${meta.color}25` }}>
              <span className="material-symbols-outlined text-[44px]" style={{ color: meta.color, fontVariationSettings: "'FILL' 1" }}>
                {meta.icon}
              </span>
            </div>
          </div>
        )}
        {/* Category pill */}
        <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-md"
          style={{ background: `${meta.color}e0`, color: "white" }}>
          {product.category}
        </span>
        {/* Savings badge */}
        {product.saving > 0.5 && (
          <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full shadow-sm">
            Save £{product.saving.toFixed(2)}
          </span>
        )}
        {/* In cart indicator */}
        {inCart && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 bg-[#6C3DE8] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            In cart
          </span>
        )}
      </Link>

      {/* Name / brand */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{product.brand}</p>
          <p className="text-[10px] text-slate-400 font-medium flex-shrink-0 bg-slate-50 px-2 py-0.5 rounded-full">{product.packSize}</p>
        </div>
        <Link href={`/product/${product.id}`}>
          <h3 className="text-[15px] font-bold text-[#151121] leading-snug line-clamp-2 hover:text-[#6C3DE8] transition-colors">
            {product.name}
          </h3>
        </Link>
      </div>

      {/* Supplier price rows */}
      <div className="px-4 pb-3 flex-1">
        {sorted.length > 0 ? (
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            {sorted.slice(0, 4).map((s, idx) => {
              const displayPrice = (s.name === "DD Group" && s.sku && livePrices[s.sku]) ? livePrices[s.sku] : s.price;
              const priceUpdated = s.name === "DD Group" && s.sku && !!livePrices[s.sku];
              const isBest = s.stock && s.price === best?.price && s.name === best?.name;
              return (
                <div
                  key={s.name}
                  className={`flex items-center gap-2.5 px-3 py-2 ${idx !== 0 ? "border-t border-slate-100" : ""} ${isBest ? "bg-[#6C3DE8]/[0.04]" : ""}`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isBest ? "bg-[#6C3DE8]" : s.stock ? "bg-emerald-400" : "bg-slate-200"}`} />
                  <p className="text-xs font-semibold text-slate-600 flex-1 truncate">{s.name}</p>

                  {isBest && (
                    <span className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: `${meta.color}18`, color: meta.color }}>Best</span>
                  )}
                  {!s.stock && (
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">OOS</span>
                  )}

                  <div className="flex flex-col items-end flex-shrink-0">
                    <p className={`text-[13px] font-extrabold ${isBest ? "text-[#6C3DE8]" : s.stock ? "text-slate-700" : "text-slate-300 line-through"}`}>
                      £{displayPrice.toFixed(2)}
                    </p>
                    {s.name !== "Dental Sky" && s.name !== "DD Group" && (
                      <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wide leading-none">est.</span>
                    )}
                    {priceUpdated && (
                      <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-wide leading-none">live</span>
                    )}
                  </div>

                  {s.stock && (
                    <button
                      onClick={() => handleAdd(s.name, s.price)}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                        justAdded === s.name
                          ? "bg-emerald-500 text-white animate-cart-success"
                          : inCart?.supplier === s.name
                          ? "bg-[#6C3DE8] text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-[#6C3DE8]/10 hover:text-[#6C3DE8] active:scale-90"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {justAdded === s.name || inCart?.supplier === s.name ? "check" : "add"}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
            {sorted.length > 4 && (
              <Link href={`/product/${product.id}`}
                className="flex items-center justify-center py-2 border-t border-slate-100 text-[10px] font-bold text-slate-400 hover:text-[#6C3DE8] transition-colors gap-1">
                <span className="material-symbols-outlined text-[12px]">add</span>
                {sorted.length - 4} more suppliers
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-2xl px-4 py-3 bg-slate-50 text-center border border-slate-100">
            <p className="text-sm text-slate-400 font-medium">No suppliers available</p>
          </div>
        )}
      </div>

      {/* Add Best Price CTA */}
      <div className="px-4 pb-4">
        {best ? (
          <button
            onClick={() => handleAdd(best.name, best.price)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all duration-200 active:scale-[0.98] ${
              justAdded === best.name
                ? "bg-emerald-500 text-white animate-cart-success shadow-lg shadow-emerald-500/25"
                : inCart?.supplier === best.name
                ? "bg-[#6C3DE8]/10 text-[#6C3DE8] border border-[#6C3DE8]/20"
                : "bg-[#6C3DE8] text-white hover:brightness-110 hover:shadow-xl hover:shadow-[#6C3DE8]/30 shadow-md shadow-[#6C3DE8]/20"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: justAdded === best.name ? "'FILL' 1" : "'FILL' 0" }}>
              {justAdded === best.name ? "check_circle" : inCart?.supplier === best.name ? "check" : "add_shopping_cart"}
            </span>
            {justAdded === best.name ? "Added!" : inCart?.supplier === best.name ? "Added to Cart" : `Add Best Price · £${best.price.toFixed(2)}`}
          </button>
        ) : (
          <div className="w-full py-3 rounded-2xl text-sm font-bold text-center text-slate-400 bg-slate-50 border border-slate-100">
            Out of stock everywhere
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function SearchContent() {
  const searchParams = useSearchParams();
  const placeholder = useCyclingPlaceholder();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"best_price" | "saving" | "name">("best_price");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceMax, setPriceMax] = useState(1000);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [cart, setCart] = useState<Record<number, CartItem>>({});
  const [showCart, setShowCart] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  // Auth state
  const [clinic, setClinic] = useState<{ id: string; clinic_name: string; email: string } | null>(null);
  const [clinicFiltered, setClinicFiltered] = useState(false);
  const [connectedSupplierCount, setConnectedSupplierCount] = useState<number | null>(null);

  // Live API state
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
    setClinic(getClinic());
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams]);

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
      limit: "30",
    });
    if (selectedSuppliers.length === 1) {
      params.set("supplier", selectedSuppliers[0]);
    }

    try {
      const res = await fetch(`/api/search?${params}`, { headers: await freshAuthHeaders() });
      const data = await res.json();
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.pages ?? 1);
      setClinicFiltered(data.clinicFiltered ?? false);
      setConnectedSupplierCount(data.connectedSupplierCount ?? null);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [query, activeCategory, inStockOnly, priceMax, sortBy, selectedSuppliers, page]);

  // Debounce fetch on filter changes (always reset to page 1)
  useEffect(() => {
    const t = setTimeout(() => fetchProducts(true), query ? 300 : 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeCategory, inStockOnly, priceMax, sortBy, selectedSuppliers]);

  // Fetch when page changes (pagination clicks)
  useEffect(() => {
    fetchProducts(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function addToCart(id: number, supplier: string, price: number, name: string, category: string, saving: number) {
    setCart(prev => ({ ...prev, [id]: { supplier, price, name, category, saving } }));
    // Persist to database if logged in
    const token = getToken();
    if (token) {
      // Find supplierId from the product's supplier list
      const product = products.find(p => p.id === id);
      const supplierRow = product?.suppliers.find(s => s.name === supplier);
      if (supplierRow) {
        freshAuthHeaders().then(headers =>
          fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({ productId: id, supplierId: supplierRow.id, quantity: 1, unitPrice: price }),
          })
        ).catch(() => {});
      }
    }
  }

  const cartItems = Object.entries(cart);
  const cartTotal = cartItems.reduce((sum, [, item]) => sum + item.price, 0);
  const cartSavings = cartItems.reduce((sum, [, item]) => sum + (item.saving ?? 0), 0);
  const annualSavings = cartSavings * 52;

  function toggleSupplier(s: string) {
    setSelectedSuppliers(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121] animate-page-in">
      {/* ── NAV ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 h-14 max-w-[1600px] mx-auto">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-[#6C3DE8] flex-shrink-0">Dentago</Link>

          <form onSubmit={e => e.preventDefault()} className="hidden sm:flex flex-1 max-w-2xl mx-3">
            <div className="flex items-center w-full bg-[#f7f9fb] rounded-xl border border-slate-200 px-4 gap-2 focus-within:border-[#6C3DE8] focus-within:bg-white focus-within:shadow-lg focus-within:shadow-[#6C3DE8]/10 transition-all">
              <svg className="flex-shrink-0 text-slate-400" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm text-[#151121] placeholder:text-slate-400 py-2.5 outline-none font-medium min-w-0"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          </form>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"/>
              15 UK Suppliers Live
            </div>
            <Link
              href="/cart"
              className="relative flex items-center gap-1.5 bg-[#6C3DE8] text-white px-3 py-2 rounded-xl text-sm font-bold hover:brightness-110 hover:shadow-lg hover:shadow-[#6C3DE8]/30 active:scale-95 transition-all shadow-md shadow-[#6C3DE8]/20"
            >
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
              <span className="hidden sm:inline">Cart</span>
              {cartItems.length > 0 && (
                <span key={cartItems.length} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center animate-badge-pop">
                  {cartItems.length}
                </span>
              )}
            </Link>
            <ProfileMenu clinic={clinic} />
          </div>
        </div>

        <div className="sm:hidden px-4 pb-3">
          <div className="flex items-center bg-[#f7f9fb] rounded-xl border border-slate-200 px-3 gap-2 focus-within:border-[#6C3DE8] focus-within:bg-white transition-all">
            <svg className="flex-shrink-0 text-slate-400" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products…"
              className="flex-1 bg-transparent text-sm text-[#151121] placeholder:text-slate-400 py-2.5 outline-none font-medium"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-slate-400">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="pt-[100px] sm:pt-14 flex max-w-[1600px] mx-auto">

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={`
          fixed md:static top-0 left-0 h-full md:h-auto z-50 md:z-auto
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${sidebarOpen ? "md:w-64 md:flex-shrink-0" : "md:w-0 md:overflow-hidden"}
          w-72 md:w-64 bg-white md:bg-transparent shadow-2xl md:shadow-none
        `}>
          <div className="sticky top-0 md:top-14 h-screen md:h-[calc(100vh-3.5rem)] overflow-y-auto px-4 pt-6 pb-10 w-72 md:w-64">

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Filters</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => {
                  setActiveCategory("All");
                  setInStockOnly(false);
                  setPriceMax(1000);
                  setSelectedSuppliers([]);
                  setQuery("");
                }} className="text-[10px] font-bold text-[#6C3DE8] hover:opacity-70 transition-opacity">
                  Clear all
                </button>
                <button onClick={() => setSidebarOpen(false)} className="md:hidden w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* Categories */}
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Category</p>
              <div className="space-y-0.5">
                {ALL_CATEGORIES.map(cat => {
                  const meta = CATEGORY_META[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        activeCategory === cat
                          ? "bg-[#6C3DE8] text-white shadow-md shadow-[#6C3DE8]/20"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {meta && (
                        <span className="material-symbols-outlined text-[14px]"
                          style={{ fontVariationSettings: "'FILL' 1", color: activeCategory === cat ? "white" : meta.color }}>
                          {meta.icon}
                        </span>
                      )}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-slate-100 my-5" />

            {/* In stock toggle */}
            <div className="mb-6">
              <button
                onClick={() => setInStockOnly(!inStockOnly)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-100 bg-white hover:border-[#6C3DE8]/30 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-sm font-semibold text-slate-700">In Stock Only</span>
                </div>
                <div className={`w-9 h-5 rounded-full transition-colors relative ${inStockOnly ? "bg-[#6C3DE8]" : "bg-slate-200"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${inStockOnly ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
              </button>
            </div>

            {/* Price range */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Max Price</p>
                <span className="text-sm font-bold text-[#6C3DE8]">£{priceMax === 1000 ? "Any" : priceMax}</span>
              </div>
              <input
                type="range" min="5" max="1000" step="5"
                value={priceMax}
                onChange={e => setPriceMax(Number(e.target.value))}
                className="w-full accent-[#6C3DE8] h-1.5 rounded-full"
              />
              <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-medium">
                <span>£5</span><span>£1,000+</span>
              </div>
            </div>

            <div className="h-px bg-slate-100 my-5" />

            {/* Suppliers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier</p>
                {selectedSuppliers.length > 0 && (
                  <button onClick={() => setSelectedSuppliers([])} className="text-[9px] font-bold text-[#6C3DE8]">Clear</button>
                )}
              </div>
              <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
                {ALL_SUPPLIERS.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleSupplier(s)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedSuppliers.includes(s) ? "bg-[#6C3DE8]/8 text-[#6C3DE8]" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 transition-all ${
                      selectedSuppliers.includes(s) ? "bg-[#6C3DE8] border-[#6C3DE8]" : "border-slate-300"
                    }`}>
                      {selectedSuppliers.includes(s) && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      )}
                    </div>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 pt-4 sm:pt-6 pb-16">

          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#6C3DE8] transition-colors border border-slate-200 bg-white px-3 py-2 rounded-xl hover:border-[#6C3DE8]/30 flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span className="hidden sm:inline">{sidebarOpen ? "Hide" : "Filters"}</span>
            </button>

            <div className="flex-1 min-w-0">
              {loading ? (
                <p className="text-sm text-slate-400 font-medium animate-pulse">Searching…</p>
              ) : (
                <p className="text-sm text-slate-500 truncate">
                  <span className="font-bold text-[#151121]">{total}</span>
                  {" "}product{total !== 1 ? "s" : ""}
                  {activeCategory !== "All" && <span className="text-[#6C3DE8] font-semibold hidden sm:inline"> · {activeCategory}</span>}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-600 flex-shrink-0">
              <span className="material-symbols-outlined text-[14px] text-slate-400 hidden sm:inline">sort</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="bg-transparent outline-none cursor-pointer font-bold text-slate-700 text-xs max-w-[90px] sm:max-w-none"
              >
                <option value="best_price">Best Price</option>
                <option value="saving">Top Savings</option>
                <option value="name">A–Z</option>
              </select>
            </div>

            <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 flex-shrink-0">
              {(["grid", "list"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    view === v ? "bg-[#6C3DE8] text-white shadow" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {v === "grid" ? "grid_view" : "view_list"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Clinic supplier filter banner */}
          {clinicFiltered && (
            <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-[#6C3DE8]/5 border border-[#6C3DE8]/15 rounded-xl">
              <span className="material-symbols-outlined text-[16px] text-[#6C3DE8]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <p className="text-xs font-semibold text-[#6C3DE8] flex-1">
                {connectedSupplierCount && connectedSupplierCount > 0
                  ? `Showing all suppliers · ${connectedSupplierCount} connected to your account`
                  : "No suppliers connected yet — showing all market prices"}
              </p>
              <Link href="/clinic/suppliers" className="text-[10px] font-bold text-[#6C3DE8] underline underline-offset-2 flex-shrink-0">
                Manage suppliers
              </Link>
            </div>
          )}

          {/* Active filter chips */}
          {(activeCategory !== "All" || inStockOnly || priceMax < 1000 || selectedSuppliers.length > 0 || query) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {query && (
                <span className="inline-flex items-center gap-1.5 bg-[#6C3DE8]/8 text-[#6C3DE8] text-xs font-bold px-3 py-1.5 rounded-full">
                  &ldquo;{query}&rdquo;
                  <button onClick={() => setQuery("")} className="hover:opacity-70"><svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </span>
              )}
              {activeCategory !== "All" && (
                <span className="inline-flex items-center gap-1.5 bg-[#6C3DE8]/8 text-[#6C3DE8] text-xs font-bold px-3 py-1.5 rounded-full">
                  {activeCategory}
                  <button onClick={() => setActiveCategory("All")} className="hover:opacity-70"><svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </span>
              )}
              {inStockOnly && (
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-xs font-bold px-3 py-1.5 rounded-full">
                  In stock only
                  <button onClick={() => setInStockOnly(false)} className="hover:opacity-70"><svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </span>
              )}
              {priceMax < 1000 && (
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full">
                  Under £{priceMax}
                  <button onClick={() => setPriceMax(1000)} className="hover:opacity-70"><svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </span>
              )}
              {selectedSuppliers.map(s => (
                <span key={s} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full">
                  {s}
                  <button onClick={() => toggleSupplier(s)} className="hover:opacity-70"><svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </span>
              ))}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && products.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                  <div className="h-52 shimmer" />
                  <div className="p-4 space-y-3">
                    <div className="h-3 shimmer rounded-full w-1/3" />
                    <div className="h-5 shimmer rounded-full w-3/4" />
                    <div className="h-24 shimmer rounded-2xl" />
                    <div className="h-11 shimmer rounded-2xl" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grid / List */}
          {!loading && products.length > 0 && (
            view === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {products.map((p, i) => (
                  <div key={p.id} className="animate-card-reveal" style={{ animationDelay: `${Math.min(i * 40, 300)}ms`, opacity: 0 }}>
                    <ProductCard product={p} cart={cart} onAdd={addToCart} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {products.map(p => {
                  const best = p.bestSupplier;
                  const inCart = cart[p.id];
                  const meta = CATEGORY_META[p.category] ?? { icon: "inventory_2", color: "#6C3DE8", bg: "#f5f3ff" };
                  const sorted = [...p.suppliers].sort((a, b) => {
                    if (a.stock && !b.stock) return -1;
                    if (!a.stock && b.stock) return 1;
                    return a.price - b.price;
                  });

                  return (
                    <div key={p.id} className={`bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-lg ${
                      inCart ? "border-[#6C3DE8]/30" : "border-slate-100 shadow-sm"
                    }`}>
                      <div className="flex items-start gap-3 px-4 py-4 border-b border-slate-100">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: meta.bg }}>
                          <span className="material-symbols-outlined text-[20px]"
                            style={{ color: meta.color, fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                              style={{ background: `${meta.color}15`, color: meta.color }}>{p.category}</span>
                            {p.saving > 0.5 && (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                                Save £{p.saving.toFixed(2)}
                              </span>
                            )}
                            {inCart && (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#6C3DE8]/8 text-[#6C3DE8]">
                                In cart
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-[#151121] leading-snug line-clamp-2">{p.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{p.brand}</p>
                          {best && (
                            <div className="flex items-center gap-2 mt-2 sm:hidden">
                              <span className="text-base font-extrabold" style={{ color: meta.color }}>£{best.price.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-400">{best.name}</span>
                              <button
                                onClick={() => addToCart(p.id, best.name, best.price, p.name, p.category, p.saving ?? 0)}
                                className={`ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  inCart ? "bg-[#6C3DE8]/10 text-[#6C3DE8]" : "bg-[#6C3DE8] text-white"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[13px]">{inCart ? "check" : "add"}</span>
                                {inCart ? "Added" : "Add"}
                              </button>
                            </div>
                          )}
                        </div>
                        {best && (
                          <>
                            <div className="hidden sm:block flex-shrink-0 text-right">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Best Price</p>
                              <p className="text-xl font-extrabold" style={{ color: meta.color }}>£{best.price.toFixed(2)}</p>
                              <p className="text-[10px] text-slate-400">{best.name}</p>
                            </div>
                            <button
                              onClick={() => addToCart(p.id, best.name, best.price, p.name, p.category, p.saving ?? 0)}
                              className={`hidden sm:flex flex-shrink-0 items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                inCart ? "bg-[#6C3DE8]/10 text-[#6C3DE8]" : "bg-[#6C3DE8] text-white hover:brightness-110 shadow-md shadow-[#6C3DE8]/20"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]">{inCart ? "check" : "add_shopping_cart"}</span>
                              {inCart ? "Added" : "Add Best"}
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex overflow-x-auto divide-x divide-slate-100" style={{ scrollbarWidth: "none" }}>
                        {sorted.slice(0, 5).map(s => {
                          const isBest = s.stock && s.price === best?.price && s.name === best?.name;
                          return (
                            <div key={s.name} className={`flex-shrink-0 min-w-[130px] px-3 py-2.5 ${isBest ? "bg-[#6C3DE8]/3" : ""}`}>
                              <div className="flex items-center gap-1 mb-1">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isBest ? "bg-[#6C3DE8]" : s.stock ? "bg-emerald-400" : "bg-slate-300"}`} />
                                <p className="text-[10px] font-bold text-slate-500 truncate">{s.name}</p>
                              </div>
                              <p className={`text-sm font-extrabold ${isBest ? "text-[#6C3DE8]" : s.stock ? "text-slate-800" : "text-slate-300 line-through"}`}>
                                £{s.price.toFixed(2)}
                              </p>
                              <p className="text-[9px] text-slate-400">{s.stock ? s.delivery : "Out of stock"}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Empty state */}
          {!loading && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-20 h-20 rounded-3xl bg-[#6C3DE8]/8 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[40px] text-[#6C3DE8]">search_off</span>
              </div>
              <h3 className="text-xl font-extrabold text-[#151121] mb-2">No products found</h3>
              <p className="text-slate-500 text-sm font-medium mb-6">Try adjusting your search or clearing some filters</p>
              <button
                onClick={() => { setQuery(""); setActiveCategory("All"); setInStockOnly(false); setPriceMax(1000); setSelectedSuppliers([]); }}
                className="bg-[#6C3DE8] text-white px-6 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
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
        </main>
      </div>

      {/* ── CART PANEL ── */}
      {showCart && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setShowCart(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-[#151121]">Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <span className="material-symbols-outlined text-[48px] text-slate-300 mb-4">shopping_cart</span>
                  <p className="text-slate-400 font-medium text-sm">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map(([id, item]) => {
                    const meta = CATEGORY_META[item.category] ?? { color: "#6C3DE8", bg: "#f5f3ff", icon: "inventory_2" };
                    return (
                      <div key={id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                          <span className="material-symbols-outlined text-[18px]" style={{ color: meta.color, fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#151121] leading-snug line-clamp-2">{item.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{item.supplier}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-extrabold text-[#6C3DE8]">£{item.price.toFixed(2)}</p>
                          <button
                            onClick={() => setCart(prev => { const n = { ...prev }; delete n[Number(id)]; return n; })}
                            className="text-[9px] text-slate-400 hover:text-red-500 transition-colors font-medium"
                          >Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {cartItems.length > 0 && (
              <div className="px-6 py-5 border-t border-slate-100">
                {cartSavings > 0.01 && (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-4">
                    <span className="material-symbols-outlined text-emerald-500 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
                    <div>
                      <p className="text-xs font-black text-emerald-700">You're saving £{cartSavings.toFixed(2)} on this order</p>
                      <p className="text-[10px] text-emerald-600 font-medium">That's ~£{annualSavings >= 1000 ? `${(annualSavings / 1000).toFixed(1)}k` : Math.round(annualSavings)} per year if ordered weekly</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-600">{cartItems.length} item{cartItems.length !== 1 ? "s" : ""}</span>
                  <span className="text-xl font-extrabold text-[#151121]">£{cartTotal.toFixed(2)}</span>
                </div>
                <Link
                  href={`/cart?items=${encodeURIComponent(JSON.stringify(cart))}`}
                  className="w-full flex items-center justify-center gap-2 bg-[#6C3DE8] text-white py-4 rounded-xl font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-[#6C3DE8]/20"
                >
                  <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
                  Proceed to Checkout
                </Link>
                <p className="text-[10px] text-slate-400 text-center mt-3 font-medium">Orders routed to individual suppliers automatically</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
