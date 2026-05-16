"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { DentagoLogo } from "@/components/DentagoLogo";

type Step =
  | "idle"
  | "typing-email" | "typing-password" | "connect-ready" | "connecting" | "connected"
  | "search-1" | "results-1"
  | "search-2" | "results-2"
  | "basket" | "placing"
  | "invoice" | "savings";

// Steps where user must click to advance
const CLICK_NEXT: Partial<Record<Step, Step>> = {
  "connect-ready": "connecting",
  "connected":     "search-1",
  "results-1":     "search-2",
  "results-2":     "basket",
  "basket":        "placing",
  "invoice":       "savings",
};

const DEMO_EMAIL    = "orders@smiledental.co.uk";
const DEMO_PASSWORD = "Dental2024!";

const SUPPLIERS = [
  { name: "Dental Sky",   abbr: "DS", color: "#0077C8", products: 8200  },
  { name: "Henry Schein", abbr: "HS", color: "#002677", products: 12000 },
  { name: "DD Group",     abbr: "DD", color: "#c0392b", products: 9400  },
];

const PRODUCTS = [
  {
    name: "Nitrile Exam Gloves Medium (100 pk)",
    brand: "Aurelia", category: "PPE", sku: "GL-NIT-M100",
    prices: [
      { supplier: "Dental Sky",   color: "#0077C8", price: 18.50, best: true  },
      { supplier: "DD Group",     color: "#c0392b", price: 21.50, best: false },
      { supplier: "Henry Schein", color: "#002677", price: 23.99, best: false },
    ],
  },
  {
    name: "3M Filtek Supreme Universal Composite A2 (4 g × 4)",
    brand: "3M", category: "Composites", sku: "3M-FIL-A2-4G",
    prices: [
      { supplier: "DD Group",     color: "#c0392b", price: 62.50, best: true  },
      { supplier: "Dental Sky",   color: "#0077C8", price: 71.00, best: false },
      { supplier: "Henry Schein", color: "#002677", price: 76.99, best: false },
    ],
  },
];

function useTypewriter(target: string, run: boolean, speed = 72) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!run) { setText(""); return; }
    let i = 0; setText("");
    const t = setInterval(() => { i++; setText(target.slice(0, i)); if (i >= target.length) clearInterval(t); }, speed);
    return () => clearInterval(t);
  }, [target, run, speed]);
  return text;
}

function AnimatedNumber({ to, prefix = "", suffix = "", duration = 2400 }: {
  to: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick); else setVal(to);
    };
    requestAnimationFrame(tick);
  }, [to, duration]);
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

function SupBadge({ name, color, size = "sm" }: { name: string; color: string; size?: "sm" | "md" }) {
  const abbr = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`${size === "md" ? "w-8 h-8 text-[11px]" : "w-6 h-6 text-[9.5px]"} rounded-full flex items-center justify-center font-black text-white flex-shrink-0`}
      style={{ background: color }}>{abbr}</div>
  );
}

/**
 * TutorialCallout — premium floating tooltip with arrow pointing down at the wrapped element.
 */
function TutorialCallout({
  show, note, children,
}: {
  show: boolean; note: string; children: ReactNode;
}) {
  return (
    <div className="relative">
      <AnimatePresence>
        {show && (
          <motion.div
            className="absolute -top-[68px] left-0 right-0 z-20 flex justify-center pointer-events-none"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            <div className="relative flex flex-col items-center">
              {/* Card */}
              <div className="flex items-center gap-2.5 bg-[#0e0f12] text-white text-[13px] font-semibold px-5 py-3 rounded-2xl shadow-[0_8px_32px_rgba(14,15,18,0.32),0_2px_8px_rgba(14,15,18,0.18)] border border-white/[0.08] whitespace-nowrap backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 flex-shrink-0" />
                {note}
              </div>
              {/* Stem + arrowhead */}
              <div className="flex flex-col items-center gap-0">
                <div className="w-px h-2 bg-[#0e0f12]/60" />
                <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
                  <path d="M6 7L0 0H12L6 7Z" fill="#0e0f12" fillOpacity="0.85" />
                </svg>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Highlight ring */}
      <motion.div
        animate={show ? { boxShadow: "0 0 0 3px rgba(14,15,18,0.12), 0 0 0 1px rgba(14,15,18,0.5)" } : { boxShadow: "0 0 0 0px rgba(14,15,18,0)" }}
        transition={{ duration: 0.25 }}
        className="rounded-xl">
        {children}
      </motion.div>
    </div>
  );
}

/**
 * SpotlightBtn — premium action CTA with animated ring + tooltip.
 */
function SpotlightBtn({
  onClick, label, icon, note, full = false,
}: {
  onClick: () => void; label: string; icon?: string; note: string; full?: boolean;
}) {
  return (
    <div className={`relative inline-flex flex-col items-center gap-3 ${full ? "w-full" : ""}`}>
      {/* Tooltip */}
      <motion.div
        className="flex flex-col items-center pointer-events-none"
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex items-center gap-2.5 bg-[#0e0f12] text-white text-[13px] font-semibold px-5 py-3 rounded-2xl shadow-[0_8px_32px_rgba(14,15,18,0.32),0_2px_8px_rgba(14,15,18,0.18)] border border-white/[0.08] whitespace-nowrap">
          <motion.span
            className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          />
          {note}
        </div>
        <div className="flex flex-col items-center">
          <div className="w-px h-2.5 bg-[#0e0f12]/50" />
          <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
            <path d="M6 7L0 0H12L6 7Z" fill="#0e0f12" fillOpacity="0.75" />
          </svg>
        </div>
      </motion.div>

      {/* Button with rings */}
      <div className="relative">
        {/* Outer pulse ring */}
        <motion.div
          className="absolute inset-[-10px] rounded-[22px] border border-[#0e0f12]/20 pointer-events-none"
          animate={{ opacity: [0, 0.8, 0], scale: [0.94, 1.04, 0.94] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
        />
        {/* Inner steady ring */}
        <motion.div
          className="absolute inset-[-5px] rounded-[20px] border-[1.5px] border-[#0e0f12]/40 pointer-events-none"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        />
        <button
          onClick={onClick}
          className={`relative flex items-center gap-2.5 bg-[#0e0f12] text-white font-bold px-7 py-4 rounded-2xl shadow-[0_12px_36px_rgba(14,15,18,0.3),0_4px_12px_rgba(14,15,18,0.15)] hover:bg-black hover:-translate-y-px active:scale-[0.97] transition-all duration-200 text-[14px] tracking-[-0.01em] cursor-pointer ${full ? "w-full justify-center" : ""}`}>
          {icon && <span className="material-symbols-outlined text-[18px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>}
          {label}
        </button>
      </div>
    </div>
  );
}

const PROGRESS = [
  { steps: ["idle","typing-email","typing-password","connect-ready","connecting","connected"] as Step[], label: "Connect",  icon: "link"          },
  { steps: ["search-1","results-1","search-2","results-2"] as Step[],                                   label: "Search",   icon: "search"        },
  { steps: ["basket"] as Step[],                                                                         label: "Basket",   icon: "shopping_cart" },
  { steps: ["placing"] as Step[],                                                                        label: "Order",    icon: "send"          },
  { steps: ["invoice","savings"] as Step[],                                                              label: "Invoice",  icon: "receipt_long"  },
];

function pgIdx(step: Step) {
  return PROGRESS.findIndex(g => (g.steps as Step[]).includes(step));
}

export default function DemoPage() {
  const [step, setStep] = useState<Step>("idle");
  const [started, setStarted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tEmail    = useTypewriter(DEMO_EMAIL,    step === "typing-email",    52);
  const tPassword = useTypewriter(DEMO_PASSWORD, step === "typing-password", 68);
  const tS1       = useTypewriter("nitrile gloves medium",  step === "search-1", 88);
  const tS2       = useTypewriter("3M Filtek composite A2", step === "search-2", 88);

  const advance = useCallback((to: Step, delay = 0) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStep(to), delay);
  }, []);

  useEffect(() => {
    if (!started) return;
    if (step === "idle")         advance("typing-email", 500);
    if (step === "typing-email"    && tEmail.length    === DEMO_EMAIL.length)    advance("typing-password", 450);
    if (step === "typing-password" && tPassword.length === DEMO_PASSWORD.length) advance("connect-ready",   450);
    if (step === "connecting")   advance("connected",  2200);
    if (step === "search-1"    && tS1.length === "nitrile gloves medium".length)  advance("results-1", 650);
    if (step === "search-2"    && tS2.length === "3M Filtek composite A2".length) advance("results-2", 650);
    if (step === "placing")     advance("invoice", 6000);
  }, [step, tEmail, tPassword, tS1, tS2, started, advance]);

  function click() { const n = CLICK_NEXT[step]; if (n) setStep(n); }
  function start() { setStarted(true); setStep("idle"); }
  function restart() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStarted(false); setStep("idle");
    setTimeout(() => { setStarted(true); setStep("idle"); }, 80);
  }

  const pi = pgIdx(step);
  const needsClick = step in CLICK_NEXT;

  const isConnectScreen = ["typing-email","typing-password","connect-ready","connecting","connected"].includes(step);
  const isSearchScreen  = ["search-1","results-1","search-2","results-2"].includes(step);

  const searchText =
    step === "search-1"  ? tS1 :
    step === "results-1" ? "nitrile gloves medium" :
    step === "search-2"  ? tS2 :
    step === "results-2" ? "3M Filtek composite A2" : "";

  const urlBar =
    isConnectScreen ? "clinic/suppliers" :
    isSearchScreen  ? "search" :
    ["basket","placing"].includes(step) ? "cart" : "orders";

  // no dimming — keep everything fully visible
  const dim = "transition-opacity duration-300";
  const emailDim = "transition-opacity duration-200";

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#0e0f12]">
      <header className="sticky top-0 z-50 border-b border-[rgba(14,15,18,0.08)] bg-[rgba(250,250,248,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-3.5 sm:px-7">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-[-0.02em] text-[#0e0f12]">
            <DentagoLogo size={20} variant="solid" color="#0e0f12" wordmark={false} />
            Dentago
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
              DEMO — no real data
            </span>
            <Link href="/signup" className="inline-flex items-center gap-1.5 rounded-full bg-[#0e0f12] px-4 py-2 text-xs font-semibold !text-white transition hover:bg-black">
              Get started free →
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-4 pt-10 pb-24 sm:px-6">
        {/* Hero */}
        <div className="text-center mb-10">
          <motion.p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            Interactive demo · click each highlighted button to advance
          </motion.p>
          <motion.h1 className="text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold tracking-[-0.03em] text-[#0e0f12] leading-tight"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22,1,0.36,1] }}>
            One tab. Every supplier.<br /><span className="text-neutral-400">Best price, automatically.</span>
          </motion.h1>
          <motion.p className="mt-3 text-[15px] text-neutral-500 max-w-[480px] mx-auto leading-relaxed"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            Walk through Dentago yourself — arrows highlight exactly what to click at each step.
          </motion.p>
          <motion.div className="mt-5 flex flex-wrap items-center justify-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            {[
              { icon: "savings",               text: "Save £6,431/year avg"  },
              { icon: "timer_off",             text: "No more price hunting" },
              { icon: "receipt_long",          text: "One invoice per month" },
              { icon: "shopping_cart_checkout",text: "Auto order placement"  },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 bg-white border border-[rgba(14,15,18,0.08)] px-3 py-1.5 rounded-full text-[12px] font-semibold text-[#0e0f12] shadow-[0_1px_4px_rgba(14,15,18,0.04)]">
                <span className="material-symbols-outlined text-[14px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                {text}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center mb-8 overflow-x-auto pb-1">
          {PROGRESS.map(({ label, icon }, i) => {
            const done = i < pi, active = i === pi;
            return (
              <div key={label} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${done ? "bg-[#0e0f12] text-white" : active ? "bg-[#0e0f12] text-white scale-110 shadow-[0_4px_14px_rgba(14,15,18,0.2)]" : "bg-white border border-[rgba(14,15,18,0.1)] text-neutral-400"}`}>
                    {done ? <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                           : <span className="material-symbols-outlined text-[14px]">{icon}</span>}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wide whitespace-nowrap hidden sm:block ${active ? "text-[#0e0f12]" : done ? "text-neutral-400" : "text-neutral-300"}`}>{label}</span>
                </div>
                {i < PROGRESS.length - 1 && (
                  <div className={`w-10 sm:w-16 h-px mx-1.5 mb-4 transition-all duration-500 ${done ? "bg-[#0e0f12]" : "bg-[rgba(14,15,18,0.1)]"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Demo window */}
        <motion.div
          className="bg-white rounded-[28px] border border-[rgba(14,15,18,0.08)] shadow-[0_24px_64px_rgba(14,15,18,0.09)] overflow-hidden"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}>

          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[rgba(14,15,18,0.06)] bg-[#f4f4f2]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28ca41]" />
            </div>
            <div className="flex-1 mx-3 bg-white border border-[rgba(14,15,18,0.08)] rounded-lg px-3 py-1.5 text-[11px] text-neutral-400 font-mono">
              dentago.co.uk/{urlBar}
            </div>
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-600 px-2.5 py-1 rounded-full shrink-0">DEMO</span>
          </div>

          {/* Content */}
          <div className="min-h-[560px]">
            <AnimatePresence mode="wait">

              {/* ══ IDLE ══ */}
              {step === "idle" && !started && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center min-h-[560px] p-10 text-center">
                  <motion.div className="w-24 h-24 rounded-3xl bg-[#0e0f12] flex items-center justify-center mb-7 shadow-[0_20px_40px_rgba(14,15,18,0.2)]"
                    animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
                    <span className="material-symbols-outlined text-[46px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                  </motion.div>
                  <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#0e0f12] mb-3">See it. Click it. Own it.</h2>
                  <p className="text-[15px] text-neutral-500 mb-8 max-w-[420px] leading-relaxed">
                    Walk through connecting a supplier, searching prices across 3 at once, placing orders automatically, and getting one invoice.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 w-full max-w-[600px]">
                    {[
                      { value: "3",      label: "Suppliers searched", sub: "simultaneously"     },
                      { value: "£6,431", label: "Avg saving",          sub: "per practice/year" },
                      { value: "auto",   label: "Orders placed",       sub: "on your behalf"    },
                      { value: "1",      label: "Invoice per month",   sub: "not 3+"            },
                    ].map(({ value, label, sub }) => (
                      <div key={label} className="bg-[#fafaf8] border border-[rgba(14,15,18,0.07)] rounded-2xl p-4 text-left">
                        <p className="text-xl font-extrabold text-[#0e0f12] tracking-tight">{value}</p>
                        <p className="text-[10px] font-bold text-[#0e0f12] mt-0.5">{label}</p>
                        <p className="text-[10px] text-neutral-400">{sub}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={start}
                    className="flex items-center gap-2 bg-[#0e0f12] text-white font-extrabold px-8 py-4 rounded-2xl hover:bg-black active:scale-[0.98] transition-all shadow-[0_12px_30px_rgba(14,15,18,0.22)] text-[15px]">
                    <span className="material-symbols-outlined text-[22px] text-white">play_arrow</span>
                    Start walkthrough
                  </button>
                  <p className="mt-3 text-xs text-neutral-400">Click the highlighted button at each step to advance</p>
                </motion.div>
              )}

              {/* ══ CONNECT ══ */}
              {isConnectScreen && (
                <motion.div key="connect" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="p-7 sm:p-10">

                  {step === "connected" ? (
                    /* ── Connected — 3 suppliers shown ── */
                    <>
                      <div className={dim}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Step 1 complete</p>
                        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#0e0f12] mb-1">All 3 suppliers connected.</h2>
                        <p className="text-sm text-neutral-500 mb-6">Credentials saved and encrypted. Dentago can now search prices and place orders across all three.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
                          {SUPPLIERS.map((s, i) => (
                            <motion.div key={s.name}
                              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.12, type: "spring", stiffness: 280, damping: 24 }}
                              className="bg-white border border-[rgba(14,15,18,0.08)] rounded-[20px] overflow-hidden">
                              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(14,15,18,0.06)]" style={{ background: s.color + "0d" }}>
                                <div className="flex items-center gap-3">
                                  <SupBadge name={s.name} color={s.color} size="md" />
                                  <div>
                                    <p className="font-bold text-[#0e0f12] text-sm">{s.name}</p>
                                    <p className="text-[11px] text-neutral-400">{s.products.toLocaleString()}+ products</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                  Connected
                                </div>
                              </div>
                              <div className="px-5 py-3 text-xs text-neutral-500 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[13px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                                Encrypted · orders auto-placed
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-center mt-2">
                        <SpotlightBtn onClick={click} label="Search products →" icon="search"
                          note="👆 All connected — click to start searching" />
                      </div>
                    </>
                  ) : (
                    /* ── Connect form with per-field annotations ── */
                    <>
                      {/* Header — always visible */}
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Step 1 — Connect your supplier account</p>
                      <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#0e0f12] mb-1">
                        {step === "connecting" ? "Verifying with Dental Sky…" : "Connect Dental Sky"}
                      </h2>
                      <p className="text-sm text-neutral-500 mb-6">
                        Save your login once — Dentago orders on your behalf from here on. Your credentials are encrypted and never visible to anyone.
                      </p>

                      <div className="max-w-[520px] mx-auto">
                        {/* Supplier header card */}
                        <div className={`rounded-t-[22px] border border-b-0 border-[rgba(14,15,18,0.08)] px-6 py-5 flex items-center gap-4 ${step === "connecting" ? "" : ""}`}
                          style={{ background: SUPPLIERS[0].color + "0d" }}>
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
                            style={{ background: SUPPLIERS[0].color }}>DS</div>
                          <div className="flex-1">
                            <p className="font-extrabold text-[#0e0f12]">Dental Sky</p>
                            <p className="text-xs text-neutral-400">dentalsky.com · 8,200+ products</p>
                          </div>
                          {step === "connecting" && (
                            <svg className="animate-spin w-5 h-5 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15" />
                            </svg>
                          )}
                        </div>

                        {/* Form body */}
                        <div className="rounded-b-[22px] border border-[rgba(14,15,18,0.08)] bg-white overflow-visible shadow-[0_4px_20px_rgba(14,15,18,0.06)] px-6 py-6 space-y-8">

                          {/* Email field with annotation */}
                          <TutorialCallout
                            show={step === "typing-email"}
                            note="① Dentago fills in your Dental Sky email — stored encrypted">
                            <div className={emailDim}>
                              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Email</label>
                              <div className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all min-h-[44px] ${step === "typing-email" ? "border-[#0e0f12] bg-white shadow-[0_0_0_3px_rgba(14,15,18,0.06)]" : "border-[rgba(14,15,18,0.12)] bg-[#fafaf8]"}`}>
                                {tEmail || (step !== "typing-email" ? <span className="text-neutral-400">—</span> : <span className="text-neutral-400">your@email.com</span>)}
                                {step === "typing-email" && <span className="animate-pulse ml-0.5 font-thin text-[#0e0f12]">|</span>}
                              </div>
                              {/* Show filled value once done */}
                              {["typing-password","connect-ready","connecting"].includes(step) && (
                                <p className="mt-1 text-[11px] text-neutral-400 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                  {DEMO_EMAIL}
                                </p>
                              )}
                            </div>
                          </TutorialCallout>

                          {/* Password field with annotation */}
                          <TutorialCallout
                            show={step === "typing-password"}
                            note="② Password encrypted end-to-end — never visible to Dentago">
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">Password</label>
                              <div className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all min-h-[44px] ${step === "typing-password" ? "border-[#0e0f12] bg-white shadow-[0_0_0_3px_rgba(14,15,18,0.06)]" : "border-[rgba(14,15,18,0.12)] bg-[#fafaf8]"}`}>
                                {step === "typing-email"
                                  ? <span className="text-neutral-300">••••••••</span>
                                  : "•".repeat(Math.min((tPassword.length || DEMO_PASSWORD.length), DEMO_PASSWORD.length))}
                                {step === "typing-password" && <span className="animate-pulse ml-0.5 font-thin text-[#0e0f12]">|</span>}
                              </div>
                              {["connect-ready","connecting"].includes(step) && (
                                <p className="mt-1 text-[11px] text-neutral-400 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                                  Saved · AES-256 encrypted
                                </p>
                              )}
                            </div>
                          </TutorialCallout>
                        </div>

                        {/* Connecting state overlay */}
                        {step === "connecting" && (
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            className="mt-4 flex items-center gap-3 bg-[#0e0f12]/5 border border-[rgba(14,15,18,0.1)] rounded-2xl px-5 py-4">
                            <svg className="animate-spin w-5 h-5 text-[#0e0f12] flex-shrink-0" fill="none" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15" />
                            </svg>
                            <div>
                              <p className="text-sm font-bold text-[#0e0f12]">Verifying with Dental Sky…</p>
                              <p className="text-xs text-neutral-400">Logging in to check credentials are valid</p>
                            </div>
                          </motion.div>
                        )}

                        {/* SpotlightBtn when connect-ready */}
                        {step === "connect-ready" && (
                          <div className="mt-5">
                            <SpotlightBtn onClick={click} label="Connect Dental Sky" icon="link"
                              note="③ Click to verify & save your credentials" full />
                          </div>
                        )}
                      </div>

                      {/* Other suppliers greyed out */}
                      <div className="mt-6 max-w-[520px] mx-auto">
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-300 mb-2">Also available</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 opacity-25 pointer-events-none">
                          {["Henry Schein","DD Group","Kent Express","Trycare","Wrights"].map(s => (
                            <div key={s} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[rgba(14,15,18,0.08)] bg-white">
                              <div className="w-7 h-7 rounded-full bg-[#f5f5f3] border border-[rgba(14,15,18,0.08)] flex items-center justify-center text-[9px] font-black text-neutral-400">
                                {s.split(" ").map(w => w[0]).join("").slice(0,2)}
                              </div>
                              <span className="text-xs font-semibold text-neutral-400 truncate">{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* ══ SEARCH ══ */}
              {isSearchScreen && (
                <motion.div key={["search-1","results-1"].includes(step) ? "s1" : "s2"}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="p-7 sm:p-10">

                  <div className={dim}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">
                      {["search-1","results-1"].includes(step) ? "Step 2 — Product 1 of 2" : "Step 2 — Product 2 of 2"}
                    </p>
                    <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#0e0f12] mb-4">
                      {["search-1","results-1"].includes(step) ? "All 3 suppliers. One search." : "Another product. Another saving."}
                    </h2>

                    {/* Search bar with annotation when typing */}
                    <TutorialCallout
                      show={["search-1","search-2"].includes(step)}
                      note={["search-1"].includes(step) ? "Searching across Dental Sky, DD Group & Henry Schein at once" : "Type any product name, brand, or SKU"}>
                      <div className="relative mb-6">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[22px] text-neutral-400">search</span>
                        <div className={`w-full pl-12 pr-36 py-4 rounded-2xl border-2 text-[15px] font-medium text-[#0e0f12] bg-white transition-all min-h-[56px] ${["search-1","search-2"].includes(step) ? "border-[#0e0f12] shadow-[0_0_0_5px_rgba(14,15,18,0.07)]" : "border-[rgba(14,15,18,0.12)]"}`}>
                          {searchText || <span className="text-neutral-400">Search by SKU, product name, or brand…</span>}
                          {["search-1","search-2"].includes(step) && <span className="animate-pulse ml-0.5">|</span>}
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                          {["results-1","results-2"].includes(step)
                            ? <span className="text-[11px] text-neutral-400 flex items-center gap-1"><span className="material-symbols-outlined text-[13px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>3 suppliers</span>
                            : SUPPLIERS.map(s => <SupBadge key={s.name} name={s.name} color={s.color} size="sm" />)}
                        </div>
                      </div>
                    </TutorialCallout>

                    {/* Results */}
                    <AnimatePresence>
                      {["results-1","results-2"].includes(step) && (() => {
                        const prod = step === "results-1" ? PRODUCTS[0] : PRODUCTS[1];
                        const best = prod.prices.find(p => p.best)!;
                        const worst = Math.max(...prod.prices.map(p => p.price));
                        return (
                          <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                              <p className="text-sm font-semibold text-[#0e0f12]">
                                3 results for <span className="font-mono">"{step === "results-1" ? "nitrile gloves medium" : "3M Filtek composite A2"}"</span>
                              </p>
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
                                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-bold px-3 py-1.5 rounded-full">
                                <span className="material-symbols-outlined text-[14px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
                                Save £{(worst - best.price).toFixed(2)} vs most expensive
                              </motion.div>
                            </div>
                            <div className="rounded-[22px] border border-[rgba(14,15,18,0.08)] overflow-hidden bg-white shadow-[0_4px_20px_rgba(14,15,18,0.06)]">
                              <div className="px-6 py-5 border-b border-[rgba(14,15,18,0.06)] flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-0.5">{prod.brand} · {prod.category}</p>
                                  <p className="text-[17px] font-extrabold text-[#0e0f12] leading-snug">{prod.name}</p>
                                  <p className="text-xs text-neutral-400 mt-1 font-mono">SKU: {prod.sku}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-[11px] text-neutral-400 mb-0.5">best price</p>
                                  <p className="text-3xl font-extrabold text-[#0e0f12] tracking-tight">£{best.price.toFixed(2)}</p>
                                </div>
                              </div>
                              <div className="divide-y divide-[rgba(14,15,18,0.05)]">
                                {prod.prices.map((p, i) => (
                                  <motion.div key={p.supplier} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                                    className={`flex items-center justify-between gap-4 px-6 py-4 ${p.best ? "bg-emerald-50/70" : ""}`}>
                                    <div className="flex items-center gap-3">
                                      <SupBadge name={p.supplier} color={p.color} size="md" />
                                      <div>
                                        <p className="font-semibold text-[#0e0f12] text-sm">{p.supplier}</p>
                                        {p.best && <p className="text-[10px] text-emerald-600 font-bold">✓ Best price — Dentago picks this automatically</p>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {p.best
                                        ? <span className="text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">BEST</span>
                                        : <span className="text-[11px] text-neutral-400">+£{(p.price - best.price).toFixed(2)} more</span>}
                                      <span className={`text-xl font-extrabold tracking-tight ${p.best ? "text-emerald-700" : "text-neutral-400 line-through"}`}>£{p.price.toFixed(2)}</span>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                            {step === "results-2" && (
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                                className="mt-4 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
                                <span className="material-symbols-outlined text-[22px] text-emerald-600 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                                <div>
                                  <p className="font-extrabold text-emerald-900 text-sm">Saving £19.98 on this order vs always using Henry Schein</p>
                                  <p className="text-xs text-emerald-700/80 mt-0.5">2 products · 2 suppliers · best price on each</p>
                                </div>
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>
                  </div>

                  {/* Spotlight CTA on results screens */}
                  {["results-1","results-2"].includes(step) && (
                    <div className="mt-5 flex justify-end">
                      <SpotlightBtn onClick={click} label="Add to basket" icon="add_shopping_cart"
                        note={`👆 Best price: ${(step === "results-1" ? PRODUCTS[0] : PRODUCTS[1]).prices.find(p=>p.best)!.supplier} — click to add`} />
                    </div>
                  )}
                </motion.div>
              )}

              {/* ══ BASKET ══ */}
              {step === "basket" && (
                <motion.div key="basket" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }} className="p-7 sm:p-10">

                  <div className={dim}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Step 3 — Smart basket</p>
                    <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#0e0f12] mb-1">2 products. 2 suppliers. 1 basket.</h2>
                    <p className="text-sm text-neutral-500 mb-6">Dentago auto-splits by supplier. Click to place both orders at once.</p>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
                      <div className="space-y-4">
                        {([
                          { prod: PRODUCTS[0], qty: 2, sup: SUPPLIERS[0], icon: "inventory_2" },
                          { prod: PRODUCTS[1], qty: 1, sup: SUPPLIERS[2], icon: "medication"  },
                        ] as const).map(({ prod, qty, sup, icon }, gi) => (
                          <motion.div key={gi} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: gi * 0.15, type: "spring", stiffness: 260, damping: 22 }}
                            className="bg-white rounded-[22px] border border-[rgba(14,15,18,0.08)] overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[rgba(14,15,18,0.06)]" style={{ background: sup.color + "0d" }}>
                              <SupBadge name={sup.name} color={sup.color} size="sm" />
                              <p className="font-bold text-sm text-[#0e0f12]">{sup.name}</p>
                              <span className="ml-auto text-xs font-semibold text-neutral-400">Auto-routed ✓</span>
                            </div>
                            <div className="flex items-center gap-4 px-5 py-4">
                              <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sup.color + "14" }}>
                                <span className="material-symbols-outlined text-[28px]" style={{ color: sup.color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">{prod.brand}</p>
                                <p className="font-semibold text-[#0e0f12] text-sm leading-snug mt-0.5">{prod.name}</p>
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full mt-1 inline-block">Best price</span>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs text-neutral-400 mb-0.5">× {qty}</p>
                                <p className="text-xl font-extrabold text-[#0e0f12]">£{(prod.prices.find(p => p.best)!.price * qty).toFixed(2)}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Summary */}
                      <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.28, type: "spring", stiffness: 200, damping: 24 }}
                        className="bg-white rounded-[22px] border border-[rgba(14,15,18,0.08)] overflow-hidden self-start">
                        <div className="px-6 py-4 border-b border-[rgba(14,15,18,0.06)]">
                          <h3 className="font-extrabold text-[#0e0f12] tracking-tight">Order summary</h3>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                          {[
                            { sup: SUPPLIERS[0], label: "Dental Sky (×2)", amt: PRODUCTS[0].prices[0].price * 2 },
                            { sup: SUPPLIERS[2], label: "DD Group (×1)",   amt: PRODUCTS[1].prices[0].price     },
                          ].map(({ sup, label, amt }) => (
                            <div key={sup.name} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <SupBadge name={sup.name} color={sup.color} size="sm" />
                                <span className="text-sm text-neutral-600">{label}</span>
                              </div>
                              <span className="text-sm font-bold text-[#0e0f12]">£{amt.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className="text-xs font-bold text-emerald-800">Saved on this order</p>
                              <p className="text-lg font-extrabold text-emerald-700">£19.98</p>
                            </div>
                            <p className="text-[10px] text-emerald-600">vs buying from Henry Schein</p>
                          </div>
                          <div className="h-px bg-[rgba(14,15,18,0.06)]" />
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0e0f12]">Total</span>
                            <span className="text-2xl font-extrabold text-[#0e0f12] tracking-tight">
                              £{(PRODUCTS[0].prices[0].price * 2 + PRODUCTS[1].prices[0].price).toFixed(2)}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400">Free for every clinic.</p>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <SpotlightBtn onClick={click}
                      label={`Place 2 orders · £${(PRODUCTS[0].prices[0].price * 2 + PRODUCTS[1].prices[0].price).toFixed(2)}`}
                      icon="send"
                      note="👆 Click — Dentago logs into both suppliers and places the orders" />
                  </div>
                </motion.div>
              )}

              {/* ══ PLACING ══ */}
              {step === "placing" && (
                <motion.div key="placing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center min-h-[560px] p-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-6">Step 4 — Auto order placement</p>
                  <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#0e0f12] mb-2 text-center">Placing 2 orders simultaneously.</h2>
                  <p className="text-sm text-neutral-500 mb-8 text-center max-w-[400px]">Dentago signs into each supplier and submits — you don&apos;t lift a finger.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-[600px]">
                    {[
                      { sup: SUPPLIERS[0], lines: ["Signing into Dental Sky","Adding Nitrile Gloves × 2","Submitting checkout"], ref: "DS-482910" },
                      { sup: SUPPLIERS[2], lines: ["Signing into DD Group","Adding 3M Filtek A2 × 1","Submitting checkout"],   ref: "DD-193847" },
                    ].map(({ sup, lines, ref }, gi) => (
                      <motion.div key={gi} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: gi * 0.22, type: "spring", stiffness: 240, damping: 22 }}
                        className="bg-white rounded-[22px] border border-[rgba(14,15,18,0.08)] overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(14,15,18,0.06)]" style={{ background: sup.color + "0d" }}>
                          <SupBadge name={sup.name} color={sup.color} size="md" />
                          <div>
                            <p className="font-bold text-[#0e0f12] text-sm">{sup.name}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">Ref: {ref}</p>
                          </div>
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: gi * 0.22 + 2.2, type: "spring" }}
                            className="ml-auto flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            Placed
                          </motion.div>
                        </div>
                        <div className="px-5 py-4 space-y-2.5">
                          {lines.map((l, li) => (
                            <motion.div key={l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: gi * 0.22 + li * 0.6 }}
                              className="flex items-center gap-2.5 text-xs">
                              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: gi * 0.22 + li * 0.6 + 0.25 }}
                                className="material-symbols-outlined text-[14px] text-emerald-500 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</motion.span>
                              <span className="text-neutral-600">{l}</span>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}
                    className="mt-7 text-sm text-neutral-500 text-center max-w-[400px]">
                    Both orders are now live. <span className="font-bold text-[#0e0f12]">Log into Dental Sky and DD Group</span> — they&apos;ll be there.
                  </motion.p>
                </motion.div>
              )}

              {/* ══ INVOICE ══ */}
              {step === "invoice" && (
                <motion.div key="invoice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }} className="p-7 sm:p-10">

                  <div className={dim}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Step 5 — Unified invoice</p>
                    <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[#0e0f12] mb-1">One invoice. Not three.</h2>
                    <p className="text-sm text-neutral-500 mb-6">Every supplier, every order — one clean statement. Ready for your accountant.</p>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-rose-50/60 border border-rose-100 rounded-[20px] p-5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-3">Without Dentago</p>
                        {["Henry Schein","Dental Sky","DD Group","Trycare","Kent Express"].map(s => (
                          <div key={s} className="flex items-center gap-2 mb-1.5">
                            <span className="material-symbols-outlined text-[13px] text-rose-300">receipt</span>
                            <span className="text-xs text-rose-600">Invoice from {s}</span>
                          </div>
                        ))}
                        <p className="mt-2 text-[11px] font-bold text-rose-500">Hours of admin. Every month.</p>
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-100 rounded-[20px] p-5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">With Dentago</p>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-[14px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                          <span className="text-xs font-bold text-emerald-800">1 invoice from Dentago</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 leading-relaxed">All suppliers. All products. One document. Monthly or per-order.</p>
                        <p className="mt-3 text-[11px] font-bold text-emerald-600">5 minutes. Done.</p>
                      </div>
                    </div>
                    <div className="bg-white border border-[rgba(14,15,18,0.1)] rounded-[20px] overflow-hidden shadow-[0_8px_28px_rgba(14,15,18,0.07)]">
                      <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(14,15,18,0.06)] bg-[#fafaf8]">
                        <div className="flex items-center gap-3">
                          <DentagoLogo size={20} variant="solid" color="#0e0f12" wordmark={false} />
                          <div>
                            <p className="font-extrabold text-[#0e0f12] tracking-tight">Dentago</p>
                            <p className="text-[10px] text-neutral-400">Consolidated invoice · May 2026</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-[#0e0f12] text-sm">INV-2026-0047</p>
                          <p className="text-[11px] text-neutral-400">Smile Dental Practice</p>
                        </div>
                      </div>
                      <div className="divide-y divide-[rgba(14,15,18,0.05)]">
                        {[
                          { sup: SUPPLIERS[0], name: "Nitrile Exam Gloves Medium 100pk",   qty: 2, unit: 18.50, ref: "DS-482910" },
                          { sup: SUPPLIERS[2], name: "3M Filtek Supreme Universal A2 4g×4",qty: 1, unit: 62.50, ref: "DD-193847" },
                        ].map(({ sup, name, qty, unit, ref }) => (
                          <div key={ref} className="flex items-center gap-4 px-6 py-4">
                            <SupBadge name={sup.name} color={sup.color} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#0e0f12] truncate">{name}</p>
                              <p className="text-[10px] text-neutral-400 font-mono">{sup.name} · {ref}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-neutral-400">{qty} × £{unit.toFixed(2)}</p>
                              <p className="font-bold text-[#0e0f12]">£{(qty * unit).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(14,15,18,0.08)] bg-[#fafaf8]">
                        <p className="font-bold text-[#0e0f12]">Total</p>
                        <p className="text-2xl font-extrabold text-[#0e0f12] tracking-tight">
                          £{(PRODUCTS[0].prices[0].price * 2 + PRODUCTS[1].prices[0].price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col items-center gap-2">
                    <SpotlightBtn onClick={click} label="See your savings →" icon="savings"
                      note="👆 Click to see your annual savings projection" />
                    <p className="text-xs text-neutral-400">Demo only — no real invoice was generated</p>
                  </div>
                </motion.div>
              )}

              {/* ══ SAVINGS ══ */}
              {step === "savings" && (
                <motion.div key="savings" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }}
                  className="flex flex-col items-center justify-center min-h-[560px] p-8 sm:p-12 text-center">
                  <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 240, damping: 18 }}
                    className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-[44px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
                  </motion.div>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                    className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Average clinic saves</motion.p>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="text-5xl sm:text-6xl font-extrabold tracking-[-0.04em] text-[#0e0f12] mb-1">
                    <AnimatedNumber to={6431} prefix="£" suffix="/yr" duration={2400} />
                  </motion.div>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="text-sm text-neutral-500 mb-8">per practice, per year · across 10,000+ products from 40+ UK suppliers</motion.p>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
                    className="grid grid-cols-3 gap-4 mb-8 w-full max-w-[520px]">
                    {[
                      { label: "This order", value: "£19.98", sub: "saved today"      },
                      { label: "Per month",  value: "£87",    sub: "at weekly orders" },
                      { label: "Per year",   value: "£6,431", sub: "projected"        },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="bg-emerald-50 border border-emerald-100 rounded-[18px] py-4 px-3">
                        <p className="text-2xl font-extrabold text-emerald-800 tracking-tight">{value}</p>
                        <p className="text-[11px] font-bold text-emerald-700 mt-0.5">{label}</p>
                        <p className="text-[10px] text-emerald-600/80">{sub}</p>
                      </div>
                    ))}
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8 w-full max-w-[580px] text-left">
                    {[
                      { icon: "search",                text: "Cross-supplier search"    },
                      { icon: "auto_awesome",          text: "Best price auto-selected"  },
                      { icon: "send",                  text: "Orders placed for you"    },
                      { icon: "receipt_long",          text: "One consolidated invoice" },
                    ].map(({ icon, text }) => (
                      <div key={text} className="flex items-center gap-2 bg-white border border-[rgba(14,15,18,0.08)] rounded-xl px-3 py-3">
                        <span className="material-symbols-outlined text-[16px] text-[#0e0f12] flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                        <span className="text-[11px] font-semibold text-[#0e0f12] leading-tight">{text}</span>
                      </div>
                    ))}
                  </motion.div>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.52 }}
                    className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-4 py-2 rounded-full mb-7">
                    This was a demo — no real data or orders were used
                  </motion.p>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}
                    className="flex flex-col sm:flex-row gap-3">
                    <Link href="/signup"
                      className="flex items-center justify-center gap-2 bg-[#0e0f12] !text-white font-extrabold py-4 px-8 rounded-2xl hover:bg-black active:scale-[0.98] transition-all shadow-[0_16px_40px_rgba(14,15,18,0.22)] text-[15px]">
                      <span className="material-symbols-outlined text-[20px] !text-white">rocket_launch</span>
                      Start saving — it&apos;s free
                    </Link>
                    <button onClick={restart}
                      className="flex items-center justify-center gap-1.5 border border-[rgba(14,15,18,0.12)] bg-white text-[#0e0f12] font-semibold py-4 px-6 rounded-2xl hover:border-[#0e0f12] transition text-sm">
                      <span className="material-symbols-outlined text-[16px]">replay</span>
                      Watch again
                    </button>
                  </motion.div>
                  <p className="mt-3 text-xs text-neutral-400">Free for every UK practice, forever. No credit card.</p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>

        {/* Bottom */}
        <motion.div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <Link href="/signup/welcome" className="flex items-center gap-1.5 text-neutral-400 hover:text-[#0e0f12] transition">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back
          </Link>
          <span className="text-neutral-200">·</span>
          <Link href="/signup/finish" className="flex items-center gap-2 bg-[#0e0f12] !text-white font-semibold px-6 py-2.5 rounded-full hover:bg-black transition shadow-md">
            Ready — set up workspace →
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
