"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const SIGNUP_THEME_KEY = "dentago_login_theme";

export function useSignupTheme() {
  const [appearance, setAppearance] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIGNUP_THEME_KEY);
      if (saved === "dark" || saved === "light") setAppearance(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setAppearance((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(SIGNUP_THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { appearance, toggle, isDark: appearance === "dark" };
}

/** Subtle topo lines — Hightouch-style ambient background */
export function SignupTopoBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg className="absolute left-1/2 top-0 h-full w-[min(140%,1200px)] -translate-x-1/2 opacity-[0.14] text-neutral-400" viewBox="0 0 800 900" fill="none">
        <path
          d="M-40 120c120 40 240-40 360 0s240 80 360 40 240-60 360-20"
          stroke="currentColor"
          strokeWidth="0.75"
        />
        <path
          d="M-40 280c100 50 220-30 340 20s260 70 380 30 220-80 360-40"
          stroke="currentColor"
          strokeWidth="0.65"
        />
        <path
          d="M-40 440c140 30 260-50 380 10s220 90 400 50 200-70 380-30"
          stroke="currentColor"
          strokeWidth="0.55"
        />
        <path
          d="M-40 600c110 45 230-35 350 15s250 65 390 25 210-75 370-35"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <path
          d="M-40 760c130 35 250-45 370 5s230 85 410 45 190-65 390-25"
          stroke="currentColor"
          strokeWidth="0.45"
        />
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(17,17,17,0.06),transparent_55%)]" />
    </div>
  );
}

export function signupShellClass(isDark: boolean) {
  return cn(
    "relative min-h-screen overflow-x-hidden",
    isDark
      ? "dentago-clinic-shell bg-[var(--dc-bg)] text-[var(--dc-text)] selection:bg-[var(--dc-accent)]/30"
      : "bg-[#f6f7f9] text-neutral-900 selection:bg-[#111111]/15",
  );
}
