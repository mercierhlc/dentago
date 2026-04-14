"use client";
import { useState } from "react";
import Navbar from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, ShoppingCart, CheckCircle, AlertTriangle, TrendingDown } from "lucide-react";

const categories = ["All", "Consumables", "PPE", "Anaesthetics", "Instruments", "Infection Control", "Implants", "Diagnostics"];

const products = [
  {
    id: 1, name: "Nitrile Examination Gloves — Large (Box of 100)", brand: "Cranberry", category: "PPE",
    suppliers: [
      { name: "Dental Sky", price: 4.85, stock: true, delivery: "Next day", sku: "DS-NG-L100" },
      { name: "Kent Express", price: 5.20, stock: true, delivery: "2–3 days", sku: "KE-7821" },
      { name: "Henry Schein", price: 5.65, stock: true, delivery: "Next day", sku: "HS-401234" },
      { name: "DHB", price: 4.95, stock: false, delivery: "5–7 days", sku: "DHB-N100L" },
    ],
  },
  {
    id: 2, name: "Septanest 4% Articaine with Epinephrine 1:100,000 (50 cartridges)", brand: "Septodont", category: "Anaesthetics",
    suppliers: [
      { name: "Henry Schein", price: 28.40, stock: true, delivery: "Next day", sku: "HS-189023" },
      { name: "Kent Express", price: 29.80, stock: true, delivery: "2–3 days", sku: "KE-4421" },
      { name: "Dental Sky", price: 31.20, stock: false, delivery: "3–5 days", sku: "DS-SEP50" },
    ],
  },
  {
    id: 3, name: "3M ESPE Filtek Z250 Universal Restorative — A1 Syringe 4g", brand: "3M ESPE", category: "Consumables",
    suppliers: [
      { name: "Henry Schein", price: 18.75, stock: true, delivery: "Next day", sku: "HS-701892" },
      { name: "Kent Express", price: 19.40, stock: true, delivery: "2–3 days", sku: "KE-3M-A1" },
      { name: "Wrights", price: 17.90, stock: true, delivery: "Next day", sku: "WR-3MZ250A1" },
    ],
  },
  {
    id: 4, name: "FKG ProTaper Gold Rotary Files — F1 25mm (6 pcs)", brand: "FKG Dentaire", category: "Instruments",
    suppliers: [
      { name: "Trycare", price: 32.50, stock: true, delivery: "Next day", sku: "TC-PTG-F1" },
      { name: "Kent Express", price: 34.00, stock: true, delivery: "2–3 days", sku: "KE-8811" },
      { name: "DMI", price: 33.10, stock: false, delivery: "5–7 days", sku: "DMI-PTGF1" },
    ],
  },
  {
    id: 5, name: "Dentsply Aquasil Ultra+ LV Regular Set — 50ml Cartridge", brand: "Dentsply Sirona", category: "Consumables",
    suppliers: [
      { name: "Henry Schein", price: 42.60, stock: true, delivery: "Next day", sku: "HS-AQU-LV" },
      { name: "Dental Sky", price: 44.10, stock: true, delivery: "2–3 days", sku: "DS-AQULV" },
      { name: "DHB", price: 41.80, stock: true, delivery: "2–3 days", sku: "DHB-AQU50" },
    ],
  },
];

function bestPrice(suppliers: typeof products[0]["suppliers"]) {
  return Math.min(...suppliers.filter(s => s.stock).map(s => s.price));
}

function savings(suppliers: typeof products[0]["suppliers"]) {
  const prices = suppliers.filter(s => s.stock).map(s => s.price);
  return Math.max(...prices) - Math.min(...prices);
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<Record<string, { supplier: string; price: number }>>({});

  const filtered = products.filter(p => {
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    const matchQ = query === "" || p.name.toLowerCase().includes(query.toLowerCase()) || p.brand.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  function addToCart(productId: number, supplier: string, price: number) {
    setCart(prev => ({ ...prev, [productId]: { supplier, price } }));
  }

  const cartCount = Object.keys(cart).length;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar cartCount={cartCount} />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Search Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Compare prices across all your suppliers in real time</p>
        </div>

        {/* Search bar */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, brands, SKUs..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <button className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors">
            <SlidersHorizontal size={15} />Filters
          </button>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap mb-8">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-6">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""} found
          {activeCategory !== "All" ? ` in ${activeCategory}` : ""}
        </p>

        {/* Product cards */}
        <div className="space-y-4">
          {filtered.map(product => {
            const best = bestPrice(product.suppliers);
            const save = savings(product.suppliers);
            const inCart = cart[product.id];

            return (
              <div key={product.id} className="rounded-lg border border-border bg-card overflow-hidden">
                {/* Product header */}
                <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-secondary text-muted-foreground border-0 text-xs">{product.category}</Badge>
                      {save > 0.5 && (
                        <Badge className="bg-primary/10 text-primary border-0 text-xs flex items-center gap-1">
                          <TrendingDown size={10} />Save up to £{save.toFixed(2)}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground text-sm leading-snug">{product.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{product.brand}</p>
                  </div>
                  {inCart && (
                    <Badge className="flex-shrink-0 bg-primary/10 text-primary border border-primary/20 text-xs">
                      <CheckCircle size={10} className="mr-1" />In cart — {inCart.supplier}
                    </Badge>
                  )}
                </div>

                {/* Supplier comparison table */}
                <div className="divide-y divide-border">
                  {product.suppliers.sort((a, b) => a.price - b.price).map((supplier, i) => {
                    const isBest = supplier.stock && supplier.price === best;
                    return (
                      <div
                        key={supplier.name}
                        className={`flex items-center gap-4 px-5 py-3 ${isBest ? "bg-primary/5" : ""}`}
                      >
                        {/* Best price indicator */}
                        <div className="w-2 flex-shrink-0">
                          {isBest && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>

                        {/* Supplier name */}
                        <div className="w-32 flex-shrink-0">
                          <p className="text-sm font-medium text-foreground">{supplier.name}</p>
                          <p className="text-xs text-muted-foreground">{supplier.sku}</p>
                        </div>

                        {/* Price */}
                        <div className="flex-1">
                          <span className={`text-lg font-bold ${isBest ? "text-primary" : "text-foreground"}`}>
                            £{supplier.price.toFixed(2)}
                          </span>
                          {isBest && <span className="ml-2 text-xs text-primary font-medium">Best Price</span>}
                        </div>

                        {/* Stock + delivery */}
                        <div className="hidden sm:flex items-center gap-1.5 w-32">
                          {supplier.stock ? (
                            <>
                              <CheckCircle size={13} className="text-primary flex-shrink-0" />
                              <span className="text-xs text-muted-foreground">{supplier.delivery}</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={13} className="text-destructive flex-shrink-0" />
                              <span className="text-xs text-muted-foreground">Out of stock</span>
                            </>
                          )}
                        </div>

                        {/* Add to cart */}
                        <button
                          onClick={() => supplier.stock && addToCart(product.id, supplier.name, supplier.price)}
                          disabled={!supplier.stock}
                          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex-shrink-0 ${
                            !supplier.stock
                              ? "opacity-40 cursor-not-allowed bg-secondary text-muted-foreground"
                              : inCart?.supplier === supplier.name
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground"
                          }`}
                        >
                          <ShoppingCart size={12} />
                          {inCart?.supplier === supplier.name ? "Added" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <Search size={32} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-foreground font-medium">No products found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search term or category</p>
          </div>
        )}
      </div>
    </div>
  );
}
