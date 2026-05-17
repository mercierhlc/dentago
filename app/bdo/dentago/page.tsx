"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  METRIC_DEFINITIONS,
  type MetricSeriesKey,
  useBdoStore,
} from "@/stores/bdo-store";
import { formatPct } from "@/lib/bdo/format";

const DENTAGO_KEYS: MetricSeriesKey[] = [
  "activeClinics",
  "payingClinics",
  "gmv",
  "arr",
  "suppliersIntegrated",
  "retentionPct",
  "runwayMonths",
  "monthlyBurn",
];

/** Placeholder operational metrics — wire to warehouse / accountant truth */
const OPS_ROWS = [
  { label: "Verified clinics", value: "—", hint: "Define verification standard" },
  { label: "D14 reorder rate", value: "—", hint: "Cohort tooling" },
  { label: "Net revenue retention", value: "112%", hint: "Illustrative" },
  { label: "CAC (blended)", value: "£3.8k", hint: "Model-dependent" },
  { label: "LTV/CAC", value: "—", hint: "Need stable churn" },
  { label: "Churn (logo)", value: "—", hint: "No vanity smoothing" },
  { label: "Supplier reliability SLA", value: "97.4%", hint: "Uptime-style proxy" },
] as const;

export default function BdoDentagoPage() {
  const metrics = useBdoStore((s) => s.metrics);

  const retentionCohort = [
    { month: "M0", retained: 100 },
    { month: "M1", retained: 96 },
    { month: "M2", retained: 92 },
    { month: "M3", retained: 88 },
    { month: "M6", retained: 81 },
    { month: "M12", retained: 74 },
  ];

  const barData = DENTAGO_KEYS.map((key) => ({
    label: METRIC_DEFINITIONS[key].label.replace(/ /g, "\n"),
    raw: metrics[key].value,
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Dentago Metrics</h2>
          <Badge variant="outline" className="border-[var(--border)] text-[10px] uppercase tracking-[0.16em]">
            Infrastructure operator view
          </Badge>
        </div>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          This is the business cockpit: density, liquidity, retention, supplier graph health. Charts below mix persisted store
          values with illustrative cohort curves — replace with warehouse-grade series.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DENTAGO_KEYS.map((key) => {
          const def = METRIC_DEFINITIONS[key];
          const row = metrics[key];
          const display =
            def.format === "pct"
              ? formatPct(row.value, 1)
              : def.format === "months"
                ? `${Math.round(row.value)} mo`
                : def.format === "usd_short"
                  ? new Intl.NumberFormat("en-GB", {
                      style: "currency",
                      currency: "GBP",
                      maximumFractionDigits: 0,
                    }).format(row.value)
                  : String(Math.round(row.value));
          return (
            <div
              key={key}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 ring-1 ring-white/[0.02]"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                {def.label}
              </p>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-xl tracking-tight text-[var(--foreground)]">
                {display}
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                Prev period {def.format === "pct" ? formatPct(row.previous, 1) : Math.round(row.previous)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Core drivers snapshot
          </h3>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={108}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="raw" fill="var(--primary)" radius={[0, 4, 4, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Illustrative cohort retention
          </h3>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retentionCohort}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[70, 100]}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) =>
                    `${typeof value === "number" ? value : "?"}%`
                  }
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="retained" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
            Ship real cohort tables from your analytics store — this is structural placeholder data.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Operating truth grid
          </h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3">
          {OPS_ROWS.map((row) => (
            <div key={row.label} className="border-b border-[var(--border)] p-4 sm:border-r sm:last:border-r-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{row.label}</p>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)]">{row.value}</p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{row.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
