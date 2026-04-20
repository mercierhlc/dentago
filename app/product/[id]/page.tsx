"use client";

import { use, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PRODUCTS, getBest, CATEGORY_META, type Product, type Supplier } from "@/lib/products";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `£${n.toFixed(2)}`;
}

// ── sub-components ────────────────────────────────────────────────────────────

function ProductImage({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-300">
        <span className="material-symbols-outlined" style={{ fontSize: 72 }}>image_not_supported</span>
        <span className="text-sm text-gray-400">{name}</span>
      </div>
    );
  }
  return (
    <Image
      src={src} alt={name} fill
      className="object-contain p-8"
      unoptimized onError={() => setErr(true)}
    />
  );
}

function StockBadge({ stock }: { stock: boolean }) {
  return stock ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
      In Stock
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
      Out of Stock
    </span>
  );
}

function SimilarCard({ product }: { product: Product }) {
  const best = getBest(product.suppliers);
  const meta = CATEGORY_META[product.category];
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link href={`/product/${product.id}`}
      className="flex-shrink-0 w-52 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group">
      <div className="relative h-32 bg-gray-50">
        {imgErr ? (
          <div className="w-full h-full flex items-center justify-center" style={{ background: meta?.bg || "#f7f9fb" }}>
            <span className="material-symbols-outlined text-4xl" style={{ color: meta?.color || "#6C3DE8" }}>
              {meta?.icon || "inventory_2"}
            </span>
          </div>
        ) : (
          <Image src={product.image} alt={product.name} fill
            className="object-contain p-3" unoptimized onError={() => setImgErr(true)} />
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-gray-400 mb-0.5">{product.brand}</p>
        <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2 group-hover:text-[#6C3DE8] transition-colors">{product.name}</p>
        {best && (
          <p className="mt-2 text-sm font-bold text-[#6C3DE8]">{fmt(best.price)}</p>
        )}
      </div>
    </Link>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const product = PRODUCTS.find(p => p.id === Number(id));

  const [cart, setCart] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f7f9fb]">
        <span className="material-symbols-outlined text-6xl text-gray-300">search_off</span>
        <h1 className="text-xl font-semibold text-gray-600">Product not found</h1>
        <Link href="/search" className="text-[#6C3DE8] font-medium hover:underline">Browse all products</Link>
      </div>
    );
  }

  const best = getBest(product.suppliers);
  const meta = CATEGORY_META[product.category];
  const allOutOfStock = product.suppliers.every(s => !s.stock);
  const similarsData = product.similars.map(sid => PRODUCTS.find(p => p.id === sid)).filter(Boolean) as Product[];

  function addToCart(supplier: Supplier) {
    const key = supplier.sku;
    const q = qty[key] || 1;
    setCart(c => ({ ...c, [key]: (c[key] || 0) + q }));
    showToast(`${supplier.name} — ${q} × added to cart`);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  const sortedSuppliers = [...product.suppliers].sort((a, b) => {
    if (a.stock && !b.stock) return -1;
    if (!a.stock && b.stock) return 1;
    return a.price - b.price;
  });

  return (
    <div className="min-h-screen bg-[#f7f9fb]">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="font-extrabold text-lg text-[#6C3DE8] tracking-tight mr-2">Dentago</Link>

          {/* Breadcrumb — hidden on mobile */}
          <nav className="hidden sm:flex items-center gap-1 text-sm text-gray-400 flex-1 min-w-0">
            <Link href="/search" className="hover:text-[#6C3DE8] transition-colors whitespace-nowrap">Marketplace</Link>
            <span className="material-symbols-outlined text-base">chevron_right</span>
            <span className="whitespace-nowrap" style={{ color: meta?.color }}>{product.category}</span>
            <span className="material-symbols-outlined text-base">chevron_right</span>
            <span className="truncate text-gray-700 font-medium">{product.name}</span>
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <Link href="/search"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#6C3DE8] transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back
            </Link>
            <button className="relative flex items-center gap-1.5 bg-[#6C3DE8] text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-[#5b32c7] transition-colors">
              <span className="material-symbols-outlined text-base">shopping_cart</span>
              Cart
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile breadcrumb */}
        <div className="sm:hidden px-4 pb-2 flex items-center gap-1 text-xs text-gray-400">
          <Link href="/search" className="hover:text-[#6C3DE8]">Marketplace</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="truncate text-gray-600">{product.name}</span>
        </div>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          {toast}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8 pb-28 sm:pb-8">

        {/* ── Out of stock alert ── */}
        {allOutOfStock && similarsData.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
            <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
            <div>
              <p className="font-semibold text-amber-800">Currently out of stock with all suppliers</p>
              <p className="text-sm text-amber-700 mt-0.5">See clinical equivalents below — similar products available from stock.</p>
            </div>
          </div>
        )}

        {/* ── Product hero ── */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left — image + info */}
          <div className="space-y-5">
            {/* Image */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="relative h-72 sm:h-96">
                <ProductImage src={product.image} name={product.name} />
              </div>
            </div>

            {/* Product info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: meta?.bg || "#f5f3ff" }}>
                  <span className="material-symbols-outlined text-xl" style={{ color: meta?.color || "#6C3DE8" }}>
                    {meta?.icon || "inventory_2"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{product.brand} · {product.category}</p>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-tight mt-0.5">{product.name}</h1>
                </div>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>

              <div className="flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700">
                  <span className="material-symbols-outlined text-base text-gray-400">inventory_2</span>
                  {product.packSize}
                </span>
                {best && (
                  <span className="inline-flex items-center gap-1.5 bg-[#6C3DE8]/5 border border-[#6C3DE8]/20 rounded-lg px-3 py-1.5 text-[#6C3DE8] font-semibold">
                    <span className="material-symbols-outlined text-base">savings</span>
                    From {fmt(best.price)}
                  </span>
                )}
              </div>
            </div>

            {/* Specs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-gray-400">list_alt</span>
                <h2 className="font-bold text-gray-800">Technical Specifications</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {product.specs.map((spec) => (
                  <div key={spec.label} className="flex justify-between gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                    <span className="text-sm text-gray-500 font-medium">{spec.label}</span>
                    <span className="text-sm text-gray-800 font-semibold text-right">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — pricing panel */}
          <div className="lg:sticky lg:top-20 lg:self-start space-y-4">

            {/* Price summary card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-gray-400">storefront</span>
                  {product.suppliers.length} Suppliers
                </h2>
                {best && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Best price</p>
                    <p className="text-2xl font-extrabold text-[#6C3DE8]">{fmt(best.price)}</p>
                    <p className="text-xs text-gray-500">{best.name}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {sortedSuppliers.map((supplier, idx) => {
                  const key = supplier.sku;
                  const q = qty[key] || 1;
                  const isTop = idx === 0 && supplier.stock;
                  return (
                    <div key={supplier.sku}
                      className={`rounded-xl border p-3 transition-colors ${isTop ? "border-[#6C3DE8]/30 bg-[#6C3DE8]/5" : "border-gray-100 bg-gray-50/50"}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isTop && (
                            <span className="text-[10px] font-bold bg-[#6C3DE8] text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">Best</span>
                          )}
                          <span className="text-sm font-semibold text-gray-800 truncate">{supplier.name}</span>
                        </div>
                        <span className={`text-base font-extrabold flex-shrink-0 ${supplier.stock ? "text-gray-900" : "text-gray-400"}`}>
                          {fmt(supplier.price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StockBadge stock={supplier.stock} />
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">local_shipping</span>
                          {supplier.delivery}
                        </span>
                      </div>
                      {supplier.stock && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <button onClick={() => setQty(q2 => ({ ...q2, [key]: Math.max(1, (q2[key] || 1) - 1) }))}
                              className="px-2 py-1 text-gray-500 hover:bg-gray-100 transition-colors text-sm font-bold">−</button>
                            <span className="px-3 py-1 text-sm font-semibold text-gray-800 min-w-[2rem] text-center">{q}</span>
                            <button onClick={() => setQty(q2 => ({ ...q2, [key]: (q2[key] || 1) + 1 }))}
                              className="px-2 py-1 text-gray-500 hover:bg-gray-100 transition-colors text-sm font-bold">+</button>
                          </div>
                          <button
                            onClick={() => addToCart(supplier)}
                            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-1.5 rounded-lg transition-all ${isTop ? "bg-[#6C3DE8] text-white hover:bg-[#5b32c7] shadow-sm shadow-[#6C3DE8]/30" : "bg-gray-800 text-white hover:bg-gray-700"}`}>
                            <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                            Add to Cart
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trust signals */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: "verified_user", label: "Verified suppliers", sub: "All UK licensed" },
                  { icon: "price_check", label: "Price match", sub: "Best UK pricing" },
                  { icon: "local_shipping", label: "Fast delivery", sub: "Next day available" },
                ].map(t => (
                  <div key={t.icon} className="text-center">
                    <span className="material-symbols-outlined text-2xl text-[#6C3DE8]">{t.icon}</span>
                    <p className="text-xs font-bold text-gray-700 mt-1 leading-tight">{t.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{t.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Full comparison table ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="material-symbols-outlined text-base text-gray-400">compare_arrows</span>
            <h2 className="font-bold text-gray-800">Supplier Comparison</h2>
            <span className="ml-auto text-xs text-gray-400">{product.suppliers.length} suppliers · prices per {product.packSize}</span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                  <th className="text-left px-5 py-3 font-semibold">Supplier</th>
                  <th className="text-left px-4 py-3 font-semibold">Price</th>
                  <th className="text-left px-4 py-3 font-semibold">Pack Size</th>
                  <th className="text-left px-4 py-3 font-semibold">Stock</th>
                  <th className="text-left px-4 py-3 font-semibold">Delivery</th>
                  <th className="text-left px-4 py-3 font-semibold">SKU</th>
                  <th className="text-right px-5 py-3 font-semibold">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedSuppliers.map((supplier, idx) => {
                  const isTop = idx === 0 && supplier.stock;
                  const key = supplier.sku;
                  const q = qty[key] || 1;
                  return (
                    <tr key={supplier.sku}
                      className={`hover:bg-gray-50/70 transition-colors ${isTop ? "bg-[#6C3DE8]/3" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {isTop && (
                            <span className="text-[10px] font-bold bg-[#6C3DE8] text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">Best</span>
                          )}
                          <span className={`font-semibold ${isTop ? "text-[#6C3DE8]" : "text-gray-800"}`}>{supplier.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-base font-extrabold ${supplier.stock ? "text-gray-900" : "text-gray-400"}`}>
                          {fmt(supplier.price)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{supplier.packSize || product.packSize}</td>
                      <td className="px-4 py-3.5"><StockBadge stock={supplier.stock} /></td>
                      <td className="px-4 py-3.5 text-gray-600">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-gray-400">local_shipping</span>
                          {supplier.delivery}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-400 font-mono text-xs">{supplier.sku}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {supplier.stock ? (
                            <>
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white text-xs">
                                <button onClick={() => setQty(q2 => ({ ...q2, [key]: Math.max(1, (q2[key] || 1) - 1) }))}
                                  className="px-2 py-1 text-gray-500 hover:bg-gray-100 transition-colors font-bold">−</button>
                                <span className="px-2 py-1 font-semibold text-gray-800 min-w-[2rem] text-center">{q}</span>
                                <button onClick={() => setQty(q2 => ({ ...q2, [key]: (q2[key] || 1) + 1 }))}
                                  className="px-2 py-1 text-gray-500 hover:bg-gray-100 transition-colors font-bold">+</button>
                              </div>
                              <button
                                onClick={() => addToCart(supplier)}
                                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${isTop ? "bg-[#6C3DE8] text-white hover:bg-[#5b32c7]" : "bg-gray-800 text-white hover:bg-gray-700"}`}>
                                <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                                Add
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Unavailable</span>
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
          <div className="md:hidden divide-y divide-gray-100">
            {sortedSuppliers.map((supplier, idx) => {
              const isTop = idx === 0 && supplier.stock;
              const key = supplier.sku;
              const q = qty[key] || 1;
              return (
                <div key={supplier.sku} className={`p-4 ${isTop ? "bg-[#6C3DE8]/5" : ""}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isTop && (
                        <span className="text-[10px] font-bold bg-[#6C3DE8] text-white px-1.5 py-0.5 rounded-full uppercase">Best</span>
                      )}
                      <span className="font-bold text-gray-900">{supplier.name}</span>
                    </div>
                    <span className={`text-lg font-extrabold ${supplier.stock ? "text-gray-900" : "text-gray-400"}`}>
                      {fmt(supplier.price)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <StockBadge stock={supplier.stock} />
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">local_shipping</span>
                      {supplier.delivery}
                    </span>
                    <span className="text-xs text-gray-400">{supplier.packSize || product.packSize}</span>
                  </div>
                  {supplier.stock && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                        <button onClick={() => setQty(q2 => ({ ...q2, [key]: Math.max(1, (q2[key] || 1) - 1) }))}
                          className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 font-bold text-sm">−</button>
                        <span className="px-3 py-1.5 text-sm font-semibold text-gray-800 min-w-[2.5rem] text-center">{q}</span>
                        <button onClick={() => setQty(q2 => ({ ...q2, [key]: (q2[key] || 1) + 1 }))}
                          className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-100 font-bold text-sm">+</button>
                      </div>
                      <button
                        onClick={() => addToCart(supplier)}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-bold py-1.5 rounded-lg transition-all ${isTop ? "bg-[#6C3DE8] text-white hover:bg-[#5b32c7]" : "bg-gray-800 text-white hover:bg-gray-700"}`}>
                        <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                        Add to Cart
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Clinical equivalents / Related products ── */}
        {similarsData.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className={`rounded-xl p-2 ${allOutOfStock ? "bg-amber-100" : "bg-[#6C3DE8]/10"}`}>
                <span className={`material-symbols-outlined text-xl ${allOutOfStock ? "text-amber-600" : "text-[#6C3DE8]"}`}>
                  {allOutOfStock ? "swap_horiz" : "recommend"}
                </span>
              </div>
              <div>
                <h2 className="font-bold text-gray-900">
                  {allOutOfStock ? "Similar products available" : "You might also need"}
                </h2>
                <p className="text-sm text-gray-500">
                  {allOutOfStock
                    ? "Clinically equivalent alternatives — in stock now"
                    : "Related products frequently ordered together"}
                </p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
              {similarsData.map(p => (
                <SimilarCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

      </main>

      {/* ── Mobile sticky bar ── */}
      {best && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3">
          <div>
            <p className="text-xs text-gray-400">Best price</p>
            <p className="text-lg font-extrabold text-[#6C3DE8]">{fmt(best.price)}</p>
          </div>
          <button
            onClick={() => addToCart(best)}
            className="flex-1 flex items-center justify-center gap-2 bg-[#6C3DE8] text-white font-bold py-3 rounded-xl hover:bg-[#5b32c7] transition-colors shadow-lg shadow-[#6C3DE8]/30">
            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
            Add to Cart — {best.name}
          </button>
        </div>
      )}
    </div>
  );
}
