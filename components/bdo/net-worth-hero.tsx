"use client";

import { motion } from "framer-motion";

import { formatUsdFull, formatPct, progressionToBillion } from "@/lib/bdo/format";
import { cn } from "@/lib/utils";

export function NetWorthHero({
  netWorth,
  className,
}: {
  netWorth: number;
  className?: string;
}) {
  const pct = progressionToBillion(netWorth);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-b from-[#0a0d14] to-[var(--card)] p-6 sm:p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(91,156,255,0.14),transparent_55%)]" />
      <div className="relative space-y-6">
        <div className="space-y-1 text-center sm:text-left">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
            Terminal objective
          </p>
          <p className="font-[family-name:var(--font-mono)] text-2xl font-medium tracking-[-0.04em] text-[var(--foreground)] sm:text-3xl">
            $0 → $1,000,000,000
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Current estimated net worth
            </p>
            <motion.p
              className="font-[family-name:var(--font-mono)] text-3xl font-medium tracking-tight text-[var(--foreground)] sm:text-4xl"
              initial={{ opacity: 0.35 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              {formatUsdFull(netWorth)}
            </motion.p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Progress
            </p>
            <p className="font-[family-name:var(--font-mono)] text-xl font-medium tracking-tight text-[var(--primary)]">
              {formatPct(pct, 2)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)] ring-1 ring-[var(--border)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#284d8a] to-[var(--primary)]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0.35, pct)}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className="text-center text-[11px] leading-relaxed text-[var(--muted-foreground)] sm:text-left">
            This bar is meant to feel sobering — not gamified. Compounding is slow until it isn&apos;t.
          </p>
        </div>
      </div>
    </div>
  );
}
