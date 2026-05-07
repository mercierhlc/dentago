"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getToken, freshAuthHeaders } from "@/lib/auth";
import ProfileMenu from "@/components/ProfileMenu";

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
    if (!getToken()) { router.push("/onboarding/login.html"); return; }
    load();
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
    <div className="min-h-screen bg-[#f8f7ff]">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-[#6C3DE8] font-black text-xl tracking-tight">dentago</Link>
          <div className="flex-1" />
          <Link href="/search" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-[16px]">search</span>
            Search
          </Link>
          <Link href="/cart" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
            Cart
          </Link>
          <ProfileMenu clinic={null} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px] text-rose-500" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#151121]">Favourites</h1>
              <p className="text-sm text-slate-500">Your saved products — reorder in one tap.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-100 h-64 animate-pulse" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center max-w-sm mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-rose-50 flex items-center justify-center mb-6 border border-rose-100">
              <span className="material-symbols-outlined text-[40px] text-rose-300" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#151121] mb-2">No favourites yet</h2>
            <p className="text-slate-500 text-sm mb-6">Tap the heart icon on any product to save it here for one-tap reordering.</p>
            <Link
              href="/search"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#6C3DE8] text-white font-bold text-sm hover:brightness-110 shadow-md shadow-[#6C3DE8]/20 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">search</span>
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
    <div className="group bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_56px_rgba(108,61,232,0.10)] hover:border-[#6C3DE8]/20 hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Image */}
      <Link href={`/product/${fav.product_id}`} className="block relative h-44 bg-white flex-shrink-0 overflow-hidden">
        {p?.image_url && !imgError ? (
          <Image
            src={p.image_url}
            alt={p?.name ?? "Product"}
            fill
            unoptimized
            className="object-contain p-5 group-hover:scale-105 transition-transform duration-700"
            sizes="300px"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-[44px] text-slate-200" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
          </div>
        )}
        {/* Remove button */}
        <button
          onClick={e => { e.preventDefault(); onRemove(); }}
          title="Remove from favourites"
          className="absolute top-2 right-2 w-7 h-7 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center text-rose-400 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
        >
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
        </button>
      </Link>

      {/* Info */}
      <div className="px-4 pt-3 pb-2 flex-1">
        {p?.brand && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{p.brand}</p>}
        <Link href={`/product/${fav.product_id}`}>
          <h3 className="text-[14px] font-bold text-[#151121] leading-snug line-clamp-2 hover:text-[#6C3DE8] transition-colors">
            {p?.name ?? `Product #${fav.product_id}`}
          </h3>
        </Link>
        {fav.preferred_supplier_name && (
          <p className="text-xs text-slate-400 mt-1">
            via {fav.preferred_supplier_name}
            {fav.preferred_price ? ` · £${fav.preferred_price.toFixed(2)}` : ""}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 pb-4">
        <button
          onClick={onAddToCart}
          disabled={isAdding}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold bg-[#6C3DE8] text-white hover:brightness-110 hover:shadow-lg hover:shadow-[#6C3DE8]/25 shadow-md shadow-[#6C3DE8]/15 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>
            {isAdding ? "hourglass_empty" : "add_shopping_cart"}
          </span>
          {isAdding ? "Adding…" : fav.preferred_price ? `Reorder · £${fav.preferred_price.toFixed(2)}` : "Find best price"}
        </button>
      </div>
    </div>
  );
}
