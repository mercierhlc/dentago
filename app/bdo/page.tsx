"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { NetWorthHero } from "@/components/bdo/net-worth-hero";
import { BdoMetricCard } from "@/components/bdo/bdo-metric-card";
import { PARTNER_ROLES_HEADLINE } from "@/lib/bdo/partner-charter";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  METRIC_DEFINITIONS,
  type MetricSeriesKey,
  useBdoStore,
} from "@/stores/bdo-store";
import { formatUsdCompact } from "@/lib/bdo/format";

const COMMAND_METRICS_ORDER: MetricSeriesKey[] = [
  "estimatedNetWorth",
  "dentagoValuation",
  "ownershipPct",
  "arr",
  "gmv",
  "activeClinics",
  "payingClinics",
  "monthlyBurn",
  "runwayMonths",
  "suppliersIntegrated",
  "retentionPct",
  "deepWorkHoursWeek",
  "sleepScore",
  "trainingConsistencyPct",
  "strategicAlignmentScore",
];

const INVERT_TREND: Partial<Record<MetricSeriesKey, boolean>> = {
  monthlyBurn: true,
};

export default function BdoCommandCenterPage() {
  const metrics = useBdoStore((s) => s.metrics);

  const valuationSeries = metrics.dentagoValuation.series.map((v, i) => ({
    w: `W${i + 1}`,
    v,
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Command Center</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Objective truth, long-compound cadence, and strategic leverage — not motivation theater. Calibrate inputs in
          Settings; persistence is local until you wire Supabase.
        </p>
      </header>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 ring-1 ring-[var(--primary)]/15">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
          Execution partner framing · not motivational AI
        </p>
        <p className="mt-3 text-[13px] font-medium leading-relaxed text-[var(--foreground)]">
          {PARTNER_ROLES_HEADLINE}
        </p>
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
          Primary directional mission: accelerate Dentago toward{" "}
          <strong className="font-medium text-[var(--foreground)]">£1M MRR</strong> with ruthless focus on retention,
          weekly ordering habits, suppliers, onboarding, reliability, distribution — acknowledging the maths (~3.3k+
          paying sites at £299) is unusually aggressive unless ACV materially shifts.
        </p>
        <Link
          href="/bdo/charter"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex border-[var(--border)]")}
        >
          Open full £1M MRR Operating System charter
        </Link>
      </div>

      <NetWorthHero netWorth={metrics.estimatedNetWorth.value} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            Live strategic metrics
          </h3>
          <span className="text-[11px] text-[var(--muted-foreground)]">Sparklines: trailing windows · MoM delta</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {COMMAND_METRICS_ORDER.map((key) => {
            const def = METRIC_DEFINITIONS[key];
            const row = metrics[key];
            return (
              <BdoMetricCard
                key={key}
                label={def.label}
                value={row.value}
                previous={row.previous}
                series={row.series}
                format={def.format}
                invertTrend={INVERT_TREND[key]}
              />
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Valuation glide path (hypothetical series)
          </h3>
          <span className="text-[11px] text-[var(--muted-foreground)]">Replace with audited pulls</span>
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={valuationSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="w" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => formatUsdCompact(v as number)}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--muted-foreground)" }}
                formatter={(value) => formatUsdCompact(typeof value === "number" ? value : 0)}
              />
              <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
