"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Trash2, ChevronRight, Package, CheckCircle, Clock } from "lucide-react";

const initialCart = [
  {
    supplier: "Dental Sky",
    color: "text-blue-400",
    items: [
      { id: 1, name: "Nitrile Examination Gloves — Large (Box 100)", sku: "DS-NG-L100", price: 4.85, qty: 3 },
      { id: 2, name: "Type II Plaster 5kg", sku: "DS-PL5KG", price: 8.40, qty: 1 },
    ],
  },
  {
    supplier: "Henry Schein",
    color: "text-red-400",
    items: [
      { id: 3, name: "Septanest 4% Articaine 1:100,000 (50 cartridges)", sku: "HS-189023", price: 28.40, qty: 2 },
      { id: 4, name: "3M ESPE Filtek Z250 A1 Syringe 4g", sku: "HS-701892", price: 18.75, qty: 4 },
    ],
  },
  {
    supplier: "Wrights",
    color: "text-green-400",
    items: [
      { id: 5, name: "Dentsply Aquasil Ultra+ LV 50ml Cartridge", sku: "WR-AQU50", price: 41.80, qty: 1 },
    ],
  },
];

type CartState = typeof initialCart;

export default function CartPage() {
  const [cartData, setCartData] = useState<CartState>(initialCart);
  const [placed, setPlaced] = useState(false);

  function updateQty(supplierIdx: number, itemIdx: number, delta: number) {
    setCartData(prev => prev.map((s, si) => si !== supplierIdx ? s : {
      ...s,
      items: s.items.map((item, ii) => ii !== itemIdx
        ? item
        : { ...item, qty: Math.max(1, item.qty + delta) }
      ),
    }));
  }

  function removeItem(supplierIdx: number, itemIdx: number) {
    setCartData(prev => prev.map((s, si) => si !== supplierIdx ? s : {
      ...s,
      items: s.items.filter((_, ii) => ii !== itemIdx),
    }).filter(s => s.items.length > 0));
  }

  const supplierTotals = cartData.map(s => ({
    name: s.supplier,
    total: s.items.reduce((sum, i) => sum + i.price * i.qty, 0),
    itemCount: s.items.reduce((sum, i) => sum + i.qty, 0),
  }));

  const grandTotal = supplierTotals.reduce((sum, s) => sum + s.total, 0);
  const totalItems = supplierTotals.reduce((sum, s) => sum + s.itemCount, 0);
  const estimatedSavings = grandTotal * 0.14;

  if (placed) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar cartCount={0} />
        <div className="flex flex-col items-center justify-center flex-1 px-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
            <CheckCircle size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Orders placed successfully</h1>
          <p className="text-muted-foreground max-w-md mb-8">
            {cartData.length === 0 ? initialCart.length : initialCart.length} separate orders have been submitted to your suppliers simultaneously. You'll receive confirmation emails from each.
          </p>
          <div className="w-full max-w-md space-y-3 mb-10">
            {initialCart.map(s => (
              <div key={s.supplier} className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <Package size={15} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{s.supplier}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Next day</span>
                  <CheckCircle size={13} className="text-primary" />
                </div>
              </div>
            ))}
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
            View Dashboard <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar cartCount={totalItems} />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Your Cart</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalItems} item{totalItems !== 1 ? "s" : ""} · {cartData.length} supplier order{cartData.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link href="/search" className="text-sm text-primary hover:underline flex items-center gap-1">
            Continue shopping <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-4">
            {cartData.map((supplier, si) => (
              <div key={supplier.supplier} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-secondary/30">
                  <Package size={15} className={supplier.color} />
                  <span className="text-sm font-semibold text-foreground">{supplier.supplier}</span>
                  <Badge className="ml-auto bg-secondary text-muted-foreground border-0 text-xs">
                    Order #{si + 1}
                  </Badge>
                </div>

                <div className="divide-y divide-border">
                  {supplier.items.map((item, ii) => (
                    <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.sku} · £{item.price.toFixed(2)} each</p>
                      </div>

                      {/* Qty controls */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => updateQty(si, ii, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded border border-border bg-secondary text-foreground hover:bg-muted transition-colors text-sm"
                        >−</button>
                        <span className="w-8 text-center text-sm font-medium text-foreground">{item.qty}</span>
                        <button
                          onClick={() => updateQty(si, ii, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded border border-border bg-secondary text-foreground hover:bg-muted transition-colors text-sm"
                        >+</button>
                      </div>

                      {/* Line total */}
                      <div className="w-16 text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-foreground">£{(item.price * item.qty).toFixed(2)}</p>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeItem(si, ii)}
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/20">
                  <span className="text-xs text-muted-foreground">Subtotal for {supplier.supplier}</span>
                  <span className="text-sm font-semibold text-foreground">
                    £{supplier.items.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}

            {cartData.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
                <ShoppingCart size={32} className="text-muted-foreground mb-4" />
                <p className="text-foreground font-medium">Your cart is empty</p>
                <Link href="/search" className="mt-3 text-sm text-primary hover:underline">Search for products</Link>
              </div>
            )}
          </div>

          {/* Order summary */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-semibold text-foreground mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                {supplierTotals.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{s.name} ({s.itemCount} item{s.itemCount !== 1 ? "s" : ""})</span>
                    <span className="text-foreground font-medium">£{s.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <Separator className="bg-border mb-4" />

              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Estimated savings vs list price</span>
                <span className="text-primary font-medium">−£{estimatedSavings.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between mb-6">
                <span className="text-base font-semibold text-foreground">Total</span>
                <span className="text-xl font-bold text-foreground">£{grandTotal.toFixed(2)}</span>
              </div>

              <button
                onClick={() => setPlaced(true)}
                disabled={cartData.length === 0}
                className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Place {cartData.length} Order{cartData.length !== 1 ? "s" : ""}
              </button>

              <p className="mt-3 text-xs text-muted-foreground text-center">
                Orders submitted simultaneously to each supplier
              </p>
            </div>

            {/* Supplier breakdown */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Supplier orders</h3>
              <div className="space-y-2">
                {supplierTotals.map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-xs text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="text-xs font-medium text-foreground">£{s.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
