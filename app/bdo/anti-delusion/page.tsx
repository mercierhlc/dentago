"use client";

import { useBdoStore } from "@/stores/bdo-store";
import { formatUsdCompact } from "@/lib/bdo/format";
import { cn } from "@/lib/utils";

export default function BdoAntiDelusionPage() {
  const honest = useBdoStore((s) => s.honest);
  const patch = useBdoStore((s) => s.patchHonestMetric);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Anti-Delusion Metrics</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Vanity dies here. If these numbers degrade while narrative improves, your job is diagnosis — not storytelling.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {honest.map((h) => {
          const severity =
            h.warning === "critical"
              ? "border-[#7f1d1d]/55 bg-[#1f0a0a]/90"
              : h.warning === "watch"
                ? "border-amber-500/25 bg-amber-500/[0.07]"
                : "border-[var(--border)] bg-[var(--card)]";
          return (
            <div key={h.key} className={cn("rounded-lg border p-4 ring-1 ring-white/[0.02]", severity)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    {h.warning}
                  </p>
                  <h3 className="mt-1 text-sm font-medium text-[var(--foreground)]">{h.label}</h3>
                </div>
              </div>
              <label className="mt-4 block">
                <span className="sr-only">value</span>
                <input
                  type="number"
                  step="any"
                  value={h.value}
                  onChange={(e) => patch(h.key, Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)]"
                />
              </label>
              {h.key === "real_revenue_mrr" && (
                <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                  Implies ARR ~
                  {formatUsdCompact(h.value * 12)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Deterioration protocol
        </h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] text-[var(--muted-foreground)]">
          <li>Identify whether drift is execution, measurement, or market truth.</li>
          <li>Shrink the horizon to weekly truth tests — one metric, one owner, one decision.</li>
          <li>Document the failure mode in Decision Log before narrative hardens.</li>
        </ol>
      </section>
    </div>
  );
}
