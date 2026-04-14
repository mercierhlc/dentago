"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Search, LayoutDashboard, Menu, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/search", label: "Search Products", icon: Search },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export default function Navbar({ cartCount = 3 }: { cartCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
              <span className="text-xs font-bold text-primary-foreground">D</span>
            </div>
            <span className="text-lg font-700 tracking-tight text-foreground">
              Dentago
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {nav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "text-sm font-medium transition-colors duration-150",
                  pathname === href
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="relative flex items-center justify-center h-9 w-9 rounded-md transition-colors hover:bg-secondary"
              aria-label="Cart"
            >
              <ShoppingCart size={18} className="text-muted-foreground" />
              {cartCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                  {cartCount}
                </Badge>
              )}
            </Link>
            <Link
              href="/search"
              className="hidden md:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start Ordering
            </Link>
            <button
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-2">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          <Link
            href="/search"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Start Ordering
          </Link>
        </div>
      )}
    </header>
  );
}
