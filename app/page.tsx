"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/navbar";

const SUGGESTIONS = ["Nitrile gloves", "Articaine", "Composite", "ProTaper", "Impression material", "Face masks", "Sutures", "Bonding agent"];

type SupplierPrice = { supplier: string; price: number; stock: boolean; live?: boolean };
type BestSeller = {
  id: string;
  name: string;
  shortName: string;
  brand: string;
  category: string;
  image: string;
  searchQ: string;
  staticPrices: SupplierPrice[];
};

const BEST_SELLERS: BestSeller[] = [
  {
    id: "nitrile-gloves-large",
    name: "Nitrile Examination Gloves — Large (Box of 100)",
    shortName: "Nitrile Gloves L × 100",
    brand: "Cranberry",
    category: "PPE",
    image: "https://www.cranberryglobal.com/wp-content/uploads/2024/01/Carbon-100_3D.png",
    searchQ: "Nitrile gloves",
    staticPrices: [
      { supplier: "Dental Sky",   price: 4.85, stock: true  },
      { supplier: "DHB",          price: 4.95, stock: false },
      { supplier: "Kent Express", price: 5.20, stock: true  },
      { supplier: "Henry Schein", price: 5.65, stock: true  },
    ],
  },
  {
    id: "septanest-articaine",
    name: "Septanest 4% Articaine + Epinephrine 1:100,000 — 50 Cartridges",
    shortName: "Septanest Articaine × 50",
    brand: "Septodont",
    category: "Anaesthetics",
    image: "https://www.septodont.co.uk/sites/default/files/2021-01/Septanest%20SP%20Box.jpg",
    searchQ: "Articaine",
    staticPrices: [
      { supplier: "Henry Schein",     price: 28.40, stock: true  },
      { supplier: "Kent Express",     price: 29.80, stock: true  },
      { supplier: "Dental Directory", price: 30.50, stock: true  },
      { supplier: "Dental Sky",       price: 31.20, stock: false },
    ],
  },
  {
    id: "face-masks-iir",
    name: "Type IIR Surgical Face Masks — Box of 50",
    shortName: "Surgical Masks IIR × 50",
    brand: "Medicom",
    category: "PPE",
    image: "https://www.medicom.com/media/wysiwyg/products/safe-mask/safe-mask-premier-blue.png",
    searchQ: "Face masks",
    staticPrices: [
      { supplier: "Clark Dental", price: 3.20, stock: true },
      { supplier: "Dental Sky",   price: 3.45, stock: true },
      { supplier: "Amalgadent",   price: 3.50, stock: true },
      { supplier: "Kent Express", price: 3.65, stock: true },
    ],
  },
  {
    id: "filtek-z250-a1",
    name: "3M ESPE Filtek Z250 Restorative — A1 Syringe 4g",
    shortName: "Filtek Z250 A1 4g",
    brand: "3M ESPE",
    category: "Consumables",
    image: "https://www.dentalsky.com/media/catalog/product/cache/f85fa63785494855da584f973c145c72/f/i/filtek-z250.jpg",
    searchQ: "Composite",
    staticPrices: [
      { supplier: "Wrights",      price: 17.90, stock: true  },
      { supplier: "Henry Schein", price: 18.75, stock: true  },
      { supplier: "Kent Express", price: 19.40, stock: true  },
    ],
  },
  {
    id: "protaper-gold-f1",
    name: "ProTaper Gold Rotary Files — F1 25mm (6 pcs)",
    shortName: "ProTaper Gold F1 × 6",
    brand: "Dentsply Sirona",
    category: "Endodontics",
    image: "https://www.dentalsky.com/media/catalog/product/cache/bc2ee718dcf659e638b606e89cf2125c/s/2/s2_1.jpg",
    searchQ: "ProTaper",
    staticPrices: [
      { supplier: "Trycare",      price: 32.50, stock: true  },
      { supplier: "DMI",          price: 33.10, stock: false },
      { supplier: "Kent Express", price: 34.00, stock: true  },
      { supplier: "Henry Schein", price: 35.60, stock: true  },
    ],
  },
  {
    id: "optim33-wipes",
    name: "Optim 33 TB Surface Disinfectant Wipes — Tub of 160",
    shortName: "Optim 33 TB Wipes × 160",
    brand: "SciCan",
    category: "Infection Control",
    image: "https://assets.scican.com/images/cleaners-disinfectants/optim-33-tb/optim33tb_banner_US_updated.png",
    searchQ: "Disinfectant wipes",
    staticPrices: [
      { supplier: "Dental Directory", price: 11.40, stock: true },
      { supplier: "Dental Sky",       price: 11.90, stock: true },
      { supplier: "Clark Dental",     price: 12.40, stock: true },
      { supplier: "Henry Schein",     price: 13.20, stock: true },
    ],
  },
];

const CATEGORY_GRADIENT: Record<string, { bg: string; dot: string }> = {
  "PPE":               { bg: "from-violet-100 via-purple-50 to-indigo-100",   dot: "rgba(108,61,232,0.12)" },
  "Anaesthetics":      { bg: "from-sky-100 via-blue-50 to-cyan-100",           dot: "rgba(14,165,233,0.12)" },
  "Consumables":       { bg: "from-violet-100 via-fuchsia-50 to-purple-100",   dot: "rgba(168,85,247,0.12)" },
  "Endodontics":       { bg: "from-emerald-100 via-teal-50 to-green-100",       dot: "rgba(16,185,129,0.12)" },
  "Infection Control": { bg: "from-orange-100 via-amber-50 to-yellow-100",      dot: "rgba(251,146,60,0.12)" },
};
const CATEGORY_ICON: Record<string, string> = {
  "PPE":               "safety_check",
  "Anaesthetics":      "syringe",
  "Consumables":       "colorize",
  "Endodontics":       "rotate_right",
  "Infection Control": "cleaning_services",
};

function ProductImage({ src, alt, category }: { src: string; alt: string; category: string }) {
  const [errored, setErrored] = useState(false);
  const cat = CATEGORY_GRADIENT[category] ?? { bg: "from-slate-100 to-slate-50", dot: "rgba(0,0,0,0.06)" };
  const icon = CATEGORY_ICON[category] ?? "inventory_2";

  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${cat.bg}`}>
      {/* subtle dot texture */}
      <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle, ${cat.dot} 1.5px, transparent 1.5px)`, backgroundSize: "18px 18px" }} />
      {errored ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined text-6xl opacity-30" style={{ fontVariationSettings: "'FILL' 1", color: "currentColor" }}>{icon}</span>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-30">{category}</span>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          className="object-contain p-6 group-hover:scale-110 transition-transform duration-700 drop-shadow-lg"
          sizes="320px"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}

function getBestInStock(prices: SupplierPrice[]) {
  const inStock = prices.filter(p => p.stock);
  if (!inStock.length) return null;
  return inStock.reduce((a, b) => (a.price < b.price ? a : b));
}

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [livePrices, setLivePrices] = useState<Record<string, SupplierPrice[]>>({});
  const [priceSource, setPriceSource] = useState<Record<string, string>>({});
  const [fetchedAt, setFetchedAt] = useState<Record<string, string>>({});
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterDone, setNewsletterDone] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = typeof window !== "undefined"
      ? (localStorage.getItem("dentago_token") ?? sessionStorage.getItem("dentago_token"))
      : null;

    BEST_SELLERS.forEach(async (product) => {
      try {
        // Use authenticated endpoint if logged in — gets negotiated prices
        const url = token
          ? `/api/clinic/live-pricing?id=${product.id}`
          : `/api/live-pricing?id=${product.id}`;
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const res = await fetch(url, { headers });
        if (!res.ok) return;
        const data = await res.json();
        setLivePrices(prev => ({ ...prev, [product.id]: data.prices }));
        setPriceSource(prev => ({ ...prev, [product.id]: data.source }));
        setFetchedAt(prev => ({ ...prev, [product.id]: data.fetchedAt }));
      } catch {
        // silently fall back to static prices
      }
    });
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  }

  return (
    <div className="bg-[#f7f9fb] text-[#151121]">
      <Navbar />

      <main className="pt-28 sm:pt-36 pb-20">
        {/* ── HERO ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 mb-12 sm:mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-10 xl:gap-16 items-center">

            {/* Left */}
            <div>
              <div className="inline-flex items-center space-x-2 bg-[#6C3DE8]/5 px-4 py-1.5 rounded-full text-xs font-bold text-[#6C3DE8] mb-7 uppercase tracking-[0.1em]">
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>Procurement Reimagined</span>
              </div>
              <h1 className="text-[2.6rem] md:text-[3.1rem] xl:text-[3.5rem] font-extrabold tracking-tighter text-[#151121] leading-[1.06] mb-6">
                The Fastest Way to Order<br /><span className="text-[#6C3DE8] italic">Dental Supplies.</span>
              </h1>
              <p className="text-[1.15rem] md:text-[1.25rem] text-[#494455] font-normal leading-relaxed mb-8 max-w-lg" style={{ opacity: 0.65 }}>
                Compare 45+ UK suppliers in one interface. Stop manual spreadsheets and start saving 15% on every order.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/onboarding/step1.html" className="bg-[#6C3DE8] text-white px-8 py-4 rounded-2xl font-bold text-base shadow-2xl shadow-[#6C3DE8]/20 transition-all hover:scale-105 active:scale-95 text-center">
                  Start Saving Now
                </Link>
                <Link href="/demo" className="bg-transparent text-[#151121] px-8 py-4 rounded-2xl font-bold text-base border-2 border-slate-200 hover:border-[#6C3DE8]/40 hover:text-[#6C3DE8] transition-all text-center">
                  Book a Demo
                </Link>
              </div>
            </div>

            {/* Right — AI widget */}
            <div className="hidden lg:block">
              <AIInsightsWidget />
            </div>

          </div>
        </section>

        {/* ── SEARCH + CHIPS ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 mb-16 sm:mb-20">
          {/* Full-width search + chips */}
          <div className="mb-14">
            <form onSubmit={handleSearch} className="mb-4">
              <div className="flex items-center bg-white rounded-2xl shadow-[0_12px_56px_rgba(108,61,232,0.15)] border border-slate-100 overflow-hidden px-4 py-3 gap-3">
                <svg className="ml-1 flex-shrink-0 text-[#6C3DE8]" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search gloves, composite, articaine, ProTaper…"
                  className="flex-1 bg-transparent text-[#151121] placeholder:text-slate-400 text-[1rem] font-medium outline-none py-2 px-2"
                />
                <button
                  type="submit"
                  className="bg-[#6C3DE8] text-white px-8 py-4 rounded-xl font-bold text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all flex-shrink-0"
                >
                  Compare Prices
                </button>
              </div>
            </form>
            {/* Quick suggestions */}
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => router.push(`/search?q=${encodeURIComponent(s)}`)}
                  className="bg-white border border-slate-200 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-full hover:border-[#6C3DE8] hover:text-[#6C3DE8] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── BEST SELLERS CAROUSEL ── */}
          <div className="text-left">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#151121]">Best Sellers</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Live pricing · best price highlighted</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => carouselRef.current?.scrollBy({ left: -288, behavior: "smooth" })}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:border-[#6C3DE8] hover:text-[#6C3DE8] hover:shadow-lg transition-all active:scale-95"
                  aria-label="Scroll left"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button
                  onClick={() => carouselRef.current?.scrollBy({ left: 288, behavior: "smooth" })}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:border-[#6C3DE8] hover:text-[#6C3DE8] hover:shadow-lg transition-all active:scale-95"
                  aria-label="Scroll right"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
                </button>
                <Link href="/search" className="text-xs sm:text-sm font-bold text-[#6C3DE8] hover:opacity-70 transition-opacity flex-shrink-0 ml-1">
                  View all →
                </Link>
              </div>
            </div>

            <div className="relative -mx-3 sm:mx-0">
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 z-10 bg-gradient-to-r from-[#f7f9fb] to-transparent" />
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 z-10 bg-gradient-to-l from-[#f7f9fb] to-transparent" />
              <div
                ref={carouselRef}
                className="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth pb-4 px-3 sm:px-0"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {BEST_SELLERS.map((product) => {
                  const prices = livePrices[product.id] ?? product.staticPrices;
                  const best = getBestInStock(prices);
                  const inStockPrices = prices.filter(p => p.stock);
                  const highestInStock = inStockPrices.length ? Math.max(...inStockPrices.map(p => p.price)) : 0;
                  const saving = best ? highestInStock - best.price : 0;
                  const isAuthenticated = priceSource[product.id] === "authenticated";
                  const isLive = priceSource[product.id] === "mixed" || isAuthenticated;
                  const updatedAt = fetchedAt[product.id]
                    ? new Date(fetchedAt[product.id]).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                    : null;

                  return (
                    <Link
                      key={product.id}
                      href={`/search?q=${encodeURIComponent(product.searchQ)}`}
                      className="group flex-shrink-0 w-72 sm:w-80 rounded-[22px] overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(108,61,232,0.18)]"
                      style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 4px 24px rgba(108,61,232,0.08), inset 0 1px 0 rgba(255,255,255,0.8)" }}
                    >
                      {/* Image area */}
                      <div className="relative h-52 overflow-hidden">
                        <ProductImage src={product.image} alt={product.shortName} category={product.category} />

                        {/* Category pill */}
                        <span className="absolute top-3 left-3 z-10 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", color: "#6C3DE8", border: "1px solid rgba(108,61,232,0.12)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                          {product.category}
                        </span>

                        {/* Live / Your Price badge */}
                        {isAuthenticated ? (
                          <span className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1.5 rounded-full bg-[#6C3DE8] text-white shadow-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Your Price
                          </span>
                        ) : isLive ? (
                          <span className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1.5 rounded-full bg-emerald-500 text-white shadow-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />LIVE
                          </span>
                        ) : null}

                        {/* Savings pill — bottom left */}
                        {saving > 0.3 && (
                          <span className="absolute bottom-3 left-3 z-10 text-[10px] font-black px-3 py-1.5 rounded-full bg-emerald-500 text-white shadow-md">
                            Save £{saving.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Card body */}
                      <div className="p-5">
                        {/* Brand + name */}
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{product.brand}</p>
                        <h3 className="text-sm font-bold text-[#151121] leading-snug mb-4 group-hover:text-[#6C3DE8] transition-colors line-clamp-2">
                          {product.shortName}
                        </h3>

                        {/* Best price — glass pill */}
                        {best ? (
                          <div className="rounded-2xl px-4 py-3 mb-3" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Best Price</span>
                              <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">Best ✓</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-extrabold text-emerald-600 tracking-tight">£{best.price.toFixed(2)}</span>
                              <span className="text-[11px] text-slate-400 font-medium">via {best.supplier}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl px-4 py-3 mb-3 bg-slate-50">
                            <p className="text-xs text-slate-400">Out of stock everywhere</p>
                          </div>
                        )}

                        {/* Other suppliers */}
                        <div className="space-y-2 pt-1">
                          {prices.filter(p => p.supplier !== best?.supplier).slice(0, 3).map(p => (
                            <div key={p.supplier} className="flex items-center justify-between">
                              <span className={`text-[11px] font-medium ${p.stock ? "text-slate-500" : "text-slate-300"}`}>{p.supplier}</span>
                              <span className={`text-[11px] font-bold ${!p.stock ? "text-rose-300 line-through" : "text-slate-400"}`}>
                                £{p.price.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {updatedAt && (
                          <p className="text-[9px] text-slate-300 mt-3 font-medium">Updated {updatedAt}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── STOP OVERPAYING / SEARCH COMPARE ── */}
        <section className="max-w-7xl mx-auto px-8 mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-center">
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#151121] leading-[1.1]">
                Stop Overpaying. <br /><span className="text-[#6C3DE8]">Start Comparing.</span>
              </h2>
              <p className="text-lg text-[#494455] leading-relaxed opacity-90">
                Access 100k+ Dental SKU&apos;s from dozens of suppliers all from one marketplace. No more jumping between tabs to find out who has the best price for composite.
              </p>
              <div className="space-y-4 pt-4">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-[#6C3DE8]/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#6C3DE8] text-[20px]">insights</span>
                  </div>
                  <span className="font-bold text-slate-700">Real-time price auditing</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-[#6C3DE8]/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#6C3DE8] text-[20px]">verified</span>
                  </div>
                  <span className="font-bold text-slate-700">Verified UK-only suppliers</span>
                </div>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="floating-card overflow-hidden">
                <div className="p-8 border-b border-slate-50">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-5 flex items-center text-slate-400">
                      <span className="material-symbols-outlined">search</span>
                    </span>
                    <input
                      className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-slate-900 font-bold placeholder:text-slate-400"
                      readOnly
                      type="text"
                      value="Nitrile Exam Gloves"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-slate-400 uppercase text-[10px] font-bold tracking-[0.2em]">
                        <th className="px-8 py-6">Product</th>
                        <th className="px-4 py-6 text-right">Henry Schein</th>
                        <th className="px-4 py-6 text-right">Dental Sky</th>
                        <th className="px-8 py-6 text-right text-emerald-600">Best Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                              <Image
                                src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=80&h=80&fit=crop"
                                alt="Gloves"
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">Nitrile Exam Gloves</div>
                              <div className="text-[10px] text-slate-400 uppercase font-bold">100 Pack • Blue</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-6 text-right font-semibold text-rose-400 line-through">£12.50</td>
                        <td className="px-4 py-6 text-right font-semibold text-rose-400 line-through">£11.20</td>
                        <td className="px-8 py-6 text-right font-extrabold text-emerald-600">£9.95</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors bg-[#6C3DE8]/[0.02]">
                        <td className="px-8 py-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                              <span className="material-symbols-outlined text-slate-400">medication</span>
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">3M Filtek Supreme</div>
                              <div className="text-[10px] text-slate-400 uppercase font-bold">A2 Shade • 4g</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-6 text-right font-semibold text-rose-400 line-through">£45.00</td>
                        <td className="px-4 py-6 text-right font-semibold text-rose-400 line-through">£42.50</td>
                        <td className="px-8 py-6 text-right font-extrabold text-emerald-600">£38.90</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="p-6 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Showing real-time stock from 45+ suppliers
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── UNIFIED CHECKOUT ── */}
        <section className="max-w-7xl mx-auto px-8 mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="floating-card p-10 space-y-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-extrabold text-2xl text-slate-900">Unified Checkout</h3>
                  <div className="bg-[#6C3DE8]/10 text-[#6C3DE8] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider">3 Suppliers</div>
                </div>
                <div className="space-y-4">
                  {[
                    { abbr: "HS", name: "Henry Schein", amount: "£142.50", color: "bg-blue-100 text-blue-600" },
                    { abbr: "DS", name: "Dental Sky", amount: "£89.00", color: "bg-purple-100 text-purple-600" },
                    { abbr: "KE", name: "Kent Express", amount: "£215.40", color: "bg-orange-100 text-orange-600" },
                  ].map(({ abbr, name, amount, color }) => (
                    <div key={name} className="flex items-center justify-between p-5 rounded-3xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center font-bold text-xs`}>{abbr}</div>
                        <span className="font-bold text-slate-700">{name}</span>
                      </div>
                      <span className="font-extrabold text-slate-900">{amount}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <button className="w-full bg-[#6C3DE8] text-white py-5 rounded-2xl font-bold flex items-center justify-center space-x-3 hover:brightness-110 transition-all hover:scale-[1.02]">
                    <span>Place Combined Order</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                  <p className="text-[11px] text-center mt-6 text-slate-400 font-medium italic">
                    We automatically route orders to each individual distributor for you.
                  </p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-8">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#151121] leading-[1.1]">
                One Cart. <br /><span className="text-[#6C3DE8] italic">All Suppliers.</span>
              </h2>
              <p className="text-lg text-[#494455] leading-relaxed opacity-90 max-w-lg">
                Why login to five different websites? Add items from across the market to a single unified cart. One checkout, multiple fulfillment sources.
              </p>
              {/* Testimonial with stars + gradient avatar */}
              <div className="p-8 rounded-[2rem] border border-[#6C3DE8]/10 relative">
                {/* 5 stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20"><path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z"/></svg>
                  ))}
                </div>
                <p className="text-[#6C3DE8] font-bold text-lg leading-relaxed italic">
                  &ldquo;Dentago saved our practice manager 4 hours of ordering time in the first week. It&apos;s a total game changer.&rdquo;
                </p>
                <div className="mt-6 flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6C3DE8] to-violet-400 flex items-center justify-center font-black text-white text-sm ring-4 ring-white shadow">
                    SJ
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900">Dr. Sarah Jenkins</div>
                    <span className="inline-block text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full uppercase tracking-wide mt-0.5">Mayfair Dental Practice · London</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="max-w-7xl mx-auto px-8 mb-20">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center space-x-2 bg-[#006c49]/5 px-4 py-1.5 rounded-full text-[10px] font-black text-[#006c49] mb-4 uppercase tracking-[0.2em]">
              <span>The Process</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">How Dentago Works</h2>
            <p className="text-[#494455] max-w-2xl mx-auto font-medium text-lg">
              Four simple steps to transform your clinic&apos;s procurement from a headache into a superpower.
            </p>
          </div>
          {/* Steps with connector line */}
          <div className="relative">
            <div className="hidden lg:block absolute top-[52px] left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-[#6C3DE8]/20 via-[#6C3DE8]/40 to-[#6C3DE8]/20" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { num: "1", icon: "person_add", title: "Create your free account", desc: "Sign up with your email. No credit card, no contract, no commitment.", color: "bg-[#6C3DE8]/10 text-[#6C3DE8]" },
                { num: "2", icon: "verified_user", title: "Verify your practice", desc: "Submit your GDC registration and practice documents. Approved within 24 hours.", color: "bg-[#006c49]/10 text-[#006c49]" },
                { num: "3", icon: "link", title: "Connect your suppliers", desc: "Link existing accounts with Henry Schein, Kent Express & others. Pricing applies automatically.", color: "bg-[#6C3DE8]/10 text-[#6C3DE8]" },
                { num: "4", icon: "shopping_cart_checkout", title: "Search, compare, order", desc: "Find any product, see every supplier's price, add to one cart, place all orders at once.", color: "bg-[#006c49]/10 text-[#006c49]" },
              ].map(({ num, icon, title, desc, color }) => (
                <div key={num} className="floating-card p-8 relative overflow-hidden group flex flex-col items-center text-center">
                  {/* Numbered badge above icon */}
                  <div className="w-8 h-8 rounded-full bg-[#6C3DE8] text-white text-sm font-black flex items-center justify-center mb-4 shadow-md shadow-[#6C3DE8]/30 z-10">
                    {num}
                  </div>
                  <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mb-6`}>
                    <span className="material-symbols-outlined text-3xl">{icon}</span>
                  </div>
                  <h3 className="text-lg font-extrabold mb-3 text-slate-900">{title}</h3>
                  <p className="text-[#494455] leading-relaxed font-medium text-sm">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SPEND AUDIT ── */}
        <section className="max-w-7xl mx-auto px-8 mb-20">
          <div className="bg-[#6C3DE8] rounded-[2.5rem] p-10 md:p-16 text-white overflow-hidden relative shadow-[0_20px_50px_rgba(108,61,232,0.3)]">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-48 -mt-48" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full blur-3xl -ml-48 -mb-48" />
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                  Where are you overpaying?
                </h2>
                <p className="text-lg text-white/80 leading-relaxed font-medium">
                  Upload your last 3 supplier invoices. Our audit team will cross-reference them with 100,000+ live prices to find exactly where you can save.
                </p>
                <div className="space-y-4">
                  {[
                    "Average audit finds £4,200 in annual savings",
                    "100% data privacy & GDPR compliance",
                  ].map((item) => (
                    <div key={item} className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full bg-[#10b981] flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-white text-[16px]">check</span>
                      </div>
                      <span className="font-bold text-white/90">{item}</span>
                    </div>
                  ))}
                </div>
                <button className="bg-white text-[#6C3DE8] px-10 py-5 rounded-2xl font-extrabold text-lg shadow-xl transition-all hover:scale-105 active:scale-95">
                  Get Your Free Spend Audit
                </button>
              </div>
              <div className="flex justify-center lg:justify-end">
                <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl text-slate-900">
                  <div className="mb-10">
                    <h4 className="font-extrabold text-xl text-slate-900">Audit Result: Marylebone Dental</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">JULY 2024</p>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-3">
                        <span className="text-slate-500 uppercase tracking-widest">Current Spend</span>
                        <span className="text-slate-900 text-sm">£28,450</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="w-full h-full bg-[#6C3DE8]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-3">
                        <span className="text-[#006c49] uppercase tracking-widest">Dentago Optimized</span>
                        <span className="text-[#006c49] text-sm">£23,120</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="w-[82%] h-full bg-[#006c49]" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-12 pt-10 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Potential Saving</p>
                      <p className="text-5xl font-extrabold text-[#006c49] tracking-tighter">£5,330</p>
                    </div>
                    <div className="w-20 h-20 rounded-full border-4 border-[#006c49]/10 flex items-center justify-center relative">
                      <span className="text-[#006c49] font-extrabold text-xl">18%</span>
                      <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle className="text-[#006c49]" cx="40" cy="40" fill="none" r="36" stroke="currentColor" strokeDasharray="226" strokeDashoffset="40" strokeWidth="4" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── VALUE PROPS ── */}
        <section className="max-w-7xl mx-auto px-8 mb-20">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-extrabold tracking-tight">Supply Management, Simplified.</h2>
            <p className="text-[#494455] max-w-2xl mx-auto font-medium">
              We don&apos;t charge clinics a penny. Our mission is to make the dental supply chain transparent and efficient.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: "payments", color: "bg-[#006c49]/10 text-[#006c49]", title: "Always Free for Clinics", desc: "No subscriptions, no hidden fees, and no markups. We get paid by suppliers, ensuring you always get the best market rate." },
              { icon: "shopping_cart", color: "bg-[#6C3DE8]/10 text-[#6C3DE8]", title: "Unified Checkout", desc: "Add items from 5 different suppliers into one single cart. One checkout, one invoice, zero procurement headaches." },
              { icon: "auto_awesome", color: "bg-purple-100 text-[#6C3DE8]", title: "Smart Substitutions", desc: "Our algorithm suggests clinically equivalent products that cost less. Dentago users save an average of 18% by switching to high quality alternatives." },
            ].map(({ icon, color, title, desc }) => (
              <div key={title} className="floating-card p-10">
                <div className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center mb-8`}>
                  <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                </div>
                <h3 className="text-2xl font-extrabold mb-4">{title}</h3>
                <p className="text-[#494455] leading-relaxed font-medium">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── AI ASSISTANT ── */}
        <section className="max-w-7xl mx-auto px-8 mb-20">
          <div className="floating-card p-10 md:p-16 bg-white overflow-hidden relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
              <div className="space-y-8">
                <div className="inline-flex items-center space-x-2 bg-[#6C3DE8]/5 px-4 py-1.5 rounded-full text-xs font-bold text-[#6C3DE8] uppercase tracking-[0.1em]">
                  <span className="material-symbols-outlined text-[16px]">psychology</span>
                  <span>Intelligence</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#151121] leading-[1.1]">
                  Meet your <span className="text-[#6C3DE8] italic">AI Procurement Assistant.</span>
                </h2>
                <p className="text-lg text-[#494455] leading-relaxed opacity-90 max-w-lg">
                  Our intelligent AI monitors price fluctuations, suggests clinical equivalents that cost less, and predicts when you&apos;re running low on stock — so you never overpay or run out.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button className="bg-[#6C3DE8] text-white px-8 py-4 rounded-xl font-bold text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all">Activate AI Assistant</button>
                  <button className="bg-transparent text-slate-600 px-8 py-4 rounded-xl font-bold text-sm border-2 border-slate-200 hover:border-[#6C3DE8]/40 hover:text-[#6C3DE8] transition-all">See Examples</button>
                </div>
              </div>
              <div className="relative">
                <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 shadow-inner space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Insights Live</span>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 text-[20px]">more_horiz</span>
                  </div>
                  {[
                    { border: "border-[#10b981]", bg: "bg-[#10b981]/10 text-[#10b981]", icon: "swap_horiz", text: "Switch to Eco-Preferred Nitrile Gloves to save £145 this month.", sub: "CLINICAL EQUIVALENT IDENTIFIED" },
                    { border: "border-[#6C3DE8]", bg: "bg-[#6C3DE8]/10 text-[#6C3DE8]", icon: "inventory_2", text: "Low stock alert: Composite Resin A2", sub: "Only 3 units remaining based on your usage patterns." },
                    { border: "border-[#10b981]", bg: "bg-[#10b981]/10 text-[#10b981]", icon: "trending_down", text: "Identified 3 equivalent products at 12% lower cost.", sub: null },
                  ].map(({ border, bg, icon, text, sub }) => (
                    <div key={icon} className={`bg-white p-5 rounded-2xl shadow-sm border-l-4 ${border} flex items-start space-x-4`}>
                      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                        <span className="material-symbols-outlined text-[20px]">{icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{text}</p>
                        {sub && <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{sub}</p>}
                      </div>
                    </div>
                  ))}
                  <div className="pt-4">
                    <div className="relative">
                      <input
                        className="w-full bg-white border border-slate-200 rounded-full py-3 px-5 text-xs text-slate-900 pr-12"
                        placeholder="Ask AI: 'Where can I save on infection control?'"
                        readOnly
                        type="text"
                      />
                      <button className="absolute right-2 top-1.5 w-8 h-8 rounded-full bg-[#6C3DE8] flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-[16px]">send</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-4xl mx-auto px-8 mb-20">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-extrabold tracking-tight">Got Questions?</h2>
            <p className="text-[#494455] font-medium">Everything you need to know about switching your procurement to Dentago.</p>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "Is it really free?",
                a: "Yes, Dentago is 100% free for dental clinics. We don't charge subscription fees, transaction fees, or add any markups to the prices you see. The price you pay on Dentago is the same (or lower) than what you'd pay direct.",
              },
              {
                q: "What happens to my existing supplier relationships?",
                a: "Nothing changes! You can still use your existing accounts. In fact, you can link your current supplier accounts to Dentago to see your specific negotiated contract pricing alongside market rates.",
              },
              {
                q: "How is my data protected?",
                a: "We take security seriously. We are fully GDPR compliant and use bank-level encryption (AES-256) to protect your clinic's information. We never sell your data to third parties.",
              },
            ].map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

        {/* ── BLOG ── */}
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex items-end justify-between mb-12">
              <div>
                <div className="text-xs font-bold text-[#6C3DE8] uppercase tracking-widest mb-3">From the blog</div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Procurement insights for UK practices</h2>
              </div>
              <Link href="/blog" className="hidden sm:flex items-center gap-2 text-sm font-bold text-slate-600 border-2 border-slate-200 px-4 py-2 rounded-xl hover:border-[#6C3DE8]/40 hover:text-[#6C3DE8] transition-all">
                View all articles
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  slug: "how-uk-dental-practices-can-cut-supply-costs",
                  category: "Procurement",
                  categoryIcon: "savings",
                  gradientFrom: "from-[#6C3DE8]",
                  gradientTo: "to-violet-400",
                  title: "How UK Dental Practices Can Cut Supply Costs by Up to 20%",
                  description: "Most UK dental practices overpay on supplies without realising it. Here's exactly how to fix it.",
                  readTime: "6 min read",
                },
                {
                  slug: "henry-schein-vs-kent-express-vs-dental-sky",
                  category: "Suppliers",
                  categoryIcon: "storefront",
                  gradientFrom: "from-emerald-500",
                  gradientTo: "to-teal-400",
                  title: "Henry Schein vs Kent Express vs Dental Sky: Which Is Cheapest?",
                  description: "A head-to-head price comparison of the three biggest UK dental suppliers across the most commonly ordered products.",
                  readTime: "7 min read",
                },
                {
                  slug: "how-to-compare-dental-supplier-prices-uk-2026",
                  category: "Procurement",
                  categoryIcon: "compare_arrows",
                  gradientFrom: "from-orange-400",
                  gradientTo: "to-rose-400",
                  title: "How to Compare Dental Supplier Prices in the UK (2026 Guide)",
                  description: "A practical step-by-step guide to comparing prices across Henry Schein, Kent Express, Dental Sky and more.",
                  readTime: "5 min read",
                },
              ].map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group bg-white rounded-2xl border border-slate-100 hover:border-[#6C3DE8]/30 hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden"
                >
                  {/* Gradient header image */}
                  <div className={`h-32 bg-gradient-to-br ${post.gradientFrom} ${post.gradientTo} relative flex items-center justify-center overflow-hidden`}>
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
                    <span className="material-symbols-outlined text-white text-5xl opacity-80" style={{ fontVariationSettings: "'FILL' 1" }}>{post.categoryIcon}</span>
                  </div>
                  <div className="p-7 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs font-bold bg-[#6C3DE8]/10 text-[#6C3DE8] px-3 py-1 rounded-full">{post.category}</span>
                      <span className="text-xs text-slate-400">{post.readTime}</span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-3 leading-snug group-hover:text-[#6C3DE8] transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed flex-1">{post.description}</p>
                    <div className="mt-5 text-sm font-bold text-[#6C3DE8] flex items-center gap-1">
                      Read article <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-8 sm:hidden text-center">
              <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 border-2 border-slate-200 px-4 py-2 rounded-xl">
                View all articles
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-slate-100 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 text-sm text-[#494455] mb-16">
            {/* Brand col */}
            <div className="col-span-2 md:col-span-1">
              <div className="text-2xl font-extrabold text-[#6C3DE8] mb-3">Dentago</div>
              <p className="leading-relaxed opacity-70 font-medium text-xs mb-5">
                Free dental procurement marketplace for UK practices. Compare prices, save time, order smarter.
              </p>
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 mb-5 uppercase tracking-wider text-xs">Product</h4>
              <ul className="space-y-3 font-bold text-xs">
                {["Price Compare", "Unified Cart", "Supplier Portal"].map((item) => (
                  <li key={item}><a className="hover:text-[#6C3DE8] transition-colors" href="#">{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 mb-5 uppercase tracking-wider text-xs">Company</h4>
              <ul className="space-y-3 font-bold text-xs">
                {[{ label: "About Us", href: "#" }, { label: "Blog", href: "/blog" }, { label: "Contact", href: "#" }].map((item) => (
                  <li key={item.label}><Link className="hover:text-[#6C3DE8] transition-colors" href={item.href}>{item.label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 mb-5 uppercase tracking-wider text-xs">Legal</h4>
              <ul className="space-y-3 font-bold text-xs">
                {["Privacy Policy", "Terms of Service"].map((item) => (
                  <li key={item}><a className="hover:text-[#6C3DE8] transition-colors" href="#">{item}</a></li>
                ))}
              </ul>
            </div>
            {/* Newsletter col */}
            <div>
              <h4 className="font-extrabold text-slate-900 mb-5 uppercase tracking-wider text-xs">Newsletter</h4>
              {newsletterDone ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-3 text-xs font-bold text-emerald-600">
                  Thanks! You&apos;re subscribed.
                </div>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); if (newsletterEmail.trim()) setNewsletterDone(true); }}
                  className="space-y-2"
                >
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={e => setNewsletterEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:border-[#6C3DE8]/40 transition-colors"
                  />
                  <button
                    type="submit"
                    className="w-full bg-[#6C3DE8] text-white text-xs font-bold py-2.5 rounded-xl hover:brightness-110 transition-all"
                  >
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          </div>
          <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            <div>© 2026 Dentago Ltd. Proudly based in London.</div>
            <div className="flex space-x-8 mt-6 md:mt-0">
              <a className="hover:text-[#6C3DE8] transition-colors" href="#">LinkedIn</a>
              <a className="hover:text-[#6C3DE8] transition-colors" href="#">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const AI_SLIDES = [
  {
    id: "savings",
    label: "Your Potential Savings",
    icon: "savings",
    iconBg: "bg-emerald-50", iconColor: "text-emerald-500",
    content: (
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, rgba(108,61,232,0.04) 0%, rgba(16,185,129,0.04) 100%)", border: "1px solid rgba(108,61,232,0.08)" }}>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em] mb-3">Your potential savings</p>
        <div className="flex items-end gap-3 mb-4">
          <span className="text-4xl font-extrabold text-emerald-500 tracking-tighter">£4,200</span>
          <span className="text-sm font-semibold text-slate-400 mb-1">/ year est.</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div className="h-full w-[82%] rounded-full" style={{ background: "linear-gradient(90deg, #6C3DE8, #10b981)" }} />
        </div>
        <p className="text-[10px] text-slate-400 font-medium">Based on avg UK practice spend of £28k/yr</p>
      </div>
    ),
  },
  {
    id: "equivalent",
    label: "Clinical Equivalent Found",
    icon: "swap_horiz",
    iconBg: "bg-emerald-50", iconColor: "text-emerald-500",
    content: (
      <div className="rounded-2xl p-5 bg-emerald-50 border border-emerald-100">
        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.16em] mb-4">Clinical Equivalent · Save £145/mo</p>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 min-w-0 bg-white rounded-xl px-3 py-3 border border-slate-100 text-xs font-bold text-slate-500 text-center">Cranberry Nitrile<br /><span className="text-rose-400 line-through">£5.65</span></div>
          <span className="material-symbols-outlined text-emerald-500 text-[20px] flex-shrink-0">arrow_forward</span>
          <div className="flex-1 min-w-0 rounded-xl px-3 py-3 text-xs font-bold text-white text-center" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>Eco-Preferred<br />£4.20 ✓</div>
        </div>
        <p className="text-[10px] text-emerald-700 font-semibold">Same clinical performance · CE marked · In stock</p>
      </div>
    ),
  },
  {
    id: "lowstock",
    label: "Low Stock Alert",
    icon: "inventory_2",
    iconBg: "bg-amber-50", iconColor: "text-amber-500",
    content: (
      <div className="space-y-2.5">
        {[
          { name: "Composite Resin A2", units: 3, max: 20, urgent: true },
          { name: "Articaine 4% × 50", units: 6, max: 20, urgent: false },
          { name: "Nitrile Gloves L", units: 2, max: 10, urgent: true },
        ].map(item => (
          <div key={item.name} className="bg-white rounded-2xl border border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">{item.name}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.urgent ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-600"}`}>{item.units} left</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${item.urgent ? "bg-rose-400" : "bg-amber-400"}`} style={{ width: `${(item.units / item.max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "pricedrop",
    label: "Price Drop Detected",
    icon: "trending_down",
    iconBg: "bg-violet-50", iconColor: "text-[#6C3DE8]",
    content: (
      <div className="rounded-2xl p-5" style={{ background: "rgba(108,61,232,0.04)", border: "1px solid rgba(108,61,232,0.10)" }}>
        <p className="text-[10px] font-black text-[#6C3DE8] uppercase tracking-[0.16em] mb-4">3 Price Drops This Week</p>
        {[
          { product: "ProTaper Gold F1", supplier: "Kent Express", from: "£34.00", to: "£29.50", drop: "13%" },
          { product: "Optim 33 TB Wipes", supplier: "Dental Sky", from: "£11.90", to: "£9.80", drop: "18%" },
        ].map(item => (
          <div key={item.product} className="flex items-center justify-between mb-3.5 last:mb-0">
            <div>
              <p className="text-xs font-bold text-slate-800">{item.product}</p>
              <p className="text-[10px] text-slate-400">{item.supplier}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 line-through">{item.from}</p>
              <p className="text-sm font-extrabold text-emerald-500">{item.to} <span className="text-[10px]">↓{item.drop}</span></p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "reorder",
    label: "Smart Reorder Ready",
    icon: "autorenew",
    iconBg: "bg-violet-50", iconColor: "text-[#6C3DE8]",
    content: (
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, rgba(108,61,232,0.05) 0%, rgba(124,77,255,0.03) 100%)", border: "1px solid rgba(108,61,232,0.10)" }}>
        <p className="text-[10px] font-black text-[#6C3DE8] uppercase tracking-[0.16em] mb-3">Monthly Reorder · Optimised</p>
        <div className="space-y-2 mb-4">
          {["Nitrile Gloves L × 5", "Articaine 4% × 2", "Composite A2 × 3", "Type IIR Masks × 4"].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-emerald-500 text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
              </span>
              {item}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-[#6C3DE8]/10">
          <span className="text-xs text-slate-400 font-semibold">Best-price total</span>
          <span className="text-xl font-extrabold text-[#6C3DE8]">£347.20</span>
        </div>
      </div>
    ),
  },
];

function AIInsightsWidget() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("up");

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection("up");
      setAnimating(true);
      setTimeout(() => {
        setActiveIdx(i => (i + 1) % AI_SLIDES.length);
        setAnimating(false);
      }, 300);
    }, 3600);
    return () => clearInterval(timer);
  }, []);

  function goTo(idx: number) {
    if (idx === activeIdx) return;
    setDirection(idx > activeIdx ? "up" : "down");
    setAnimating(true);
    setTimeout(() => {
      setActiveIdx(idx);
      setAnimating(false);
    }, 300);
  }

  const slide = AI_SLIDES[activeIdx];

  return (
    <div
      className="relative w-full rounded-[2rem] select-none overflow-hidden flex flex-col p-7"
      style={{
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(108,61,232,0.10)",
        boxShadow: "0 8px 48px rgba(108,61,232,0.10), 0 1px 0 rgba(255,255,255,0.9) inset",
      }}
    >
      {/* Subtle purple glow top-right */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#6C3DE8] opacity-[0.06] blur-[50px]" />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em]">AI Procurement Insights</span>
        </div>
        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">Live</span>
      </div>

      {/* Slide title */}
      <div
        className="relative flex items-center gap-2.5 mb-5 transition-all duration-300"
        style={{
          opacity: animating ? 0 : 1,
          transform: animating
            ? direction === "up" ? "translateY(-8px)" : "translateY(8px)"
            : "translateY(0)",
        }}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${slide.iconBg}`}>
          <span className={`material-symbols-outlined text-[20px] ${slide.iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>{slide.icon}</span>
        </div>
        <span className="text-sm font-black text-[#151121] tracking-tight">{slide.label}</span>
      </div>

      {/* Slide content — fixed height */}
      <div className="relative overflow-hidden" style={{ minHeight: 220 }}>
        <div
          className="transition-all duration-300"
          style={{
            opacity: animating ? 0 : 1,
            transform: animating
              ? direction === "up" ? "translateY(-10px)" : "translateY(10px)"
              : "translateY(0)",
          }}
        >
          {slide.content}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="relative flex items-center gap-1.5 mt-6">
        {AI_SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${
              i === activeIdx
                ? "w-6 h-1.5 bg-[#6C3DE8]"
                : "w-1.5 h-1.5 bg-slate-200 hover:bg-slate-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`bg-white border rounded-[2rem] overflow-hidden transition-colors duration-300 ${open ? "border-[#6C3DE8]/30" : "border-slate-200 hover:border-[#6C3DE8]/30"}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center p-8 cursor-pointer text-left"
      >
        <span className="text-lg font-bold text-[#151121]">{q}</span>
        <span
          className={`material-symbols-outlined text-slate-400 transition-transform duration-300 flex-shrink-0 ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48 pb-8" : "max-h-0"}`}>
        <p className="px-8 text-[#494455] leading-relaxed font-medium">{a}</p>
      </div>
    </div>
  );
}
