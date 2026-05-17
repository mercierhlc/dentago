"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { freshAuthHeaders, getToken } from "@/lib/auth";

interface Props {
  children: React.ReactNode;
  featureName: string;
  featureIcon: string;
  featureDesc: string;
}

export function LockedUntilFirstOrder({ children, featureName, featureIcon, featureDesc }: Props) {
  const [checked, setChecked] = useState(false);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setChecked(true); return; }

    freshAuthHeaders().then((headers) =>
      fetch("/api/clinic/onboarding", { headers }))
      .then((r) => r.json())
      .then((data: { steps?: { id: string; completed: boolean }[] }) => {
        // Unlock once both GDC registered and supplier connected
        const supplierStep = data.steps?.find((s) => s.id === "connect_supplier");
        const gdcStep = data.steps?.find((s) => s.id === "gdc_document");
        setLocked(!(supplierStep?.completed && gdcStep?.completed));
      })
      .catch(() => setLocked(false))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 rounded-full border-2 border-[rgba(14,15,18,0.15)] border-t-[#0e0f12] animate-spin" />
      </div>
    );
  }

  if (!locked) return <>{children}</>;

  return (
    <div className="relative min-h-[70vh]">
      {/* Blurred content */}
      <div className="pointer-events-none select-none opacity-25 blur-[4px] overflow-hidden max-h-[560px]">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px] text-center">

          <div className="w-16 h-16 rounded-2xl bg-white border border-[rgba(14,15,18,0.1)] shadow-[0_8px_24px_rgba(14,15,18,0.08)] flex items-center justify-center mx-auto mb-5">
            <div className="relative">
              <span className="material-symbols-outlined text-[30px] text-neutral-300" style={{ fontVariationSettings: "'FILL' 1" }}>{featureIcon}</span>
              <span className="absolute -bottom-1 -right-1 material-symbols-outlined text-[14px] text-neutral-400 bg-white rounded-full" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            </div>
          </div>

          <h3 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#0e0f12] mb-2">
            {featureName} is locked
          </h3>
          <p className="text-[14px] text-neutral-500 leading-relaxed mb-6">
            {featureDesc}<br />
            <span className="font-semibold text-[#0e0f12]">Complete setup</span> to unlock — takes 2 minutes.
          </p>

          <Link
            href="/dashboard/onboarding"
            className="inline-flex items-center gap-2 bg-[#0e0f12] text-white font-bold px-7 py-3.5 rounded-xl hover:bg-black active:scale-[0.97] transition-all text-sm shadow-[0_4px_16px_rgba(14,15,18,0.18)]">
            <span className="material-symbols-outlined text-[16px] !text-white" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
            Complete setup →
          </Link>

          <p className="mt-5 text-[11px] text-neutral-400">
            Already connected?{" "}
            <button
              onClick={() => { setChecked(false); setLocked(true); setTimeout(() => { window.location.reload(); }, 100); }}
              className="underline underline-offset-2 hover:text-[#0e0f12] transition cursor-pointer">
              Refresh
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
