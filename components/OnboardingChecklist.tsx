"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { freshAuthHeaders } from "@/lib/auth";
import type { OnboardingStep } from "@/lib/onboarding";

const DISMISS_KEY = "onboarding_dismissed_until";

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const until = localStorage.getItem(DISMISS_KEY);
  if (!until) return false;
  return Date.now() < parseInt(until, 10);
}

export default function OnboardingChecklist({ clinicId }: { clinicId: string }) {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [allComplete, setAllComplete] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check dismiss first (client-only)
    if (isDismissed()) {
      setDismissed(true);
      setLoading(false);
      return;
    }
    setDismissed(false);

    async function fetchStatus() {
      try {
        const headers = await freshAuthHeaders();
        const res = await fetch("/api/clinic/onboarding", { headers });
        if (!res.ok) return;
        const data = await res.json();
        setSteps(data.steps ?? []);
        setAllComplete(data.allComplete ?? false);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  function dismiss() {
    const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setDismissed(true);
  }

  if (loading || dismissed || allComplete || steps.length === 0) return null;

  const completedCount = steps.filter((s) => s.completed).length;

  return (
    <div className="bg-white rounded-3xl border border-[#111111]/20 shadow-[0_4px_24px_rgba(17,17,17,0.08)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-extrabold text-[#151121]">Get started with Dentago</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Complete these steps to start saving on dental supplies
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors ml-4 flex-shrink-0"
          aria-label="Dismiss onboarding checklist"
        >
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-slate-400">
            {completedCount} of {steps.length} complete
          </span>
          <span className="text-[11px] font-bold text-[#111111]">
            {Math.round((completedCount / steps.length) * 100)}%
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#111111] rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-slate-50 px-6 pb-4 pt-2">
        {steps.map((step, i) => (
          <div key={step.id} className={`flex items-center gap-4 py-3.5 ${step.completed ? "opacity-60" : ""}`}>
            {/* Icon */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                step.completed
                  ? "bg-emerald-100"
                  : "bg-[#111111]/10 border-2 border-[#111111]/30"
              }`}
            >
              {step.completed ? (
                <span
                  className="material-symbols-outlined text-[14px] text-emerald-600"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check
                </span>
              ) : (
                <span className="text-[11px] font-black text-[#111111]">{i + 1}</span>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-bold ${
                  step.completed ? "text-slate-500 line-through" : "text-[#151121]"
                }`}
              >
                {step.title}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{step.description}</p>
            </div>

            {/* CTA */}
            {!step.completed && (
              <Link
                href={step.href}
                className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex-shrink-0 ${
                  step.locked
                    ? "border border-[#111111]/35 bg-white text-[#111111] hover:bg-[#111111]/5"
                    : "bg-[#111111] text-white hover:brightness-110 shadow-md shadow-[#111111]/20"
                }`}
              >
                {step.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
