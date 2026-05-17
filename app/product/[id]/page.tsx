"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import { SupplierLogo } from "@/components/SupplierLogo";
import { CATEGORY_META, formatPerUnitPrice } from "@/lib/products";
import { freshAuthHeaders, getFreshToken } from "@/lib/auth";
import { upsertGuestCartLine } from "@/lib/guest-cart";
import { tradeListExVatIncVat } from "@/lib/supplier-price-compare";

// ─── Types ────────────────────────────────────────────────────────────────────

type Supplier = {
  id: number;
  name: string;
  /** Trade list ex-VAT (stored `dentago_supplier_products.price`). */
  price: number;
  priceExVat?: number;
  priceIncVat?: number;
  /** VAT-inclusive sort / comparison key. */
  priceCompareIncVat: number;
  stock: boolean;
  delivery: string;
  sku: string;
  /** Populated by API when only `supplier_sku` exists in DB; same as `sku` after normalisation. */
  supplierSku?: string;
  packSize?: string;
  /** True when the signed-in clinic has linked this supplier (search parity). */
  isConnected?: boolean;
};

type Similar = {
  id: number;
  name: string;
  brand: string;
  category: string;
  image: string;
  packSize: string;
  bestPrice: number | null;
};

type Substitute = {
  id: number;
  name: string;
  brand: string;
  category: string;
  image: string;
  packSize: string;
  bestPrice: number | null;
  sameBrand: boolean;
  material: string | null;
};

/** Sibling SKU (size, shade, etc.) linked in `dentago_products.variations`. */
type ProductVariation = {
  id: number;
  label: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  packSize: string;
  bestPrice: number | null;
};

type ProductDetail = {
  id: number;
  name: string;
  brand: string;
  category: string;
  image: string;
  packSize: string;
  description: string;
  specs: { label: string; value: string }[];
  suppliers: Supplier[];
  bestPrice: number | null;
  bestPriceIncVat?: number | null;
  bestSupplier?: Supplier | null;
  variations: ProductVariation[];
  similars: Similar[];
  updatedAt: string;
  clinicFiltered?: boolean;
  connectedSupplierCount?: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return `£${n.toFixed(2)}`; }

function supplierIncVat(s: Pick<Supplier, "price" | "priceIncVat">): number {
  if (s.priceIncVat != null && Number.isFinite(s.priceIncVat)) return s.priceIncVat;
  return tradeListExVatIncVat(s.price).priceIncVat;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductImage({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(false);
  if (err || !src?.trim()) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-300">
      <span className="material-symbols-outlined text-[64px]">image_not_supported</span>
      <span className="max-w-xs px-6 text-center text-sm text-slate-400">{name}</span>
    </div>
  );
  return <Image src={src} alt={name} fill className="object-contain p-8 sm:p-12" unoptimized onError={() => setErr(true)} />;
}

function StockBadge({ stock, compact }: { stock: boolean; compact?: boolean }) {
  const pad = compact ? "gap-1 px-2 py-0.5 text-[10px]" : "gap-1.5 px-3 py-1 text-xs";
  return stock ? (
    <span className={`inline-flex items-center font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full ${pad}`}>
      <span className={`rounded-full bg-emerald-500 inline-block ${compact ? "w-1 h-1" : "w-1.5 h-1.5"}`} />In Stock
    </span>
  ) : (
    <span className={`inline-flex items-center font-bold text-red-600 bg-red-50 border border-red-200 rounded-full ${pad}`}>
      <span className={`rounded-full bg-red-400 inline-block ${compact ? "w-1 h-1" : "w-1.5 h-1.5"}`} />Out of Stock
    </span>
  );
}

function VariationChip({ product }: { product: ProductVariation }) {
  const meta = CATEGORY_META[product.category];
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link
      href={`/product/${product.id}`}
      className="flex-shrink-0 flex items-center gap-3 min-w-[200px] sm:min-w-0 max-w-[280px] bg-slate-50/80 hover:bg-[#111111]/[0.06] border border-slate-200 hover:border-[#111111]/30 rounded-2xl px-3 py-2.5 transition-all group shadow-sm hover:shadow-md"
      aria-label={`View ${product.label} — ${product.name}`}
    >
      <div
        className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100 bg-white"
        style={{ background: meta?.bg || "#fff" }}
      >
        {!imgErr ? (
          <Image
            src={product.image}
            alt=""
            fill
            className="object-contain p-1"
            sizes="48px"
            unoptimized
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]" style={{ color: meta?.color || "#111111" }}>
              inventory_2
            </span>
          </div>
        )}
      </div>
      <div className="min-w-0 text-left flex-1">
        <p className="text-xs font-extrabold text-[#111111] uppercase tracking-wide truncate group-hover:text-[#5c32d8]">
          {product.label}
        </p>
        <p className="text-[13px] font-semibold text-[#151121] line-clamp-2 leading-snug group-hover:text-[#111111] transition-colors">
          {product.name}
        </p>
        {product.bestPrice !== null && (
          <p className="text-sm font-extrabold text-slate-600 mt-0.5 tabular-nums">
            From {fmt(product.bestPrice)} ex VAT
            <span className="text-slate-400 font-semibold">
              {" "}
              · {fmt(tradeListExVatIncVat(product.bestPrice).priceIncVat)} inc VAT
            </span>
          </p>
        )}
      </div>
      <span className="material-symbols-outlined text-slate-300 group-hover:text-[#111111] text-lg flex-shrink-0 translate-x-0 group-hover:translate-x-0.5 transition-all">
        chevron_right
      </span>
    </Link>
  );
}

function SimilarCard({ product }: { product: Similar }) {
  const meta = CATEGORY_META[product.category];
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link href={`/product/${product.id}`}
      className="flex-shrink-0 w-60 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(17,17,17,0.10)] hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
      <div className="relative h-40" style={{ background: meta?.bg || "#f5f3ff" }}>
        {imgErr ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[44px]" style={{ color: meta?.color || "#111111", fontVariationSettings: "'FILL' 1" }}>
              {meta?.icon || "inventory_2"}
            </span>
          </div>
        ) : (
          <Image src={product.image} alt={product.name} fill className="object-contain p-4" unoptimized onError={() => setImgErr(true)} />
        )}
      </div>
      <div className="p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{product.brand}</p>
        <p className="text-sm font-bold text-[#151121] leading-snug line-clamp-2 group-hover:text-[#111111] transition-colors mb-2">{product.name}</p>
        {product.bestPrice !== null && (
          <div className="text-base font-extrabold text-[#111111] space-y-0.5">
            <p>{fmt(product.bestPrice)} <span className="text-[10px] font-bold text-slate-500 uppercase">ex VAT</span></p>
            <p className="text-xs text-slate-600">{fmt(tradeListExVatIncVat(product.bestPrice).priceIncVat)} inc VAT</p>
          </div>
        )}
      </div>
    </Link>
  );
}

function SubstituteCard({ product }: { product: Substitute }) {
  const meta = CATEGORY_META[product.category];
  const [imgErr, setImgErr] = useState(false);
  return (
    <Link href={`/product/${product.id}`}
      className="flex-shrink-0 w-60 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(17,17,17,0.10)] hover:-translate-y-1 transition-all duration-300 overflow-hidden group relative">
      {product.sameBrand && (
        <div className="absolute top-3 left-3 z-10">
          <span className="text-[9px] font-black bg-[#111111] text-white px-2 py-0.5 rounded-full uppercase tracking-wide">Same brand</span>
        </div>
      )}
      <div className="relative h-40" style={{ background: meta?.bg || "#f5f3ff" }}>
        {imgErr ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[44px]" style={{ color: meta?.color || "#111111", fontVariationSettings: "'FILL' 1" }}>
              {meta?.icon || "inventory_2"}
            </span>
          </div>
        ) : (
          <Image src={product.image} alt={product.name} fill className="object-contain p-4" unoptimized onError={() => setImgErr(true)} />
        )}
      </div>
      <div className="p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{product.brand}</p>
        <p className="text-sm font-bold text-[#151121] leading-snug line-clamp-2 group-hover:text-[#111111] transition-colors mb-2">{product.name}</p>
        <div className="flex items-center justify-between gap-2">
          {product.bestPrice !== null && (
            <div className="text-base font-extrabold text-[#111111] space-y-0.5">
              <p>{`£${product.bestPrice.toFixed(2)}`} <span className="text-[10px] font-bold text-slate-500 uppercase">ex VAT</span></p>
              <p className="text-xs text-slate-600">{fmt(tradeListExVatIncVat(product.bestPrice).priceIncVat)} inc VAT</p>
            </div>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />In Stock
          </span>
        </div>
        {product.material && (
          <p className="text-[10px] text-slate-400 mt-1.5 truncate">{product.material}</p>
        )}
      </div>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-transparent text-[var(--dc-text)]">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 h-28 animate-pulse rounded-[2rem] border border-[var(--dc-border)] bg-white/70 shadow-[0_18px_60px_rgba(15,23,42,0.06)]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(25rem,32rem)] xl:grid-cols-[minmax(0,1fr)_minmax(28rem,36rem)]">
          <div className="space-y-5">
            <div className="h-[420px] animate-pulse rounded-[2rem] border border-[var(--dc-border)] bg-white/80 shadow-[0_18px_60px_rgba(15,23,42,0.06)]" />
            <div className="h-40 animate-pulse rounded-[2rem] border border-[var(--dc-border)] bg-white/80 shadow-[0_18px_60px_rgba(15,23,42,0.05)]" />
          </div>
          <div className="space-y-4">
            <div className="h-80 animate-pulse rounded-[2rem] border border-[var(--dc-border)] bg-white/80 shadow-[0_18px_60px_rgba(15,23,42,0.06)]" />
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  /** Non-404 failure (network, 5xx) — distinct UX from missing SKU */
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  const [substitutesLoaded, setSubstitutesLoaded] = useState(false);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setFetchError(null);
    setProduct(null);
    try {
      const headers = await freshAuthHeaders();
      const r = await fetch(`/api/products/${id}`, {
        headers,
        cache: "no-store",
      });
      if (r.status === 404) {
        setNotFound(true);
        return;
      }
      if (!r.ok) {
        let detail = "";
        try {
          const j = await r.json();
          if (typeof j?.error === "string") detail = j.error;
        } catch { /* ignore */ }
        setFetchError(detail || `Could not load product (HTTP ${r.status}).`);
        return;
      }
      const data = await r.json();
            const v = data.variations;
            setProduct({
              ...data,
              variations: Array.isArray(v) ? v : [],
            });
    } catch {
      setFetchError("Network error — check your connection and try again.");
    } finally {
          setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  // Fetch dynamic clinical equivalents when product is fully out of stock
  useEffect(() => {
    if (!product) return;
    const allOos = product.suppliers.every(s => !s.stock);
    if (!allOos) return;
    setSubstitutesLoaded(false);
    fetch(`/api/products/${id}/substitutes?limit=6`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.substitutes) setSubstitutes(data.substitutes);
      })
      .catch(() => {})
      .finally(() => setSubstitutesLoaded(true));
  }, [id, product]);

  if (loading) return (
    <AppSidebarLayout>
      <LoadingSkeleton />
    </AppSidebarLayout>
  );

  if (fetchError) return (
    <AppSidebarLayout>
      <div
        data-testid="product-load-error"
        className="min-h-screen flex flex-col items-center justify-center gap-4 bg-transparent px-6 text-center"
      >
        <span className="material-symbols-outlined text-6xl text-red-200">cloud_off</span>
        <h1 className="text-xl font-bold text-[#151121]">Couldn&apos;t load this product</h1>
        <p className="text-sm text-slate-500 max-w-md leading-relaxed">{fetchError}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => void loadProduct()}
            className="bg-[#111111] text-white px-6 py-3 rounded-xl font-bold text-sm hover:brightness-110 shadow-md shadow-[#111111]/20"
          >
            Try again
          </button>
          <Link href="/search" className="text-[#111111] font-bold hover:underline text-sm">
            Back to search
          </Link>
          <a
            href={`mailto:support@dentago.co.uk?subject=Product%20page%20error&id=${encodeURIComponent(id)}`}
            className="text-slate-500 font-semibold hover:text-[#111111] text-sm"
          >
            Contact support
          </a>
        </div>
      </div>
    </AppSidebarLayout>
  );

  if (notFound || !product) return (
    <AppSidebarLayout>
      <div data-testid="product-not-found" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-transparent">
      <span className="material-symbols-outlined text-6xl text-slate-300">search_off</span>
      <h1 className="text-xl font-semibold text-slate-600">Product not found</h1>
        <Link href="/search" className="text-[#111111] font-bold hover:underline">Browse all products</Link>
    </div>
    </AppSidebarLayout>
  );

  const best =
    (product.bestSupplier as Supplier | null | undefined) ??
    product.suppliers.find(
      s =>
        s.stock &&
        product.bestPriceIncVat != null &&
        Math.abs(s.priceCompareIncVat - product.bestPriceIncVat) < 0.02,
    ) ??
    null;
  const allOutOfStock = product.suppliers.every(s => !s.stock);

  const sortedSuppliers = [...product.suppliers].sort((a, b) => {
    if (a.stock && !b.stock) return -1;
    if (!a.stock && b.stock) return 1;
    if (!!a.isConnected !== !!b.isConnected) return a.isConnected ? -1 : 1;
    return a.priceCompareIncVat - b.priceCompareIncVat;
  });

  async function addToCart(supplier: Supplier) {
    const key = supplier.name;
    const q = qty[key] || 1;
    const prev = cart[key] || 0;
    setCart(c => ({ ...c, [key]: prev + q }));

    await getFreshToken();
    const headers = await freshAuthHeaders();
    if (!headers.Authorization) {
      upsertGuestCartLine({
        productId: product!.id,
        supplierId: supplier.id,
        supplier: supplier.name,
        name: product!.name,
        brand: product!.brand,
        category: product!.category,
        image: product!.image,
        packSize: supplier.packSize ?? product!.packSize,
        sku: supplier.sku || null,
        quantity: q,
        unitPrice: supplier.price,
        inStock: supplier.stock,
      });
      setToast(`${supplier.name} — ${q} × added to cart`);
    setJustAdded(key);
    setTimeout(() => setToast(null), 2500);
    setTimeout(() => setJustAdded(null), 1400);
      return;
    }

    const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          productId: product!.id,
          supplierId: supplier.id,
          quantity: q,
          unitPrice: supplier.price,
        sku: supplier.sku || undefined,
        packSize: supplier.packSize ?? product!.packSize,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCart(c => ({ ...c, [key]: prev }));
      setToast(typeof data.error === "string" ? data.error : `Could not add to cart (${res.status})`);
      setTimeout(() => setToast(null), 3500);
      return;
    }

    setToast(`${supplier.name} — ${q} × added`);
    setJustAdded(key);
    setTimeout(() => setToast(null), 2500);
    setTimeout(() => setJustAdded(null), 1400);
  }

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  return (
    <AppSidebarLayout>
      <div className="min-h-screen bg-transparent text-[var(--dc-text)] animate-page-in">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-28 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#151121] text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-fade-up">
          <span className="material-symbols-outlined text-emerald-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toast}
        </div>
      )}

      <main className="mx-auto max-w-[88rem] space-y-6 px-4 py-6 pb-32 sm:px-6 lg:px-8 lg:py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-medium text-[var(--dc-muted)]">
          <Link href="/search" className="transition-colors hover:text-[var(--dc-text)]">Marketplace</Link>
          <span className="text-slate-300">/</span>
          <span>{product.category}</span>
          <span className="text-slate-300">/</span>
          <span className="truncate text-[var(--dc-text)]">{product.name}</span>
        </nav>

        {/* Product header — image left, info right */}
        <section className="overflow-hidden rounded-[1.5rem] border border-[var(--dc-border)] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            {/* Image */}
            <div className="relative h-[320px] border-b border-[var(--dc-border)] bg-[#f8f9fc] sm:h-[420px] lg:h-auto lg:min-h-[440px] lg:border-b-0 lg:border-r">
              <ProductImage src={product.image} name={product.name} />
              <div className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--dc-border)] bg-white/90 px-3 py-1 text-[11px] font-semibold text-[var(--dc-muted)] backdrop-blur">
                <span className="material-symbols-outlined text-[14px]">inventory_2</span>
                {product.packSize}
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-col gap-5 p-6 sm:p-8">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--dc-muted)]">{product.brand}</p>
                <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[var(--dc-text)] sm:text-3xl">
                  {product.name}
                </h1>
              </div>

              <p className="text-sm leading-relaxed text-[var(--dc-muted)]">{product.description}</p>

              {/* Price + stock */}
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-y border-[var(--dc-border)] py-4">
                {product.bestPrice !== null ? (
                  <>
                    <span className="text-3xl font-semibold tracking-[-0.02em] text-[var(--dc-text)]">{fmt(product.bestPrice)}</span>
                    <span className="text-xs text-[var(--dc-muted)]">ex VAT</span>
                    {product.bestPriceIncVat != null && (
                      <span className="text-xs text-[var(--dc-muted)]">· {fmt(product.bestPriceIncVat)} inc VAT</span>
                    )}
                    {best && (
                      <span className="ml-auto text-xs font-medium text-[var(--dc-muted)]">via {best.name}</span>
                    )}
                  </>
                ) : (
                  <span className="text-2xl font-semibold text-[var(--dc-text)]">Request quote</span>
                )}
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface-elevated)] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--dc-muted)]">Suppliers</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--dc-text)] tabular-nums">{product.suppliers.length}</p>
                </div>
                <div className="rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface-elevated)] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--dc-muted)]">In stock</p>
                  <p className={`mt-1 text-lg font-semibold tabular-nums ${allOutOfStock ? "text-amber-600" : "text-emerald-600"}`}>
                    {product.suppliers.filter((s) => s.stock).length}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface-elevated)] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--dc-muted)]">Pack</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[var(--dc-text)]">{product.packSize}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--dc-text)] transition hover:bg-[var(--dc-surface-elevated)]"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Back
            </Link>
                <Link
                  href="/cart"
                  className="relative inline-flex items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--dc-text)] transition hover:bg-[var(--dc-surface-elevated)]"
                >
              <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
              Cart
              {totalItems > 0 && (
                    <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--dc-accent-strong)] px-1.5 text-[10px] font-bold text-white">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
        </section>

        {/* ── Out of stock alert ── */}
        {allOutOfStock && product.suppliers.length > 0 && (
          <div
            data-testid="product-all-oos-banner"
            className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex gap-3 items-start"
          >
            <span className="material-symbols-outlined text-amber-500 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <div className="flex-1">
              <p className="font-bold text-amber-800">Currently out of stock with all suppliers</p>
              <p className="text-sm text-amber-700 mt-0.5">
                {(substitutes.length > 0 || product.similars.length > 0)
                  ? "See clinical equivalents below — similar products available from stock."
                  : substitutesLoaded
                  ? "We don\u2019t have a clinical equivalent listed yet. Email us and we\u2019ll find one for you."
                  : "Searching for clinical equivalents\u2026"}
              </p>
              {substitutesLoaded && substitutes.length === 0 && product.similars.length === 0 && (
                <a
                  href={`mailto:support@dentago.co.uk?subject=Need%20alternative%20for%20${encodeURIComponent(product.name)}`}
                  className="inline-flex items-center gap-1.5 mt-3 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  Request an alternative
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── No suppliers at all (data edge) ── */}
        {product.suppliers.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-slate-400">inventory_2</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#151121]">Not currently stocked by any supplier on Dentago</p>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                We add new suppliers and SKUs every week. Tell us this is a product you order and we&apos;ll prioritise getting it on the platform.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <a
                  href={`mailto:support@dentago.co.uk?subject=Add%20product%20request&body=Please%20add%20%22${encodeURIComponent(product.name)}%22%20to%20Dentago.`}
                  className="inline-flex items-center gap-1.5 bg-[#111111] text-white text-sm font-bold px-4 py-2 rounded-xl hover:brightness-110 transition-all shadow-md shadow-[#111111]/20"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Request this product
                </a>
                <Link
                  href="/search"
                  className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#111111] text-sm font-bold px-4 py-2 rounded-xl border border-slate-200 hover:border-[#111111]/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Back to search
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Supplier offers (full width, primary commerce) ── */}
        <section className="overflow-hidden rounded-[1.5rem] border border-[var(--dc-border)] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          {product.clinicFiltered && product.connectedSupplierCount != null && product.connectedSupplierCount > 0 && (
            <div className="flex items-center gap-2.5 border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-[12px] font-medium text-emerald-800">
              <span className="material-symbols-outlined text-[16px] text-emerald-600 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <span>Linked suppliers are highlighted — all marketplace prices shown so nothing is hidden.</span>
              </div>
          )}
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dc-border)] px-5 py-4 sm:px-6">
                <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--dc-muted)]">Supplier offers</p>
              <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-[var(--dc-text)]">
                <span className="material-symbols-outlined text-[18px] text-slate-400">storefront</span>
                {product.suppliers.length} supplier{product.suppliers.length !== 1 ? "s" : ""}
                <span className="text-xs font-medium text-[var(--dc-muted)]">· per {product.packSize}</span>
                  </h2>
                  {allOutOfStock && (
                <p className="mt-1 text-xs font-medium text-amber-700">All lines out of stock — see alternatives below.</p>
                  )}
                </div>
                {product.bestPrice !== null && best && (
                  <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--dc-muted)]">Best price</p>
                <p className="mt-0.5 text-xl font-semibold tracking-[-0.02em] text-[var(--dc-accent-strong)]">{fmt(product.bestPrice)}</p>
                <p className="text-[11px] text-[var(--dc-muted)]">
                  ex VAT · {product.bestPriceIncVat != null ? fmt(product.bestPriceIncVat) : fmt(tradeListExVatIncVat(product.bestPrice).priceIncVat)} inc · via {best.name}
                </p>
                  </div>
                )}
          </header>

          <ul className="divide-y divide-[var(--dc-border)]">
                {sortedSuppliers.map((supplier, idx) => {
                  const key = supplier.name;
                  const q = qty[key] || 1;
                  const isTop = idx === 0 && supplier.stock;
              const perUnit = supplier.stock ? formatPerUnitPrice(supplier.price, supplier.packSize ?? product.packSize) : null;
              const supplierPack = supplier.packSize && supplier.packSize !== product.packSize ? supplier.packSize : null;

                  return (
                <li
                  key={`${supplier.id}-${idx}`}
                  className={`grid grid-cols-1 items-center gap-x-6 gap-y-3 px-5 py-4 transition-colors sm:grid-cols-[minmax(0,1fr)_180px_120px_auto] sm:px-6 ${
                    isTop ? "bg-[var(--dc-accent-strong)]/[0.03]" : "hover:bg-[var(--dc-surface-elevated)]/60"
                  }`}
                >
                  {/* Identity */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SupplierLogo supplierName={supplier.name} size={24} className="rounded-lg" />
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          {isTop && (
                          <span className="rounded-full bg-[var(--dc-accent-strong)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">Best</span>
                        )}
                        {supplier.isConnected && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">Linked</span>
                        )}
                        <span className={`text-[15px] font-semibold ${isTop ? "text-[var(--dc-accent-strong)]" : "text-[var(--dc-text)]"}`}>
                          {supplier.name}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--dc-muted)]">
                        <span className="font-mono">SKU {supplier.sku || supplier.supplierSku || "—"}</span>
                        {supplierPack && <span>· {supplierPack}</span>}
                      </div>
            </div>

                  {/* Stock + delivery */}
                  <div className="flex items-center gap-3">
                    <StockBadge stock={supplier.stock} />
                    <span className="flex items-center gap-1 text-[11px] text-[var(--dc-muted)]">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">local_shipping</span>
                      {supplier.delivery}
                    </span>
        </div>

                  {/* Price */}
                  <div className="text-left sm:text-right">
                    <p className={`flex items-baseline gap-1.5 sm:justify-end ${supplier.stock ? "text-[var(--dc-text)]" : "text-slate-300"}`}>
                      <span className="text-lg font-semibold tracking-[-0.02em] tabular-nums">{fmt(supplier.price)}</span>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--dc-muted)]">ex VAT</span>
                    </p>
                    <p className={`text-[11px] tabular-nums ${supplier.stock ? "text-[var(--dc-muted)]" : "text-slate-300"}`}>
                      {fmt(supplierIncVat(supplier))} inc{perUnit ? ` · ${perUnit}` : ""}
                    </p>
          </div>

                  {/* Actions */}
                        <div className="flex items-center justify-end gap-2">
                          {supplier.stock ? (
                            <>
                        <div className="flex items-center overflow-hidden rounded-lg border border-[var(--dc-border)] bg-white">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => setQty(q2 => ({ ...q2, [key]: Math.max(1, (q2[key] || 1) - 1) }))}
                            className="flex h-9 w-9 items-center justify-center text-sm font-bold text-[var(--dc-muted)] transition-colors hover:bg-[var(--dc-surface-elevated)] active:scale-90"
                          >−</button>
                                <input
                            type="number"
                            min="1"
                            value={q}
                                  onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setQty(q2 => ({ ...q2, [key]: v })); }}
                            className="w-10 bg-transparent text-center text-sm font-semibold tabular-nums text-[var(--dc-text)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => setQty(q2 => ({ ...q2, [key]: (q2[key] || 1) + 1 }))}
                            className="flex h-9 w-9 items-center justify-center text-sm font-bold text-[var(--dc-muted)] transition-colors hover:bg-[var(--dc-surface-elevated)] active:scale-90"
                          >+</button>
                              </div>
                              <button
                          type="button"
                                onClick={() => addToCart(supplier)}
                          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-all active:scale-[0.98] ${
                            justAdded === key
                              ? "bg-emerald-500 text-white"
                              : isTop
                                ? "bg-[var(--dc-accent-strong)] text-white shadow-sm hover:brightness-110"
                                : "border border-[var(--dc-text)]/15 bg-[var(--dc-text)] text-white hover:bg-[var(--dc-text)]/90"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">{justAdded === key ? "check" : "add_shopping_cart"}</span>
                          {justAdded === key ? "Added" : "Add"}
                              </button>
                            </>
                          ) : (
                      <span className="text-xs italic text-slate-400">Unavailable</span>
                          )}
                        </div>
                </li>
                  );
                })}
          </ul>
        </section>

        {/* ── Reference details — variations + specs (only render if meaningful) ── */}
        {(() => {
          // Hide specs that are just SKU — supplier rows already show per-supplier SKU
          const meaningfulSpecs = (product.specs ?? []).filter(s => s.label.toLowerCase() !== "sku");
          const hasVariations = product.variations.length > 0;
          const hasSpecs = meaningfulSpecs.length > 0;
          if (!hasVariations && !hasSpecs) return null;

              return (
            <div className="flex flex-wrap gap-5">
              {hasVariations && (
                <div className="flex-1 basis-[420px] overflow-hidden rounded-[1.5rem] border border-[var(--dc-border)] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-2 border-b border-[var(--dc-border)] px-5 py-3.5">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">category</span>
                    <h2 className="text-sm font-semibold text-[var(--dc-text)]">Also available</h2>
                    <span className="text-xs text-[var(--dc-muted)]">other SKUs in this line</span>
                    </div>
                  <div className="flex flex-wrap gap-2 p-5">
                    {product.variations.map(pv => (
                      <VariationChip key={pv.id} product={pv} />
                    ))}
                    </div>
                  </div>
              )}
              {hasSpecs && (
                <div className="flex-1 basis-[420px] overflow-hidden rounded-[1.5rem] border border-[var(--dc-border)] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-2 border-b border-[var(--dc-border)] px-5 py-3.5">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">list_alt</span>
                    <h2 className="text-sm font-semibold text-[var(--dc-text)]">Technical specifications</h2>
                  </div>
                  <dl className="divide-y divide-[var(--dc-border)]">
                    {meaningfulSpecs.map(spec => (
                      <div key={spec.label} className="flex items-center justify-between gap-4 px-5 py-2.5">
                        <dt className="text-sm text-[var(--dc-muted)]">{spec.label}</dt>
                        <dd className="text-sm font-semibold text-[var(--dc-text)] text-right">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                    </div>
                  )}
                </div>
              );
        })()}

        {/* ── Trust signals — slim row ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: "verified_user", label: "Verified suppliers", sub: "All UK licensed" },
            { icon: "price_check", label: "Price match", sub: "Best UK pricing" },
            { icon: "local_shipping", label: "Fast delivery", sub: "Next day available" },
          ].map(t => (
            <div key={t.icon} className="flex items-center gap-3 rounded-xl border border-[var(--dc-border)] bg-white px-4 py-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--dc-accent-strong)]/8">
                <span className="material-symbols-outlined text-[18px] text-[var(--dc-accent-strong)]" style={{ fontVariationSettings: "'FILL' 1" }}>{t.icon}</span>
          </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--dc-text)] leading-tight">{t.label}</p>
                <p className="text-xs text-[var(--dc-muted)]">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Clinical Equivalents (dynamic substitutes, shown when OOS) ── */}
        {allOutOfStock && substitutes.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-100">
                <span className="material-symbols-outlined text-xl text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>
                  swap_horiz
                </span>
              </div>
              <div>
                <h2 className="font-bold text-[#151121]">Clinical Equivalents</h2>
                <p className="text-sm text-slate-400">In-stock alternatives from the same product category</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4 ml-[52px]">
              Always verify clinical suitability before substituting. Same-brand suggestions share material specifications.
            </p>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap" style={{ scrollbarWidth: "none" }}>
              {substitutes.map(s => <SubstituteCard key={s.id} product={s} />)}
            </div>
          </div>
        )}

        {/* ── Similar products ── */}
        {product.similars.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${allOutOfStock ? "bg-amber-100" : "bg-[#111111]/10"}`}>
                <span className={`material-symbols-outlined text-xl ${allOutOfStock ? "text-amber-600" : "text-[#111111]"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {allOutOfStock ? "swap_horiz" : "recommend"}
                </span>
              </div>
              <div>
                <h2 className="font-bold text-[#151121]">{allOutOfStock ? "Also consider" : "You might also need"}</h2>
                <p className="text-sm text-slate-400">{allOutOfStock ? "Manually curated alternatives" : "Related products frequently ordered together"}</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap" style={{ scrollbarWidth: "none" }}>
              {product.similars.map(p => <SimilarCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </main>

      {/* ── Mobile sticky bar ── */}
      {product.bestPrice !== null && best && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-4 py-4 flex items-center gap-3 shadow-[0_-8px_32px_rgba(0,0,0,0.06)]">
          <div>
            <p className="text-xs text-slate-400 font-medium">Best price</p>
            <p className="text-xl font-extrabold text-[#111111] tracking-tight">{fmt(product.bestPrice)}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase">ex VAT</p>
            <p className="text-xs font-semibold text-slate-600">
              {product.bestPriceIncVat != null
                ? fmt(product.bestPriceIncVat)
                : fmt(tradeListExVatIncVat(product.bestPrice).priceIncVat)}{" "}
              inc VAT
            </p>
          </div>
          <button
            onClick={() => addToCart(best)}
            className="flex-1 flex items-center justify-center gap-2 bg-[#111111] text-white font-bold py-3.5 rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-[#111111]/25">
            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
            Add to Cart — {best.name}
          </button>
        </div>
      )}
    </div>
    </AppSidebarLayout>
  );
}
