"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getToken, freshAuthHeaders } from "@/lib/auth";

type Favorite = {
  id: string;
  product_id: number;
  preferred_supplier_name: string | null;
  preferred_price: number | null;
  created_at: string;
  product: {
    id: number;
    name: string;
    brand: string;
    category: string;
    image_url: string | null;
  } | null;
};

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/clinic/favorites", { headers: await freshAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setFavorites(data.favorites ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function removeFromFavorites(productId: number) {
    setFavorites(prev => prev.filter(f => f.product_id !== productId));
    await fetch(`/api/clinic/favorites?product_id=${productId}`, {
      method: "DELETE",
      headers: await freshAuthHeaders(),
    });
  }

  async function addToCart(fav: Favorite) {
    if (!fav.preferred_supplier_name || !fav.preferred_price) {
      router.push(`/search?q=${encodeURIComponent(fav.product?.name ?? "")}`);
      return;
    }
    setAdding(prev => new Set(prev).add(fav.product_id));
    try {
      const headers = { ...await freshAuthHeaders(), "Content-Type": "application/json" };
      await fetch("/api/cart", {
        method: "POST",
        headers,
        body: JSON.stringify({
          product_id: fav.product_id,
          supplier_name: fav.preferred_supplier_name,
          price: fav.preferred_price,
        }),
      });
      router.push("/cart");
    } catch {
      setAdding(prev => { const s = new Set(prev); s.delete(fav.product_id); return s; });
    }
  }

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Header — clean, matches the other procurement pages */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--dc-muted)]">Workspace</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.02em] text-[var(--dc-text)]">Favourites</h1>
            <p className="mt-1 text-sm text-[var(--dc-muted)]">
              {favorites.length > 0
                ? `${favorites.length} saved ${favorites.length === 1 ? "product" : "products"} · reorder in one tap`
                : "Saved products and one-tap reorders live here"}
            </p>
          </div>
          {favorites.length > 0 && (
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/[0.14]"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-white/90">search</span>
              Browse marketplace
            </Link>
          )}
        </header>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-[var(--dc-border)] bg-white" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="rounded-2xl border border-[var(--dc-border)] bg-white py-16">
            <div className="mx-auto flex max-w-sm flex-col items-center text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
                <span
                  className="material-symbols-outlined text-[28px] text-rose-400"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >favorite</span>
              </div>
              <h2 className="text-lg font-semibold text-[var(--dc-text)]">No favourites yet</h2>
              <p className="mt-1.5 text-sm text-[var(--dc-muted)]">
                Tap the heart on any product to save it here for one-tap reordering.
              </p>
              <Link
                href="/search"
                className="mt-5 inline-flex items-center gap-2 rounded-xl !bg-[#111111] px-5 py-2.5 text-sm font-semibold !text-white transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[16px] !text-white">search</span>
                Browse products
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favorites.map(fav => (
              <FavoriteCard
                key={fav.id}
                fav={fav}
                isAdding={adding.has(fav.product_id)}
                onAddToCart={() => addToCart(fav)}
                onRemove={() => removeFromFavorites(fav.product_id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FavoriteCard({
  fav, isAdding, onAddToCart, onRemove,
}: { fav: Favorite; isAdding: boolean; onAddToCart: () => void; onRemove: () => void }) {
  const [imgError, setImgError] = useState(false);
  const p = fav.product;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--dc-border)] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
      {/* Image */}
      <Link href={`/product/${fav.product_id}`} className="relative block h-40 flex-shrink-0 overflow-hidden bg-[var(--dc-bg)]">
        {p?.image_url && !imgError ? (
          <Image
            src={p.image_url}
            alt={p?.name ?? "Product"}
            fill
            unoptimized
            className="object-contain p-5 transition-transform duration-500 group-hover:scale-105"
            sizes="300px"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[40px] text-slate-200"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >inventory_2</span>
          </div>
        )}
        {/* Remove button */}
        <button
          type="button"
          onClick={e => { e.preventDefault(); onRemove(); }}
          title="Remove from favourites"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg !bg-white/90 text-rose-400 opacity-0 shadow-sm backdrop-blur-sm transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
        >
          <span
            className="material-symbols-outlined text-[14px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >favorite</span>
        </button>
      </Link>

      {/* Info */}
      <div className="flex-1 px-4 pb-2 pt-3">
        {p?.brand && (
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--dc-muted)]">{p.brand}</p>
        )}
        <Link href={`/product/${fav.product_id}`}>
          <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-[var(--dc-text)] transition-colors hover:text-[var(--dc-accent-strong)]">
            {p?.name ?? `Product #${fav.product_id}`}
          </h3>
        </Link>
        {fav.preferred_supplier_name && (
          <p className="mt-1 text-xs text-[var(--dc-muted)]">
            via {fav.preferred_supplier_name}
            {fav.preferred_price ? ` · £${fav.preferred_price.toFixed(2)}` : ""}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onAddToCart}
          disabled={isAdding}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg !bg-[#111111] text-sm font-semibold !text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          <span
            className="material-symbols-outlined text-[16px] !text-white"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            {isAdding ? "hourglass_empty" : "add_shopping_cart"}
          </span>
          {isAdding ? "Adding…" : fav.preferred_price ? `Reorder · £${fav.preferred_price.toFixed(2)}` : "Find best price"}
        </button>
      </div>
    </div>
  );
}
