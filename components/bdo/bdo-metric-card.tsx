"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import {
  formatPct,
  formatUsdCompact,
  formatUsdFull,
} from "@/lib/bdo/format";
import { cn } from "@/lib/utils";
import type { MetricPoint } from "@/stores/bdo-store";
import { BdoSparkline } from "@/components/bdo/bdo-sparkline";

interface BdoMetricCardProps {
  label: string;
  value: number;
  previous: number;
  series: number[];
  format: MetricPoint["format"];
  /** When true, decrease vs previous is shown as favorable (e.g. burn). */
  invertTrend?: boolean;
  className?: string;
}

function formatDisplay(format: MetricPoint["format"], v: number): string {
  switch (format) {
    case "usd":
      return formatUsdFull(v);
    case "usd_short":
      return formatUsdCompact(v);
    case "pct":
      return formatPct(v, 1);
    case "count":
      return new Intl.NumberFormat("en-GB").format(Math.round(v));
    case "months":
      return `${Math.round(v)} mo`;
    case "hours":
      return `${v.toFixed(1)}h`;
    case "score":
      return v <= 10 && v >= 0 && !Number.isInteger(v) ? v.toFixed(1) : String(Math.round(v));
    default:
      return String(v);
  }
}

export function BdoMetricCard({
  label,
  value,
  previous,
  series,
  format,
  invertTrend = false,
  className,
}: BdoMetricCardProps) {
  const delta =
    previous === 0 ? 0 : ((value - previous) / Math.abs(previous)) * 100;
  const improved = invertTrend ? delta < 0 : delta > 0;
  const flat = Math.abs(delta) < 0.25;

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 ring-1 ring-white/[0.02]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            {label}
          </p>
          <p
            className="truncate font-[family-name:var(--font-mono)] text-lg font-medium tracking-tight text-[var(--foreground)]"
            title={String(value)}
          >
            {formatDisplay(format, value)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
            {flat ? (
              <Minus className="size-3.5 opacity-60" strokeWidth={1.5} />
            ) : improved ? (
              <TrendingUp className="size-3.5 text-[var(--chart-2)]" strokeWidth={1.5} />
            ) : (
              <TrendingDown className="size-3.5 text-[var(--chart-5)]" strokeWidth={1.5} />
            )}
            <span>
              {flat ? "Flat vs 30d" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}% vs 30d`}
            </span>
          </div>
        </div>
        <div className="h-12 w-[88px] shrink-0 opacity-90">
          <BdoSparkline data={series} positive={improved || flat} />
        </div>
      </div>
    </div>
  );
}
