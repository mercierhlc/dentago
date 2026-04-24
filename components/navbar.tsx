"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ProfileMenu from "@/components/ProfileMenu";
import { getClinic } from "@/lib/auth";

type Clinic = { id: string; clinic_name: string; email: string };

interface NavbarProps {
  /** Optional inline search bar rendered in the centre (search page) */
  searchSlot?: React.ReactNode;
  /** Optional right-side extras (e.g. cart button) */
  rightSlot?: React.ReactNode;
}

const PROTECTED = new Set(["/dashboard", "/orders"]);

export default function Navbar({ searchSlot, rightSlot }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setClinic(getClinic());
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.55)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderBottom: scrolled
          ? "1px solid rgba(108,61,232,0.10)"
          : "1px solid rgba(255,255,255,0.65)",
        boxShadow: scrolled
          ? "0 4px 32px rgba(108,61,232,0.08), inset 0 1px 0 rgba(255,255,255,0.85)"
          : "inset 0 1px 0 rgba(255,255,255,0.75)",
      }}
    >
      <div className="flex items-center gap-4 px-6 sm:px-8 h-[62px] max-w-7xl mx-auto">

        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-extrabold tracking-tighter text-[#6C3DE8] flex-shrink-0 hover:opacity-80 transition-opacity"
        >
          Dentago
        </Link>

        {/* Nav links — only when no search slot */}
        {!searchSlot && (
          <div className="hidden md:flex items-center gap-0.5 ml-1">
            {[
              { href: "/search",    label: "Browse" },
              { href: "/dashboard", label: "Dashboard" },
              { href: "/orders",    label: "Orders" },
            ].map(({ href, label }) => (
              <button
                key={href}
                onClick={() => {
                  if (PROTECTED.has(href) && !clinic) {
                    router.push("/onboarding/login.html");
                  } else {
                    router.push(href);
                  }
                }}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  pathname === href
                    ? "bg-[#6C3DE8]/8 text-[#6C3DE8]"
                    : "text-slate-500 hover:text-[#151121] hover:bg-black/[0.04]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Inline search slot */}
        {searchSlot && <div className="flex-1 mx-2 max-w-2xl">{searchSlot}</div>}

        {/* Spacer */}
        {!searchSlot && <div className="flex-1" />}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {rightSlot}

          {clinic ? (
            <ProfileMenu clinic={clinic} />
          ) : (
            <>
              <Link
                href="/onboarding/login.html"
                className="hidden sm:inline-flex text-sm font-semibold text-slate-500 px-3.5 py-2 rounded-xl hover:text-[#151121] hover:bg-black/[0.04] transition-all"
              >
                Log in
              </Link>
              <Link
                href="/onboarding/step1.html"
                className="text-sm font-bold text-white px-4 py-2.5 rounded-xl transition-all hover:brightness-110 active:scale-95 flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #7C4DFF 0%, #6C3DE8 100%)",
                  boxShadow: "0 2px 12px rgba(108,61,232,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
                }}
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
