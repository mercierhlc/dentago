"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/auth";
import { motion } from "framer-motion";
import { DentagoLogo } from "@/components/DentagoLogo";
import { WelcomeHubDiagram } from "@/components/signup/WelcomeHubDiagram";

const CALENDLY = "https://calendly.com/rnsv/dentago-introduction";

function accountLineFromSession(user: { email?: string; user_metadata?: Record<string, unknown> } | null): string | null {
  if (!user?.email) return null;
  const meta = user.user_metadata ?? {};
  const full =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    "";
  const first = full ? full.split(/\s+/)[0] : user.email.split("@")[0] ?? "You";
  return `${first} · ${user.email}`;
}

export default function SignupWelcomePage() {
  const [accountLine, setAccountLine] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabaseBrowser!.auth.getUser();
      if (cancelled) return;
      setAccountLine(accountLineFromSession(user));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#fafaf8] font-sans text-[#0e0f12] antialiased">
      <header className="sticky top-0 z-40 border-b border-[rgba(14,15,18,0.08)] bg-[rgba(250,250,248,0.85)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-3.5 sm:px-7">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-[-0.02em] !text-[#0e0f12]">
            <DentagoLogo size={20} variant="solid" color="#0e0f12" wordmark={false} />
            Dentago
          </Link>
          {accountLine ? (
            <div className="hidden min-w-0 items-center gap-2 text-[13px] text-[#1a1c20] sm:flex">
              <span
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#0e0f12] font-serif text-[13px] italic text-white"
                aria-hidden
              >
                {accountLine.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{accountLine}</span>
            </div>
          ) : (
            <span className="hidden text-[13px] text-neutral-500 sm:inline">Signed in</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-6 pb-14 pt-10 sm:px-7 sm:pt-12">
        <div className="mx-auto max-w-[640px] text-center">
          <motion.h1
            className="font-serif text-[clamp(2.5rem,5.2vw,4rem)] font-normal leading-none tracking-[-0.02em] text-[#0e0f12]"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          >
            Welcome to <em className="text-neutral-500">Dentago</em>.
          </motion.h1>
          <motion.p
            className="mx-auto mt-3.5 max-w-[560px] text-[15px] leading-[1.55] text-neutral-600"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          >
            Dentago sits between every UK dental supplier and your procurement workspace — one tab to search, order, and
            track every pound your practice spends.
          </motion.p>
        </div>

        <WelcomeHubDiagram />

        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-2.5 sm:mt-12"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.75 }}
        >
          <Link
            href="/signup/demo"
            className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#0e0f12] px-16 py-4 text-base font-semibold !text-white transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-black shadow-[0_8px_28px_rgba(14,15,18,0.18)]"
          >
            Next
            <span
              className="!text-white transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            >
              →
            </span>
          </Link>
        </motion.div>

        <motion.p
          className="mt-4 flex flex-wrap items-center justify-center gap-2.5 text-center text-xs text-neutral-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.35, duration: 0.6 }}
        >
          <span>10,000+ products from top UK suppliers</span>
          <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-[#8a8f9b]" aria-hidden />
          <span>Free for every UK clinic, forever</span>
          <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-[#8a8f9b]" aria-hidden />
          <span>Setup in 5 minutes</span>
        </motion.p>

        {/* How it works demo */}
        <motion.div
          id="how-it-works"
          className="mt-20 scroll-mt-24"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">How it works</p>
          <h2 className="text-center font-serif text-[clamp(1.6rem,3.5vw,2.4rem)] font-normal leading-tight tracking-[-0.02em] text-[#0e0f12] mb-10">
            Search. Basket. Done.
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-[900px] mx-auto">
            {[
              {
                step: "01",
                icon: "search",
                title: "Search by SKU or name",
                desc: "Type a product name or your supplier SKU — e.g. 9009003 or 'nitrile gloves L'. Dentago searches across Henry Schein, DD Group, Dental Sky and more at once.",
                demo: "Try: search '9009003'",
                href: "/search?q=9009003",
                color: "#0e0f12",
              },
              {
                step: "02",
                icon: "add_shopping_cart",
                title: "Add to your basket",
                desc: "Pick the best price across suppliers. Add multiple products and Dentago groups them by supplier automatically — one basket, every supplier.",
                demo: "Add to basket",
                href: "/search",
                color: "#0891b2",
              },
              {
                step: "03",
                icon: "task_alt",
                title: "Order placed on your supplier",
                desc: "Connect your supplier account once. Dentago logs in and places the order on your behalf. Check your Henry Schein account — the order will be there.",
                demo: "Connect suppliers",
                href: "/clinic/suppliers",
                color: "#059669",
              },
            ].map(({ step, icon, title, desc, demo, href, color }) => (
              <Link key={step} href={href} className="group block rounded-[20px] border border-[rgba(14,15,18,0.08)] bg-white p-6 shadow-[0_2px_12px_rgba(14,15,18,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(14,15,18,0.1)] hover:border-[rgba(14,15,18,0.16)]">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-300">{step}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl" style={{ background: color + "18" }}>
                    <span className="material-symbols-outlined text-[20px]" style={{ color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>
                </div>
                <h3 className="mb-2 text-[15px] font-semibold text-[#0e0f12] leading-snug">{title}</h3>
                <p className="text-[13px] leading-relaxed text-neutral-500 mb-4">{desc}</p>
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold transition-colors duration-150" style={{ color }}>
                  {demo}
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/signup/finish"
              className="group inline-flex items-center gap-2 rounded-full bg-[#0e0f12] px-6 py-3.5 text-sm font-medium !text-white transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-black shadow-[0_4px_20px_rgba(14,15,18,0.2)]"
            >
              Get started — it&apos;s free
              <span className="!text-white transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>→</span>
            </Link>
            <p className="mt-3 text-xs text-neutral-400">
              Or{" "}
              <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-neutral-600 transition-colors">
                book a 10-minute walkthrough
              </a>{" "}
              — we&apos;ll walk through it live
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
