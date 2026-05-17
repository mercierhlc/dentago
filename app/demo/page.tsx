"use client";

import Navbar from "@/components/navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { SITE_NAV_BAR_HEIGHT_PX } from "@/lib/site-layout";

const CALENDLY_URL =
  "https://calendly.com/rnsv/dentago-introduction?hide_gdpr_banner=1&primary_color=6c3de8";

const BENEFITS = [
  {
    icon: "compare_arrows",
    title: "Live price comparison",
    desc: "See exactly how much you’re overpaying across your current suppliers — with your real catalogue prices.",
  },
  {
    icon: "shopping_cart_checkout",
    title: "Unified checkout walkthrough",
    desc: "Watch how a multi-supplier order gets placed in under two minutes, from search to confirmation.",
  },
  {
    icon: "psychology",
    title: "AI assistant demo",
    desc: "Real-time substitution ideas, stock context, and faster decisions without leaving the tab.",
  },
  {
    icon: "savings",
    title: "Savings estimate for your practice",
    desc: "We’ll sketch a live savings range based on your spend profile and supplier mix.",
  },
] as const;

/** Soft SaaS card — Hightouch-adjacent shadow, Dentago ink */
const cardShell =
  "rounded-3xl border border-[#0e0f12]/[0.07] bg-white shadow-[0_20px_70px_-24px_rgba(14,15,18,0.14)]";

const ease = [0.22, 1, 0.36, 1] as const;

export default function DemoPage() {
  useEffect(() => {
    function handleCalendly(e: MessageEvent) {
      if (e.data?.event === "calendly.event_scheduled") {
        if (typeof window.gtag === "function") {
          window.gtag("event", "demo_booked", { event_category: "conversion" });
        }
      }
    }
    window.addEventListener("message", handleCalendly);
    return () => window.removeEventListener("message", handleCalendly);
  }, []);

  const heroPadTop = `calc(var(--dentago-announce-px, 43px) + ${SITE_NAV_BAR_HEIGHT_PX}px + 76px)`;

  return (
    <div className="min-h-screen bg-white text-[#0e0f12] overflow-x-hidden antialiased">
      <Navbar />

      {/* ── Hero: intro, then booking (single column) ── */}
      <section
        className="max-w-[1320px] mx-auto px-6 sm:px-8 lg:px-10 pb-16 lg:pb-20"
        style={{ paddingTop: heroPadTop }}
      >
        <div className="flex flex-col items-center w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="w-full max-w-2xl text-center"
          >
            <p
              className="inline-flex items-center gap-2 font-medium text-[11px] uppercase tracking-[0.14em] text-[#5b606b] mb-8 justify-center"
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#1f6f5c]" aria-hidden />
              Free 30-minute demo
            </p>

            <h1 className="text-[2.35rem] sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08] font-extrabold tracking-[-0.03em] text-[#0e0f12]">
              See Dentago{" "}
              <span
                className="italic font-normal"
                style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}
              >
                in action
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-[#5b606b] font-medium leading-relaxed">
              Book a personalised walkthrough with our team. We&apos;ll show you how Dentago saves
              your practice time and money from day one — no generic deck, just your workflow.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#0e0f12]/10 bg-[#fafaf9] px-4 py-2 text-[13px] font-semibold text-[#1a1c20]">
                <span className="material-symbols-outlined text-[18px] text-[#5b606b]">schedule</span>
                30 minutes
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#0e0f12]/10 bg-[#fafaf9] px-4 py-2 text-[13px] font-semibold text-[#1a1c20]">
                <span className="material-symbols-outlined text-[18px] text-[#5b606b]">videocam</span>
                Video call
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease, delay: 0.08 }}
            className="w-full mt-12 lg:mt-14 min-w-0 self-stretch"
          >
            <div className={`${cardShell} overflow-hidden w-full`}>
              <div
                className="px-5 sm:px-6 py-4 border-b border-[#0e0f12]/[0.06] flex flex-wrap items-center justify-between gap-3"
                style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#5b606b]">
                  Book a time
                </span>
                <span className="text-[11px] font-semibold text-[#0e0f12]">Dentago introduction</span>
              </div>
              <iframe
                title="Book a Dentago Calendly demo"
                src={CALENDLY_URL}
                width="100%"
                className="min-h-[620px] sm:min-h-[680px] lg:min-h-[720px] w-full border-0 bg-white"
                loading="lazy"
              />
            </div>
            <p className="mt-4 text-center text-[13px] text-[#5b606b] font-medium">
              Prefer email?{" "}
              <a
                href="mailto:mercier@dentago.co.uk?subject=Dentago%20demo%20request"
                className="font-semibold text-[#0e0f12] underline decoration-[#0e0f12]/25 underline-offset-4 hover:decoration-[#111111] hover:text-[#111111] transition-colors"
              >
                mercier@dentago.co.uk
              </a>
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Platform preview video ── */}
      <section className="max-w-[1320px] mx-auto px-6 sm:px-8 lg:px-10 pb-16 lg:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.45, ease }}
          className={`${cardShell} overflow-hidden group`}
        >
          <div className="aspect-[16/9] sm:aspect-[2/1] relative bg-[#f4f4f2]">
            <video
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              src="/demo.mp4"
              autoPlay
              muted
              loop
              playsInline
              aria-label="Dentago product preview video"
            />
            <div className="absolute bottom-4 left-4">
              <span
                className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-[#0e0f12] border border-[#0e0f12]/8 shadow-sm backdrop-blur-sm"
                style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
              >
                <span className="material-symbols-outlined text-[15px] text-[#1f6f5c]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_circle
                </span>
                Platform preview
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Benefits + testimonial ── */}
      <section className="max-w-[1320px] mx-auto px-6 sm:px-8 lg:px-10 pb-20 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, ease }}
            className={`${cardShell} p-8 sm:p-10 lg:p-11`}
          >
            <h2 className="text-lg font-extrabold tracking-tight text-[#0e0f12] mb-8">
              What you&apos;ll get
            </h2>
            <ul className="space-y-8">
              {BENEFITS.map(({ icon, title, desc }, i) => (
                <motion.li
                  key={title}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.06, ease }}
                  className="flex gap-4 sm:gap-5"
                >
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f4f4f2] border border-[#0e0f12]/[0.06]">
                    <span className="material-symbols-outlined text-[#0e0f12] text-[22px]">{icon}</span>
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="font-bold text-[#0e0f12] text-[15px] leading-snug">{title}</p>
                    <p className="text-[15px] text-[#5b606b] font-medium leading-relaxed mt-1">{desc}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, ease, delay: 0.05 }}
            className={`${cardShell} p-8 sm:p-10 lg:p-11 bg-[#fafaf9] border-[#0e0f12]/[0.05]`}
          >
            <p
              className="text-[1.5rem] sm:text-[1.65rem] leading-snug text-[#0e0f12]"
              style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontStyle: "italic" }}
            >
              The thirty-minute demo paid for itself — we found £800 of savings in the first week.
            </p>
            <p
              className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b606b]"
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              Practice manager · Bristol
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease }}
          className="mt-12 flex flex-wrap items-center gap-6 justify-center text-[14px] font-semibold"
        >
          <Link
            href="/search"
            className="inline-flex items-center gap-2 text-[#5b606b] hover:text-[#0e0f12] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to marketplace
          </Link>
          <span className="hidden sm:inline text-[#0e0f12]/15">·</span>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 text-[#0e0f12] hover:text-[#111111] transition-colors"
          >
            Start free instead
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </motion.div>
      </section>

      <div className="dentago-marketing-root">
        <Footer />
      </div>
    </div>
  );
}
