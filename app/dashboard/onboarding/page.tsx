"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { freshAuthHeaders, getClinic } from "@/lib/auth";
import { ONBOARDING_CONNECT_SUPPLIERS } from "@/lib/supplier-branding";
import {
  loadGetStartedSessionCache,
  saveGetStartedSessionCache,
  type GetStartedStepId as StepId,
} from "@/lib/get-started-session-cache";

// ─── Types ────────────────────────────────────────────────────────────────────

type OnboardingProgress = {
  gdc_document?: boolean;
  supplier_connected?: boolean;
  first_order?: boolean;
};

type SurveyPayload = {
  spend?: string | null;
  pains?: string[];
  suppliers?: string[];
  chairs?: string | null;
  connect_targets?: string[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const SPEND_OPTIONS = ["Under £500/mo", "£500–£2k/mo", "£2k–£5k/mo", "£5k–£15k/mo", "Over £15k/mo"];

const PAIN_OPTIONS = [
  { label: "Comparing prices across suppliers", icon: "compare_arrows" },
  { label: "Too much time placing orders",      icon: "schedule"        },
  { label: "No visibility on spend",            icon: "visibility_off"  },
  { label: "Inconsistent supplier pricing",     icon: "trending_up"     },
  { label: "Managing stock levels",             icon: "inventory_2"     },
  { label: "Too many invoices to process",      icon: "receipt_long"    },
];

const CHAIR_OPTIONS = ["1", "2–3", "4–6", "7–10", "10+"];

const STEPS: { id: StepId; label: string; icon: string }[] = [
  { id: "survey",   label: "Your practice",    icon: "article"       },
  { id: "supplier", label: "Connect supplier", icon: "link"          },
  { id: "gdc",      label: "GDC (optional)",   icon: "verified_user" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sortConnectTargets(targets: readonly string[]): string[] {
  const set = new Set(targets);
  return ONBOARDING_CONNECT_SUPPLIERS.filter((n) => set.has(n));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Maps supplier name → dentago_suppliers.id (integer PK)
const SUPPLIER_NAME_TO_ID: Record<string, number> = {
  "Henry Schein": 1,
  "Kent Express": 2,
  "Dental Sky":   3,
  "DHB":          4,
  "Trycare":      5,
  "Wrights":      7,
  "DD Group":     76,
};

const SUPPLIER_LOGOS: Record<string, string> = {
  "Henry Schein":  "https://www.henryschein.co.uk/images/henryschein-logo.png",
  "DHB":           "/supplier-dhb-logo.png",
  "DD Group":      "https://www.ddgroup.co.uk/img/dd-logo.png",
  "Kent Express":  "https://www.kentexpress.co.uk/media/logo/stores/1/KE_Logo_RGB.png",
  "Dental Sky":    "https://www.dentalsky.com/pub/static/frontend/Magento/dentalsky/en_GB/images/logo.svg",
  "Wrights":       "https://www.wrightsdental.co.uk/media/logo/stores/1/wrights-dental-logo.png",
};

function SupplierTile({ name, selected, onToggle }: { name: string; selected: boolean; onToggle: () => void }) {
  const abbr = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const logoUrl = SUPPLIER_LOGOS[name];
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all duration-150 w-full ${
        selected
          ? "border-[#0e0f12] bg-[#0e0f12] text-white shadow-[0_4px_14px_rgba(14,15,18,0.18)]"
          : "border-[rgba(14,15,18,0.1)] bg-white text-[#0e0f12] hover:border-[rgba(14,15,18,0.25)]"
      }`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${selected ? "bg-white" : "bg-white border border-[rgba(14,15,18,0.08)]"}`}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            className="w-full h-full object-contain p-1"
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "none";
              const fb = el.nextElementSibling as HTMLElement | null;
              if (fb) fb.style.display = "flex";
            }}
          />
        ) : null}
        <span
          className={`text-[11px] font-black ${logoUrl ? "hidden" : "flex"} items-center justify-center w-full h-full ${selected ? "text-[#0e0f12]" : "text-[#0e0f12]"}`}
          style={{ display: logoUrl ? "none" : "flex" }}
        >
          {abbr}
        </span>
      </div>
      <span className="text-[14px] font-semibold leading-snug">{name}</span>
      {selected && <span className="material-symbols-outlined text-[16px] ml-auto text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GetStartedPage() {
  const router = useRouter();

  // Step state
  const [activeStep, setActiveStep] = useState<StepId>("survey");
  const [done, setDone] = useState<StepId[]>([]);

  // Survey
  const [spend, setSpend]             = useState<string>("");
  const [pains, setPains]             = useState<string[]>([]);
  const [suppliers, setSuppliers]     = useState<string[]>([]);
  const [chairs, setChairs]           = useState<string>("");
  const [connectTargets, setConnectTargets] = useState<string[]>([]);

  // GDC
  const [gdcFile, setGdcFile]         = useState<File | null>(null);
  const [gdcUploading, setGdcUploading] = useState(false);
  const [gdcError, setGdcError]       = useState<string | null>(null);
  const [gdcDone, setGdcDone]         = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // Supplier connect
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [supEmail, setSupEmail]       = useState("");
  const [supPassword, setSupPassword] = useState("");
  const [supConnecting, setSupConnecting] = useState(false);
  const [supError, setSupError]       = useState<string | null>(null);
  const [supConnected, setSupConnected] = useState(false);

  // Progress from server
  const [progress, setProgress]       = useState<OnboardingProgress>({});
  const [surveyBusy, setSurveyBusy]   = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  const clinicName = getClinic()?.clinic_name ?? "there";
  const firstName  = clinicName.split(/\s+/)[0];

  // ── Load server state ─────────────────────────────────────────────────────

  const loadProgress = useCallback(async () => {
    try {
      const headers = await freshAuthHeaders();
      const res = await fetch("/api/clinic/onboarding", { headers });
      if (!res.ok) return;
      const data = (await res.json()) as { steps: { id: string; completed: boolean }[] };

      const gdcOk  = !!data.steps.find((s) => s.id === "gdc_document")?.completed;
      const supOk  = !!data.steps.find((s) => s.id === "connect_supplier")?.completed;
      const ordOk  = !!data.steps.find((s) => s.id === "place_order")?.completed;
      setProgress({ gdc_document: gdcOk, supplier_connected: supOk, first_order: ordOk });

      // Determine which steps are done and where to resume
      const newDone: StepId[] = [];
      if (gdcOk || supOk) newDone.push("survey"); // survey counts as done if they've progressed
      if (supOk) { newDone.push("supplier"); setSupConnected(true); }
      if (gdcOk) newDone.push("gdc");

      // Supplier connected → onboarding complete; stay on page and show completion view
      if (supOk) {
        setDone(["survey", "supplier", "gdc"]);
        setSupConnected(true);
        setSetupComplete(true);
        return;
      }

      setDone(newDone);

      // Restore session cache for step position
      const cache = loadGetStartedSessionCache();
      if (cache && !supOk) {
        setActiveStep(cache.activeStep);
        if (cache.connectTargets.length) setConnectTargets(cache.connectTargets);
      } else if (!supOk) {
        setActiveStep("survey");
      }
    } catch { /* ignore */ }
  }, [router]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  // ── Persist session cache on step changes ─────────────────────────────────

  useEffect(() => {
    saveGetStartedSessionCache({ done, activeStep, connectTargets });
  }, [done, activeStep, connectTargets]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function markDone(id: StepId) {
    setDone((prev) => prev.includes(id) ? prev : [...prev, id]);
  }

  function goStep(id: StepId) {
    setActiveStep(id);
  }

  // ── Survey submit ─────────────────────────────────────────────────────────

  async function submitSurvey() {
    setSurveyBusy(true);
    try {
      const headers = await freshAuthHeaders();
      const payload: SurveyPayload = { spend, pains, suppliers, chairs, connect_targets: connectTargets };
      await fetch("/api/clinic/survey", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch { /* ignore */ } finally {
      setSurveyBusy(false);
    }
    markDone("survey");
    // Pre-fill selected supplier from connect targets
    if (connectTargets.length && !selectedSupplier) {
      setSelectedSupplier(connectTargets[0]);
    }
    goStep("supplier");
  }

  // ── GDC upload ────────────────────────────────────────────────────────────

  async function uploadGdc() {
    if (!gdcFile) return;
    setGdcUploading(true);
    setGdcError(null);
    try {
      const headers = await freshAuthHeaders();
      const form = new FormData();
      form.append("file", gdcFile);
      const res = await fetch("/api/clinic/onboarding/gdc-document", { method: "POST", headers, body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setGdcError(typeof j.error === "string" ? j.error : "Upload failed. Please try again.");
        return;
      }
      setGdcDone(true);
      markDone("gdc");
      setTimeout(() => setSetupComplete(true), 900);
    } catch {
      setGdcError("Upload failed. Check your connection and try again.");
    } finally {
      setGdcUploading(false);
    }
  }

  function skipGdc() {
    markDone("gdc");
    setSetupComplete(true);
  }

  // ── Supplier connect ──────────────────────────────────────────────────────

  async function connectSupplier() {
    if (!selectedSupplier || !supEmail.trim() || !supPassword) return;
    setSupConnecting(true);
    setSupError(null);
    try {
      const headers = await freshAuthHeaders();
      const res = await fetch("/api/clinic/credentials", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: SUPPLIER_NAME_TO_ID[selectedSupplier], username: supEmail.trim(), password: supPassword }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setSupError(typeof j.error === "string" ? j.error : "Could not connect. Check your credentials and try again.");
        return;
      }
      setSupConnected(true);
      markDone("supplier");
      // Supplier connected → onboarding complete; offer optional GDC step then show completion
      setTimeout(() => goStep("gdc"), 2200);
    } catch {
      setSupError("Connection failed. Check your internet and try again.");
    } finally {
      setSupConnecting(false);
    }
  }

  // ── Step index ────────────────────────────────────────────────────────────

  const stepIdx = STEPS.findIndex((s) => s.id === activeStep);
  const totalDone = done.length;
  const pct = Math.round((totalDone / STEPS.length) * 100);

  // ── Render ────────────────────────────────────────────────────────────────

  // Completion screen — shown when all steps done
  if (setupComplete) {
    return (
      <div className="min-h-screen bg-[var(--dc-bg,#f0eff6)] flex items-center justify-center px-4">
        <div className="max-w-[480px] w-full text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6"
          >
            <span className="material-symbols-outlined text-[44px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </motion.div>

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-[28px] font-black text-[var(--dc-text,#0f172a)] tracking-tight mb-3">
              You&apos;re all set, {firstName}
            </h1>
            <p className="text-[15px] text-[var(--dc-muted,#64748b)] leading-relaxed mb-8">
              Your workspace is ready. You&apos;re connected to your supplier and can start browsing products and placing orders right now.
            </p>

            <div className="bg-white border border-[rgba(14,15,18,0.08)] rounded-2xl p-6 mb-6 text-left">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[#0e0f12] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>shopping_bag</span>
                </div>
                <div>
                  <p className="font-bold text-[14px] text-[var(--dc-text)]">Place your first order</p>
                  <p className="text-[12px] text-[var(--dc-muted)]">Browse 10,000+ dental products</p>
                </div>
              </div>
              <p className="text-[13px] text-[var(--dc-muted)] leading-relaxed mb-4">
                Search across all your connected suppliers, compare prices, and place your first order in minutes — completely free.
              </p>
              <Link
                href="/search"
                className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl bg-[#0e0f12] text-white font-bold text-[14px] hover:bg-[#1e1f24] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
                Browse products →
              </Link>
            </div>

            <div className="flex items-center gap-3 justify-center">
              <Link href="/dashboard" className="text-[13px] text-[var(--dc-muted)] hover:text-[var(--dc-text)] transition">
                Go to dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--dc-bg,#f0eff6)] text-[var(--dc-text,#0f172a)]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--dc-border,rgba(15,23,42,0.08))] bg-[var(--dc-bg,#f0eff6)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[900px] items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-6">
            <p className="font-bold text-[15px] tracking-tight text-[var(--dc-text)]">Get started</p>
            {/* Step pills */}
            <div className="hidden sm:flex items-center gap-1.5">
              {STEPS.map((s, i) => {
                const isDone = done.includes(s.id);
                const isActive = s.id === activeStep;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => done.includes(s.id) || i <= stepIdx ? goStep(s.id) : null}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                      isActive ? "bg-[var(--dc-text,#0f172a)] text-white" :
                      isDone   ? "bg-emerald-100 text-emerald-700" :
                                 "text-[var(--dc-muted,#64748b)] opacity-50 cursor-default"
                    }`}>
                    {isDone ? <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                            : <span className="material-symbols-outlined text-[11px]">{s.icon}</span>}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-[rgba(14,15,18,0.08)] overflow-hidden">
                <motion.div className="h-full rounded-full bg-[var(--dc-text,#0f172a)]"
                  animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }} />
              </div>
              <span className="text-[11px] font-bold text-[var(--dc-muted)]">{totalDone}/{STEPS.length}</span>
            </div>
            <Link href="/dashboard" className="text-[12px] text-[var(--dc-muted)] hover:text-[var(--dc-text)] transition">
              Skip for now
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 py-12 sm:py-16">

        {/* Greeting */}
        <motion.div className="mb-10" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22,1,0.36,1] }}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--dc-muted)] mb-2">Get started with Dentago</p>
          <h1 className="text-[clamp(1.7rem,3.5vw,2.4rem)] font-extrabold tracking-[-0.03em] leading-tight">
            {`Welcome, ${firstName}.`}
          </h1>
          <p className="mt-2 text-[15px] text-[var(--dc-muted)] leading-relaxed">
            A few quick steps and your workspace will be ready to go.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── SURVEY ── */}
          {activeStep === "survey" && (
            <motion.div key="survey"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.22,1,0.36,1] }}>

              <div className="bg-[var(--dc-surface,#ffffff)] rounded-[24px] border border-[var(--dc-border)] shadow-[0_4px_24px_rgba(15,23,42,0.07)] overflow-hidden">
                <div className="px-7 py-6 border-b border-[var(--dc-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--dc-text,#0f172a)] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[17px] text-white">article</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--dc-muted)] mb-0.5">Step 1 of 3</p>
                      <h2 className="font-extrabold text-[17px] tracking-tight">Tell us about your practice</h2>
                    </div>
                  </div>
                </div>

                <div className="px-7 py-6 space-y-7">
                  {/* Spend */}
                  <div>
                    <p className="text-[13px] font-bold text-[var(--dc-text)] mb-3">How much do you spend on dental supplies per month?</p>
                    <div className="flex flex-wrap gap-2">
                      {SPEND_OPTIONS.map((o) => (
                        <button key={o} type="button" onClick={() => setSpend(spend === o ? "" : o)}
                          className={`px-4 py-2 rounded-xl border text-[13px] font-semibold transition-all ${
                            spend === o
                              ? "bg-[var(--dc-text,#0f172a)] text-white border-transparent shadow-[0_2px_8px_rgba(14,15,18,0.2)]"
                              : "bg-white text-[var(--dc-text)] border-[var(--dc-border)] hover:border-[rgba(14,15,18,0.3)]"
                          }`}>{o}</button>
                      ))}
                    </div>
                  </div>

                  {/* Pains */}
                  <div>
                    <p className="text-[13px] font-bold text-[var(--dc-text)] mb-3">Biggest procurement challenges? <span className="font-normal text-[var(--dc-muted)]">(pick all that apply)</span></p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PAIN_OPTIONS.map(({ label, icon }) => {
                        const sel = pains.includes(label);
                        return (
                          <button key={label} type="button"
                            onClick={() => setPains(sel ? pains.filter(p => p !== label) : [...pains, label])}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                              sel
                                ? "bg-[var(--dc-text,#0f172a)] text-white border-transparent"
                                : "bg-white text-[var(--dc-text)] border-[var(--dc-border)] hover:border-[rgba(14,15,18,0.25)]"
                            }`}>
                            <span className={`material-symbols-outlined text-[18px] flex-shrink-0 ${sel ? "text-white" : "text-[var(--dc-muted)]"}`}>{icon}</span>
                            <span className="text-[13px] font-medium leading-snug">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Suppliers */}
                  <div>
                    <p className="text-[13px] font-bold text-[var(--dc-text)] mb-3">Which suppliers do you currently use?</p>
                    <div className="flex flex-wrap gap-2">
                      {["Henry Schein","DHB","DD Group","Kent Express","Dental Sky","Wrights","Other"].map((s) => {
                        const sel = suppliers.includes(s);
                        return (
                          <button key={s} type="button"
                            onClick={() => {
                              const next = sel ? suppliers.filter(x => x !== s) : [...suppliers, s];
                              setSuppliers(next);
                              // Mirror to connect targets if it's a connectable supplier
                              const connectable = ONBOARDING_CONNECT_SUPPLIERS as readonly string[];
                              if (!sel && connectable.includes(s)) {
                                setConnectTargets(prev => sortConnectTargets([...prev, s]));
                              } else if (sel) {
                                setConnectTargets(prev => prev.filter(x => x !== s));
                              }
                            }}
                            className={`px-4 py-2 rounded-xl border text-[13px] font-semibold transition-all ${
                              sel
                                ? "bg-[var(--dc-text,#0f172a)] text-white border-transparent"
                                : "bg-white text-[var(--dc-text)] border-[var(--dc-border)] hover:border-[rgba(14,15,18,0.25)]"
                            }`}>{s}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chairs */}
                  <div>
                    <p className="text-[13px] font-bold text-[var(--dc-text)] mb-3">How many surgeries does your practice have?</p>
                    <div className="flex flex-wrap gap-2">
                      {CHAIR_OPTIONS.map((o) => (
                        <button key={o} type="button" onClick={() => setChairs(chairs === o ? "" : o)}
                          className={`px-5 py-2 rounded-xl border text-[13px] font-semibold transition-all ${
                            chairs === o
                              ? "bg-[var(--dc-text,#0f172a)] text-white border-transparent"
                              : "bg-white text-[var(--dc-text)] border-[var(--dc-border)] hover:border-[rgba(14,15,18,0.25)]"
                          }`}>{o}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-7 py-5 border-t border-[var(--dc-border)] flex items-center justify-between gap-4 bg-[var(--dc-bg,#f0eff6)]/50">
                  <p className="text-[12px] text-[var(--dc-muted)]">Takes 30 seconds</p>
                  <button onClick={() => void submitSurvey()} disabled={surveyBusy}
                    className="flex items-center gap-2 bg-[var(--dc-text,#0f172a)] text-white font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all text-[14px] disabled:opacity-50 shadow-[0_4px_14px_rgba(14,15,18,0.18)]">
                    {surveyBusy ? "Saving…" : "Continue"}
                    {!surveyBusy && <span className="material-symbols-outlined text-[16px] !text-white">arrow_forward</span>}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── GDC ── */}
          {activeStep === "gdc" && (
            <motion.div key="gdc"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.22,1,0.36,1] }}>

              <div className="bg-[var(--dc-surface,#ffffff)] rounded-[24px] border border-[var(--dc-border)] shadow-[0_4px_24px_rgba(15,23,42,0.07)] overflow-hidden">
                <div className="px-7 py-6 border-b border-[var(--dc-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--dc-text,#0f172a)] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[17px] text-white">verified_user</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--dc-muted)] mb-0.5">Step 3 of 3 · Optional</p>
                      <h2 className="font-extrabold text-[17px] tracking-tight">Verify your practice <span className="font-normal text-[var(--dc-muted)] text-[14px]">(you can skip this)</span></h2>
                    </div>
                  </div>
                </div>

                <div className="px-7 py-8">
                  {gdcDone ? (
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center py-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-[36px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      </div>
                      <p className="font-extrabold text-[18px] text-[var(--dc-text)] mb-1">GDC document uploaded</p>
                      <p className="text-[13px] text-[var(--dc-muted)]">Moving to supplier connection…</p>
                    </motion.div>
                  ) : (
                    <>
                      <p className="text-[14px] text-[var(--dc-muted)] leading-relaxed mb-6">
                        Upload your GDC certificate or registration letter to verify your practice with suppliers. PDF, JPG, or PNG — you can always do this later from Settings.
                      </p>

                      {/* Drop zone */}
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className={`w-full border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                          gdcFile
                            ? "border-[var(--dc-text,#0f172a)] bg-[rgba(14,15,18,0.03)]"
                            : "border-[rgba(14,15,18,0.15)] hover:border-[rgba(14,15,18,0.3)] hover:bg-[rgba(14,15,18,0.02)]"
                        }`}>
                        <span className={`material-symbols-outlined text-[40px] mb-3 block ${gdcFile ? "text-[var(--dc-text)]" : "text-[var(--dc-muted)]"}`}
                          style={{ fontVariationSettings: "'FILL' 0" }}>upload_file</span>
                        {gdcFile ? (
                          <>
                            <p className="font-bold text-[14px] text-[var(--dc-text)]">{gdcFile.name}</p>
                            <p className="text-[12px] text-[var(--dc-muted)] mt-1">{(gdcFile.size / 1024).toFixed(0)} KB · click to change</p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-[14px] text-[var(--dc-text)]">Click to upload or drag & drop</p>
                            <p className="text-[12px] text-[var(--dc-muted)] mt-1">PDF, JPG, PNG · max 10 MB</p>
                          </>
                        )}
                      </button>
                      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) setGdcFile(f); }} />

                      {gdcError && (
                        <p className="mt-3 text-[13px] text-red-500 font-medium">{gdcError}</p>
                      )}
                    </>
                  )}
                </div>

                {!gdcDone && (
                  <div className="px-7 py-5 border-t border-[var(--dc-border)] flex items-center justify-between gap-4 bg-[var(--dc-bg,#f0eff6)]/50">
                    <button onClick={skipGdc} className="text-[13px] text-[var(--dc-muted)] hover:text-[var(--dc-text)] transition">
                      Skip for now
                    </button>
                    <button onClick={() => void uploadGdc()} disabled={!gdcFile || gdcUploading}
                      className="flex items-center gap-2 bg-[var(--dc-text,#0f172a)] text-white font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all text-[14px] disabled:opacity-40 shadow-[0_4px_14px_rgba(14,15,18,0.18)]">
                      {gdcUploading ? "Uploading…" : "Upload & continue"}
                      {!gdcUploading && <span className="material-symbols-outlined text-[16px] !text-white">arrow_forward</span>}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── SUPPLIER ── */}
          {activeStep === "supplier" && (
            <motion.div key="supplier"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.22,1,0.36,1] }}>

              {supConnected ? (
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-[var(--dc-surface,#ffffff)] rounded-[24px] border border-[var(--dc-border)] shadow-[0_4px_24px_rgba(15,23,42,0.07)] p-10 text-center">
                  <motion.div initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 240, damping: 18 }}
                    className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto mb-5">
                    <span className="material-symbols-outlined text-[44px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>celebration</span>
                  </motion.div>
                  <h2 className="text-2xl font-extrabold tracking-[-0.02em] mb-2">{selectedSupplier} connected.</h2>
                  <p className="text-[14px] text-[var(--dc-muted)]">Your workspace is unlocked. Taking you to your dashboard…</p>
                </motion.div>
              ) : (
                <div className="bg-[var(--dc-surface,#ffffff)] rounded-[24px] border border-[var(--dc-border)] shadow-[0_4px_24px_rgba(15,23,42,0.07)] overflow-hidden">
                  <div className="px-7 py-6 border-b border-[var(--dc-border)]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--dc-text,#0f172a)] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[17px] text-white">link</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--dc-muted)] mb-0.5">Step 2 of 3</p>
                        <h2 className="font-extrabold text-[17px] tracking-tight">Connect your first supplier</h2>
                      </div>
                    </div>
                  </div>

                  <div className="px-7 py-6 space-y-6">
                    <p className="text-[14px] text-[var(--dc-muted)] leading-relaxed">
                      Use your existing supplier login. Dentago saves it once, then searches prices and places orders on your behalf — no new accounts needed.
                    </p>

                    {/* Supplier picker */}
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--dc-muted)] mb-3">Select supplier</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {ONBOARDING_CONNECT_SUPPLIERS.map((name) => (
                          <SupplierTile key={name} name={name} selected={selectedSupplier === name}
                            onToggle={() => { setSelectedSupplier(name); setSupEmail(""); setSupPassword(""); setSupError(null); }} />
                        ))}
                      </div>
                    </div>

                    {/* Credentials */}
                    <AnimatePresence>
                      {selectedSupplier && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="space-y-3 pt-2 border-t border-[var(--dc-border)]">
                          {/* Supplier logo + field label */}
                          <div className="flex items-center gap-3 pt-1">
                            {SUPPLIER_LOGOS[selectedSupplier] ? (
                              <div className="w-10 h-10 rounded-xl border border-[var(--dc-border)] bg-white flex items-center justify-center flex-shrink-0 overflow-hidden p-1">
                                <img src={SUPPLIER_LOGOS[selectedSupplier]} alt={selectedSupplier} className="w-full h-full object-contain" />
                              </div>
                            ) : null}
                            <p className="text-[13px] font-semibold text-[var(--dc-text)]">Your {selectedSupplier} login</p>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--dc-muted)] mb-1.5">Email / username</label>
                            <input type="email" value={supEmail} onChange={(e) => setSupEmail(e.target.value)}
                              placeholder="orders@yourpractice.co.uk" autoComplete="username"
                              className="w-full px-4 py-3 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-bg,#f0eff6)] text-[14px] font-medium outline-none focus:border-[var(--dc-text)] focus:ring-2 focus:ring-[rgba(14,15,18,0.08)] transition" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--dc-muted)] mb-1.5">Password</label>
                            <input type="password" value={supPassword} onChange={(e) => setSupPassword(e.target.value)}
                              placeholder="••••••••" autoComplete="current-password"
                              className="w-full px-4 py-3 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-bg,#f0eff6)] text-[14px] font-medium outline-none focus:border-[var(--dc-text)] focus:ring-2 focus:ring-[rgba(14,15,18,0.08)] transition" />
                          </div>
                          <div className="rounded-xl bg-[rgba(14,15,18,0.03)] border border-[var(--dc-border)] px-4 py-3 space-y-1.5">
                            <p className="text-[11px] text-[var(--dc-muted)] flex items-center gap-1.5 font-medium">
                              <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                              AES-256 encrypted · never visible to anyone at Dentago
                            </p>
                            <p className="text-[11px] text-[var(--dc-muted)] flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[13px]">info</span>
                              We use these to search prices and push your basket to {selectedSupplier} on your behalf — you stay in control of every order.
                            </p>
                          </div>
                          {supError && <p className="text-[13px] text-red-500 font-medium">{supError}</p>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="px-7 py-5 border-t border-[var(--dc-border)] flex items-center justify-between gap-4 bg-[var(--dc-bg,#f0eff6)]/50">
                    <Link href="/dashboard" className="text-[13px] text-[var(--dc-muted)] hover:text-[var(--dc-text)] transition">
                      Skip for now
                    </Link>
                    <button
                      onClick={() => void connectSupplier()}
                      disabled={supConnecting || !selectedSupplier || !supEmail.trim() || !supPassword}
                      className="flex items-center gap-2 bg-[var(--dc-text,#0f172a)] text-white font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all text-[14px] disabled:opacity-40 shadow-[0_4px_14px_rgba(14,15,18,0.18)]">
                      {supConnecting ? (
                        <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60 15"/></svg>Connecting…</>
                      ) : (
                        <><span className="material-symbols-outlined text-[16px] !text-white">link</span>Connect {selectedSupplier || "supplier"}</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>

        {/* Locked features strip */}
        {!progress.supplier_connected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-6 rounded-[18px] border border-[var(--dc-border)] bg-[var(--dc-surface,#fff)] px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dc-muted)] mb-3">Unlocks after connecting a supplier</p>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: "bar_chart",    label: "Analytics"   },
                { icon: "savings",      label: "Savings"     },
                { icon: "inventory_2",  label: "Par levels"  },
                { icon: "approval",     label: "Approvals"   },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--dc-border)] text-[12px] font-semibold text-[var(--dc-muted)]">
                  <span className="material-symbols-outlined text-[13px]">{icon}</span>
                  {label}
                  <span className="material-symbols-outlined text-[11px] opacity-50">lock</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      </main>
    </div>
  );
}
