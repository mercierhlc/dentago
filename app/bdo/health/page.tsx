"use client";

import { useBdoStore } from "@/stores/bdo-store";
import { formatPct } from "@/lib/bdo/format";

export default function BdoHealthPage() {
  const metrics = useBdoStore((s) => s.metrics);
  const setMetric = useBdoStore((s) => s.setMetricValue);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Health & Energy</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Destroyed founders do not steward billion-dollar outcomes. Biological decline is strategic risk — log it bluntly.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {([
          ["sleepScore", "Sleep score"] as const,
          ["trainingConsistencyPct", "Physical training consistency %"] as const,
          ["strategicAlignmentScore", "Mind alignment (subjective calibration)"] as const,
        ]).map(([key, lab]) => {
          const row = metrics[key];
          return (
            <div key={key} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{lab}</p>
              <label className="mt-4 block">
                <input
                  type="range"
                  min={0}
                  max={key === "strategicAlignmentScore" ? 10 : 100}
                  step={key === "strategicAlignmentScore" ? 0.1 : 1}
                  value={row.value}
                  onChange={(e) => setMetric(key, Number(e.target.value))}
                  className="w-full accent-[var(--primary)]"
                />
                <p className="mt-3 font-[family-name:var(--font-mono)] text-2xl text-[var(--foreground)]">
                  {key === "strategicAlignmentScore" ? row.value.toFixed(1) : formatPct(row.value, 0)}
                </p>
              </label>
            </div>
          );
        })}
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Protocol
        </h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] text-[var(--muted-foreground)]">
          <li>Weekly minimums for sleep, strength, and sunlight are not negotiable aesthetics — they&apos;re cognition insurance.</li>
          <li>When sleep score drops below your floor for 10 days: assume decision quality decay until proven otherwise.</li>
        </ul>
      </section>
    </div>
  );
}
