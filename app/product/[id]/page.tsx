"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { PRODUCTS, getBest, CATEGORY_META, type Product, type Supplier } from "@/lib/products";
import { getToken, freshAuthHeaders } from "@/lib/auth";

function fmt(n: number) { return `£${n.toFixed(2)}`; }

function ProductImage({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(false);
  if (err) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-300">
      <span className="material-symbols-outlined text-[72px]">image_not_supported</span>
      <span className="text-sm text-slate-400">{name}</span>
    </div>
  );
  return <Image src={src} alt={name} fill className="object-contain p-10" unoptimized onError={() => setErr(true)} />;
}

function StockBadge({ stock }: { stock: boolean }) {
  return stock ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />In Stock
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Out of Stock
    </span>
  );
}

function SimilarCard({ product }: { product: Product }) {
  const best = getBest(product.suppliers);
  const meta = CATEGORY_META[product.category];
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link href={`/product/${product.id}`}
      className="flex-shrink-0 w-60 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(108,61,232,0.10)] hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
      <div className="relative h-40" style={{ background: meta?.bg || "#f5f3ff" }}>
        {imgErr ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[44px]" style={{ color: meta?.color || "#6C3DE8", fontVariationSettings: "'FILL' 1" }}>
              {meta?.icon || "inventory_2"}
            </span>
          </div>
        ) : (
          <Image src={product.image} alt={product.name} fill className="object-contain p-4" unoptimized onError={() => setImgErr(true)} />
        )}
      </div>
      <div className="p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{product.brand}</p>
        <p className="text-sm font-bold text-[#151121] leading-snug line-clamp-2 group-hover:text-[#6C3DE8] transition-colors mb-2">{product.name}</p>
        {best && <p className="text-base font-extrabold text-[#6C3DE8]">{fmt(best.price)}</p>}
      </div>
    </Link>
  );
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const product = PRODUCTS.find(p => p.id === Number(id));

  const [cart, setCart] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  // Map supplier name → database id (fetched from API)
  const [supplierIds, setSupplierIds] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!product) return;
    freshAuthHeaders().then(headers =>
      fetch(`/api/products/${product.id}`, { headers })
        .then(r => r.json())
        .then(data => {
          if (data.suppliers) {
            const map: Record<string, number> = {};
            for (const s of data.suppliers) { if (s.id) map[s.name] = s.id; }
            setSupplierIds(map);
          }
        })
        .catch(() => {})
    );
  }, [product]);

  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f7f9fb]">
      <span className="material-symbols-outlined text-6xl text-slate-300">search_off</span>
      <h1 className="text-xl font-semibold text-slate-600">Product not found</h1>
      <Link href="/search" className="text-[#6C3DE8] font-bold hover:underline">Browse all products</Link>
    </div>
  );

  const best = getBest(product.suppliers);
  const meta = CATEGORY_META[product.category];
  const allOutOfStock = product.suppliers.every(s => !s.stock);
  const similarsData = product.similars.map(sid => PRODUCTS.find(p => p.id === sid)).filter(Boolean) as Product[];

  async function addToCart(supplier: Supplier) {
    const key = supplier.name;
    const q = qty[key] || 1;
    setCart(c => ({ ...c, [key]: (c[key] || 0) + q }));
    setToast(`${supplier.name} — ${q} × added`);
    setJustAdded(key);
    setTimeout(() => setToast(null), 2500);
    setTimeout(() => setJustAdded(null), 1400);

    // Persist to cart API
    const token = getToken();
    const supplierId = supplierIds[supplier.name];
    if (token && supplierId) {
      const headers = await freshAuthHeaders();
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          productId: product!.id,
          supplierId,
          quantity: q,
          unitPrice: supplier.price,
        }),
      }).catch(() => {});
    }
  }

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const sortedSuppliers = [...product.suppliers].sort((a, b) => {
    if (a.stock && !b.stock) return -1;
    if (!a.stock && b.stock) return 1;
    return a.price - b.price;
  });

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#151121] animate-page-in">

      {/* ── Floating Nav ── */}
      <div className="fixed top-0 w-full z-50 px-4 pt-4">
        <div className="max-w-6xl mx-auto bg-white/75 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-2xl px-6 h-14 flex items-center gap-3">
          <Link href="/" className="text-lg font-extrabold tracking-tighter text-[#6C3DE8] flex-shrink-0">Dentago</Link>
          <span className="text-slate-200">/</span>
          <Link href="/search" className="text-sm font-medium text-slate-400 hover:text-[#6C3DE8] transition-colors hidden sm:block">Marketplace</Link>
          <span className="text-slate-200 hidden sm:block">/</span>
          <span className="text-sm font-medium truncate text-slate-600 hidden sm:block" style={{ color: meta?.color }}>{product.category}</span>
          <span className="text-slate-200 hidden sm:block">/</span>
          <span className="text-sm font-medium truncate text-slate-600 hidden sm:block flex-1">{product.name}</span>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <Link href="/search" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#6C3DE8] px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>Back
            </Link>
            <Link href="/cart" className="relative flex items-center gap-1.5 bg-[#6C3DE8] text-white text-sm font-bold px-4 py-1.5 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-md shadow-[#6C3DE8]/20">
              <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
              Cart
              {totalItems > 0 && (
                <span key={totalItems} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-pink-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-badge-pop">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-28 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#151121] text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-fade-up">
          <span className="material-symbols-outlined text-emerald-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toast}
        </div>
      )}

      <main className="pt-28 max-w-6xl mx-auto px-5 pb-32 space-y-6">

        {/* ── Out of stock alert ── */}
        {allOutOfStock && similarsData.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex gap-3 items-start">
            <span className="material-symbols-outlined text-amber-500 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <div>
              <p className="font-bold text-amber-800">Currently out of stock with all suppliers</p>
              <p className="text-sm text-amber-700 mt-0.5">See clinical equivalents below — similar products available from stock.</p>
            </div>
          </div>
        )}

        {/* ── Product hero ── */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left */}
          <div className="space-y-5">
            {/* Image card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="relative h-80 sm:h-[420px] bg-white">
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: `radial-gradient(circle, ${meta?.color || "#6C3DE8"} 1px, transparent 1px)`,
                  backgroundSize: "24px 24px",
                }} />
                <ProductImage src={product.image} name={product.name} />
              </div>
            </div>

            {/* Info card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] p-7">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: meta?.bg || "#f5f3ff" }}>
                  <span className="material-symbols-outlined text-2xl" style={{ color: meta?.color || "#6C3DE8", fontVariationSettings: "'FILL' 1" }}>
                    {meta?.icon || "inventory_2"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">{product.brand} · {product.category}</p>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#151121] leading-tight tracking-tight">{product.name}</h1>
                </div>
              </div>

              <p className="text-slate-600 leading-relaxed mb-5">{product.description}</p>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-medium text-slate-700">
                  <span className="material-symbols-outlined text-base text-slate-400">inventory_2</span>
                  {product.packSize}
                </span>
                {best && (
                  <span className="inline-flex items-center gap-1.5 bg-[#6C3DE8]/6 border border-[#6C3DE8]/15 rounded-xl px-3 py-1.5 text-sm font-bold text-[#6C3DE8]">
                    <span className="material-symbols-outlined text-base">savings</span>
                    From {fmt(best.price)}
                  </span>
                )}
              </div>
            </div>

            {/* Specs */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-7 py-5 border-b border-slate-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-slate-400">list_alt</span>
                <h2 className="font-bold text-[#151121]">Technical Specifications</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {product.specs.map((spec) => (
                  <div key={spec.label} className="flex justify-between gap-4 px-7 py-4 hover:bg-slate-50/60 transition-colors">
                    <span className="text-sm text-slate-500 font-medium">{spec.label}</span>
                    <span className="text-sm text-[#151121] font-bold text-right">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — pricing panel */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-4">

            {/* Supplier cards */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
                <h2 className="font-bold text-[#151121] flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-slate-400">storefront</span>
                  {product.suppliers.length} Suppliers
                </h2>
                {best && (
                  <div className="text-right">
                    <p className="text-xs text-slate-400 mb-0.5">Best price</p>
                    <p className="text-2xl font-extrabold text-[#6C3DE8] tracking-tight">{fmt(best.price)}</p>
                    <p className="text-xs text-slate-400">{best.name}</p>
                  </div>
                )}
              </div>

              <div className="p-5 space-y-3">
                {sortedSuppliers.map((supplier, idx) => {
                  const key = supplier.name;
                  const q = qty[key] || 1;
                  const isTop = idx === 0 && supplier.stock;
                  return (
                    <div key={supplier.sku}
                      className={`rounded-2xl border p-4 transition-all ${isTop
                        ? "border-[#6C3DE8]/25 bg-[#6C3DE8]/[0.03] shadow-[0_0_0_1px_rgba(108,61,232,0.08)]"
                        : "border-slate-100 bg-slate-50/60"}`}>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {isTop && (
                            <span className="text-[10px] font-black bg-[#6C3DE8] text-white px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">Best</span>
                          )}
                          <span className={`font-bold truncate ${isTop ? "text-[#6C3DE8]" : "text-[#151121]"}`}>{supplier.name}</span>
                        </div>
                        <span className={`text-xl font-extrabold tracking-tight flex-shrink-0 ${supplier.stock ? "text-[#151121]" : "text-slate-300"}`}>
                          {fmt(supplier.price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <StockBadge stock={supplier.stock} />
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">local_shipping</span>
                          {supplier.delivery}
                        </span>
                      </div>
                      {supplier.stock && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden">
                            <button onClick={() => setQty(q2 => ({ ...q2, [key]: Math.max(1, (q2[key] || 1) - 1) }))}
                              className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors font-bold text-lg active:scale-90">−</button>
                            <input
                              type="number" min="1" value={q}
                              onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setQty(q2 => ({ ...q2, [key]: v })); }}
                              className="w-10 text-sm font-extrabold text-[#151121] text-center bg-transparent outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button onClick={() => setQty(q2 => ({ ...q2, [key]: (q2[key] || 1) + 1 }))}
                              className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors font-bold text-lg active:scale-90">+</button>
                          </div>
                          <button
                            onClick={() => addToCart(supplier)}
                            className={`flex-1 flex items-center justify-center gap-2 font-bold py-2.5 rounded-xl transition-all active:scale-[0.98] ${
                              justAdded === key
                                ? "bg-emerald-500 text-white animate-cart-success"
                                : isTop
                                ? "bg-[#6C3DE8] text-white hover:brightness-110 shadow-md shadow-[#6C3DE8]/25"
                                : "bg-[#151121] text-white hover:bg-slate-800"
                            }`}>
                            <span className="material-symbols-outlined text-base">{justAdded === key ? "check" : "add_shopping_cart"}</span>
                            {justAdded === key ? "Added!" : "Add to Cart"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trust signals */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] p-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: "verified_user", label: "Verified suppliers", sub: "All UK licensed" },
                  { icon: "price_check", label: "Price match", sub: "Best UK pricing" },
                  { icon: "local_shipping", label: "Fast delivery", sub: "Next day available" },
                ].map(t => (
                  <div key={t.icon} className="text-center">
                    <div className="w-10 h-10 rounded-2xl bg-[#6C3DE8]/8 flex items-center justify-center mx-auto mb-2">
                      <span className="material-symbols-outlined text-[20px] text-[#6C3DE8]" style={{ fontVariationSettings: "'FILL' 1" }}>{t.icon}</span>
                    </div>
                    <p className="text-xs font-bold text-[#151121] leading-tight">{t.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Full comparison table ── */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-7 py-5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-[#151121]">Supplier Comparison</h2>
            <span className="ml-auto text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{product.suppliers.length} suppliers · per {product.packSize}</span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 text-slate-400 uppercase text-[10px] tracking-widest font-black">
                  <th className="text-left px-7 py-4">Supplier</th>
                  <th className="text-left px-4 py-4">Price</th>
                  <th className="text-left px-4 py-4">Pack Size</th>
                  <th className="text-left px-4 py-4">Stock</th>
                  <th className="text-left px-4 py-4">Delivery</th>
                  <th className="text-left px-4 py-4">SKU</th>
                  <th className="text-right px-7 py-4">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedSuppliers.map((supplier, idx) => {
                  const isTop = idx === 0 && supplier.stock;
                  const key = supplier.name;
                  const q = qty[key] || 1;
                  return (
                    <tr key={supplier.sku} className={`transition-colors ${isTop ? "bg-[#6C3DE8]/[0.025]" : "hover:bg-slate-50/60"}`}>
                      <td className="px-7 py-4">
                        <div className="flex items-center gap-2.5">
                          {isTop && <span className="text-[10px] font-black bg-[#6C3DE8] text-white px-2 py-0.5 rounded-full uppercase tracking-wide">Best</span>}
                          <span className={`font-bold ${isTop ? "text-[#6C3DE8]" : "text-[#151121]"}`}>{supplier.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-lg font-extrabold tracking-tight ${supplier.stock ? "text-[#151121]" : "text-slate-300"}`}>{fmt(supplier.price)}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500 font-medium">{supplier.packSize || product.packSize}</td>
                      <td className="px-4 py-4"><StockBadge stock={supplier.stock} /></td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-slate-400">local_shipping</span>
                          {supplier.delivery}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-400 font-mono text-xs">{supplier.sku}</td>
                      <td className="px-7 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {supplier.stock ? (
                            <>
                              <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden">
                                <button onClick={() => setQty(q2 => ({ ...q2, [key]: Math.max(1, (q2[key] || 1) - 1) }))}
                                  className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors font-bold">−</button>
                                <input
                                  type="number" min="1" value={q}
                                  onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setQty(q2 => ({ ...q2, [key]: v })); }}
                                  className="w-10 text-sm font-bold text-center bg-transparent outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button onClick={() => setQty(q2 => ({ ...q2, [key]: (q2[key] || 1) + 1 }))}
                                  className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors font-bold">+</button>
                              </div>
                              <button
                                onClick={() => addToCart(supplier)}
                                className={`flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl transition-all active:scale-95 whitespace-nowrap ${
                                  justAdded === key ? "bg-emerald-500 text-white" : isTop ? "bg-[#6C3DE8] text-white hover:brightness-110 shadow-md shadow-[#6C3DE8]/20" : "bg-[#151121] text-white hover:bg-slate-800"
                                }`}>
                                <span className="material-symbols-outlined text-base">{justAdded === key ? "check" : "add_shopping_cart"}</span>
                                {justAdded === key ? "Added!" : "Add"}
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Unavailable</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {sortedSuppliers.map((supplier, idx) => {
              const isTop = idx === 0 && supplier.stock;
              const key = supplier.name;
              const q = qty[key] || 1;
              return (
                <div key={supplier.sku} className={`p-5 ${isTop ? "bg-[#6C3DE8]/[0.03]" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {isTop && <span className="text-[10px] font-black bg-[#6C3DE8] text-white px-2 py-0.5 rounded-full uppercase">Best</span>}
                      <span className="font-bold text-[#151121]">{supplier.name}</span>
                    </div>
                    <span className={`text-xl font-extrabold tracking-tight ${supplier.stock ? "text-[#151121]" : "text-slate-300"}`}>{fmt(supplier.price)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <StockBadge stock={supplier.stock} />
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">local_shipping</span>{supplier.delivery}
                    </span>
                  </div>
                  {supplier.stock && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden">
                        <button onClick={() => setQty(q2 => ({ ...q2, [key]: Math.max(1, (q2[key] || 1) - 1) }))}
                          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-200 font-bold text-lg active:scale-90">−</button>
                        <input
                          type="number" min="1" value={q}
                          onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setQty(q2 => ({ ...q2, [key]: v })); }}
                          className="w-10 text-sm font-bold text-center bg-transparent outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button onClick={() => setQty(q2 => ({ ...q2, [key]: (q2[key] || 1) + 1 }))}
                          className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-200 font-bold text-lg active:scale-90">+</button>
                      </div>
                      <button
                        onClick={() => addToCart(supplier)}
                        className={`flex-1 flex items-center justify-center gap-1.5 font-bold py-2.5 rounded-xl transition-all active:scale-[0.98] ${
                          justAdded === key ? "bg-emerald-500 text-white" : isTop ? "bg-[#6C3DE8] text-white shadow-md shadow-[#6C3DE8]/25" : "bg-[#151121] text-white"
                        }`}>
                        <span className="material-symbols-outlined text-base">{justAdded === key ? "check" : "add_shopping_cart"}</span>
                        {justAdded === key ? "Added!" : "Add to Cart"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Similar products ── */}
        {similarsData.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${allOutOfStock ? "bg-amber-100" : "bg-[#6C3DE8]/10"}`}>
                <span className={`material-symbols-outlined text-xl ${allOutOfStock ? "text-amber-600" : "text-[#6C3DE8]"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {allOutOfStock ? "swap_horiz" : "recommend"}
                </span>
              </div>
              <div>
                <h2 className="font-bold text-[#151121]">{allOutOfStock ? "Similar products available" : "You might also need"}</h2>
                <p className="text-sm text-slate-400">{allOutOfStock ? "Clinically equivalent alternatives — in stock now" : "Related products frequently ordered together"}</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap" style={{ scrollbarWidth: "none" }}>
              {similarsData.map(p => <SimilarCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </main>

      {/* ── Mobile sticky bar ── */}
      {best && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-4 py-4 flex items-center gap-3 shadow-[0_-8px_32px_rgba(0,0,0,0.06)]">
          <div>
            <p className="text-xs text-slate-400 font-medium">Best price</p>
            <p className="text-xl font-extrabold text-[#6C3DE8] tracking-tight">{fmt(best.price)}</p>
          </div>
          <button
            onClick={() => addToCart(best)}
            className="flex-1 flex items-center justify-center gap-2 bg-[#6C3DE8] text-white font-bold py-3.5 rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-[#6C3DE8]/25">
            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
            Add to Cart — {best.name}
          </button>
        </div>
      )}
    </div>
  );
}
