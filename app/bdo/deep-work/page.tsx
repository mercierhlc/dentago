"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { METRIC_DEFINITIONS, useBdoStore } from "@/stores/bdo-store";

export default function BdoDeepWorkPage() {
  const deep = useBdoStore((s) => s.metrics.deepWorkHoursWeek);

  /** Illustrative distractions index — deterministic until wired */
  const distraction = deep.series.map((v, i) => ({
    w: `${i + 1}`,
    hours: Number((v / 25 + 14).toFixed(1)),
    distraction: Number((Math.max(2, 9 - i * 0.15)).toFixed(2)),
  }));

  const label = METRIC_DEFINITIONS.deepWorkHoursWeek.label;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Deep Work Tracker</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Focus compounds slower than adrenaline — visualize depth, calibrate interruptions honestly, and correlate with
          ship cadence externally.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{label}</p>
          <p className="mt-3 font-[family-name:var(--font-mono)] text-4xl text-[var(--primary)]">{deep.value}h</p>
          <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">Prior window {deep.previous}h · adjust via Command metrics</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Execution quality proxy</p>
          <p className="mt-3 text-4xl font-[family-name:var(--font-mono)] text-[var(--foreground)]">B+</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
            Replace subjective letter grades with reviewer scores or milestone closure rate once defined.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Hours vs distractions (illustrative)
        </h3>
        <div className="mt-4 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={distraction} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="w" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="h" orientation="left" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="d" orientation="right" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Area yAxisId="h" type="monotone" dataKey="hours" stroke="var(--primary)" fill="rgba(91,156,255,0.22)" strokeWidth={1.5} />
              <Area yAxisId="d" type="monotone" dataKey="distraction" stroke="var(--chart-5)" fill="rgba(251,113,133,0.12)" strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
