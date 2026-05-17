"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { clearAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Clinic = { id: string; clinic_name: string; email: string };

const iconCls =
  "material-symbols-outlined shrink-0 text-[18px] leading-none text-slate-400 dark:text-slate-500";

const rowCls =
  "mx-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-900/[0.045] hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/[0.06] dark:hover:text-white";

const signOutCls =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-rose-500/[0.06] hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-500/[0.08] dark:hover:text-rose-300";

function MenuIcon({ name }: { name: string }) {
  return <span className={iconCls}>{name}</span>;
}

function SupplierIntegrationsMenuItem({ pathname, onClose }: { pathname: string | null; onClose: () => void }) {
  const searchParams = useSearchParams();
  const hide = pathname === "/settings" && searchParams.get("tab") === "integrations";
  if (hide) return null;
  return (
    <Link href="/settings?tab=integrations" role="menuitem" onClick={onClose} className={rowCls}>
      <MenuIcon name="link" />
      Connect suppliers
    </Link>
  );
}

export default function ProfileMenu({ clinic }: { clinic: Clinic | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!clinic) {
    return (
      <Link
        href="/login"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all",
          "border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.72)] text-slate-800 backdrop-blur-md",
          "shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[rgba(108,61,232,0.22)] hover:bg-[rgba(255,255,255,0.92)] hover:text-slate-900",
          "dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.10]",
        )}
      >
        Log in
      </Link>
    );
  }

  const initial = clinic.clinic_name?.[0]?.toUpperCase() ?? "C";

  const panel = cn(
    "absolute right-0 top-[calc(100%+10px)] z-50 w-[min(15.5rem,calc(100vw-1.25rem))] overflow-hidden rounded-[22px] animate-dropdown",
    "border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.82)] shadow-[0_18px_55px_rgba(15,23,42,0.12)] backdrop-blur-xl",
    "dark:border-white/[0.10] dark:bg-[rgba(22,23,34,0.88)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1.5 transition-all",
          "border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.65)] backdrop-blur-md",
          "hover:border-[rgba(15,23,42,0.14)] hover:bg-[rgba(255,255,255,0.88)]",
          "dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.10]",
          open && "border-[rgba(15,23,42,0.22)] bg-[rgba(255,255,255,0.95)] ring-1 ring-[rgba(15,23,42,0.10)] dark:border-white/20 dark:bg-white/[0.12] dark:ring-white/10",
        )}
      >
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm",
            "bg-[#111111]",
          )}
        >
          {initial}
        </div>
        <span className="hidden max-w-[120px] truncate text-sm font-semibold tracking-[-0.02em] text-slate-800 dark:text-slate-100 sm:inline">
          {clinic.clinic_name}
        </span>
        <span
          className={cn(
            "material-symbols-outlined text-[16px] text-slate-400 transition-transform duration-200 dark:text-slate-500",
            open && "rotate-180",
          )}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className={panel} role="menu">
          <div className="border-b border-[rgba(15,23,42,0.06)] px-4 py-3.5 dark:border-white/[0.08]">
            <p className="truncate text-sm font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-50">
              {clinic.clinic_name}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{clinic.email}</p>
          </div>

          <nav className="py-1.5" aria-label="Account">
            {pathname !== "/dashboard" && (
              <Link href="/dashboard" role="menuitem" onClick={() => setOpen(false)} className={rowCls}>
                <MenuIcon name="dashboard" />
                Dashboard
              </Link>
            )}
            {pathname !== "/orders" && (
              <Link href="/orders" role="menuitem" onClick={() => setOpen(false)} className={rowCls}>
                <MenuIcon name="receipt_long" />
                Order history
              </Link>
            )}
            <Suspense
              fallback={
                <Link href="/settings?tab=integrations" role="menuitem" onClick={() => setOpen(false)} className={rowCls}>
                  <MenuIcon name="link" />
                  Connect suppliers
                </Link>
              }
            >
              <SupplierIntegrationsMenuItem pathname={pathname} onClose={() => setOpen(false)} />
            </Suspense>
            {pathname !== "/clinic/analytics" && (
              <Link href="/clinic/analytics" role="menuitem" onClick={() => setOpen(false)} className={rowCls}>
                <MenuIcon name="bar_chart" />
                Analytics
              </Link>
            )}
            {pathname !== "/savings" && (
              <Link href="/savings" role="menuitem" onClick={() => setOpen(false)} className={rowCls}>
                <MenuIcon name="savings" />
                My savings
              </Link>
            )}
            {pathname !== "/cart" && (
              <Link href="/cart" role="menuitem" onClick={() => setOpen(false)} className={rowCls}>
                <MenuIcon name="shopping_cart" />
                Cart
              </Link>
            )}
          </nav>

          <div className="border-t border-[rgba(15,23,42,0.06)] py-1.5 dark:border-white/[0.08]">
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                await clearAuth();
                window.location.href = "/login";
              }}
              className={signOutCls}
            >
              <MenuIcon name="logout" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
