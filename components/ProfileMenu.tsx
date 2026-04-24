"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getClinic, clearAuth } from "@/lib/auth";

type Clinic = { id: string; clinic_name: string; email: string };

export default function ProfileMenu({ clinic }: { clinic: Clinic | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!clinic) return (
    <Link
      href="/onboarding/login.html"
      className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-sm font-bold hover:border-[#6C3DE8]/30 hover:text-[#6C3DE8] transition-all"
    >
      Log In
    </Link>
  );

  const initial = clinic.clinic_name?.[0]?.toUpperCase() ?? "C";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all ${
          open
            ? "border-[#6C3DE8]/30 bg-[#6C3DE8]/5"
            : "border-slate-200 hover:border-[#6C3DE8]/20 hover:bg-slate-50"
        }`}
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6C3DE8] to-violet-500 flex items-center justify-center text-white font-black text-xs shadow-sm shadow-[#6C3DE8]/20 flex-shrink-0">
          {initial}
        </div>
        <span className="hidden sm:inline text-sm font-semibold text-slate-700 max-w-[120px] truncate">
          {clinic.clinic_name}
        </span>
        <span
          className={`material-symbols-outlined text-[14px] text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-56 bg-white rounded-2xl border border-slate-100 shadow-[0_8px_40px_rgba(108,61,232,0.12)] overflow-hidden z-50 animate-dropdown">

          {/* Clinic info */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-gradient-to-br from-[#6C3DE8]/[0.04] to-transparent">
            <p className="text-xs font-black text-[#151121] truncate">{clinic.clinic_name}</p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">{clinic.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-[#6C3DE8] hover:bg-[#6C3DE8]/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[17px] text-slate-400">dashboard</span>
              Dashboard
            </Link>
            <Link
              href="/orders"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-[#6C3DE8] hover:bg-[#6C3DE8]/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[17px] text-slate-400">receipt_long</span>
              Order History
            </Link>
            <Link
              href="/cart"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-[#6C3DE8] hover:bg-[#6C3DE8]/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[17px] text-slate-400">shopping_cart</span>
              Cart
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t border-slate-100 py-1.5">
            <button
              onClick={() => { clearAuth(); window.location.href = "/onboarding/login.html"; }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[17px]">logout</span>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
