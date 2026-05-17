"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getFreshToken } from "@/lib/auth";
import {
  getProUpgradeContent,
  normalizeProUpgradeFeature,
  pricingHref,
  type ProUpgradeContent,
  type ProUpgradeOutcome,
} from "@/lib/pro-upgrade-content";
import { cn } from "@/lib/utils";

/** Neutral sparkline — inventory velocity */
function Sparkline() {
  return (
    <svg viewBox="0 0 120 32" className="h-8 w-full text-slate-400" aria-hidden>
      <path
        d="M0 24 L20 22 L40 14 L60 18 L80 8 L100 12 L120 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45}
      />
      <path
        d="M0 24 L20 22 L40 14 L60 18 L80 8 L100 12 L120 4 L120 32 L0 32 Z"
        fill="currentColor"
        opacity={0.06}
      />
    </svg>
  );
}

function DeviceFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        className={cn(
          "rounded-[20px] border border-slate-200/90 bg-gradient-to-b from-slate-100/90 to-slate-50/80 p-2 shadow-[0_32px_64px_-12px_rgba(15,23,42,0.18)]",
          "dark:border-white/[0.12] dark:from-zinc-800/90 dark:to-zinc-900/80 dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]",
        )}
      >
        <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
          <span className="h-2 w-2 rounded-full bg-red-400/80" />
          <span className="h-2 w-2 rounded-full bg-amber-400/80" />
          <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
        </div>
        <div
          className={cn(
            "overflow-hidden rounded-[14px] border border-slate-200/80 bg-white",
            "dark:border-white/[0.08] dark:bg-zinc-950",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function PreviewInventory() {
  return (
    <DeviceFrame>
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-white/[0.06] dark:bg-zinc-900/50">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Stock health · live</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            184 OK
          </span>
        </div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">186</p>
            <p className="text-[10px] font-medium text-slate-500">{"SKUs tracked · 3 exp < 30d"}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-right dark:border-white/[0.08] dark:bg-zinc-900">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Burn vs prior</p>
            <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">−12%</p>
            <p className="text-[9px] text-slate-500">last 30d</p>
          </div>
        </div>
        <Sparkline />
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[9px] font-semibold text-slate-600 dark:border-white/[0.08] dark:bg-zinc-900 dark:text-slate-400">Lot recall lookup</span>
          <span className="rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[9px] font-semibold text-slate-600 dark:border-white/[0.08] dark:bg-zinc-900 dark:text-slate-400">Par + expiry</span>
          <span className="rounded-md border border-dashed border-slate-300/90 bg-slate-50 px-2 py-1 text-[9px] font-semibold text-slate-500 dark:border-white/[0.12] dark:bg-zinc-800/80 dark:text-slate-400">Draft reorder</span>
        </div>
      </div>
      <div className="space-y-0 divide-y divide-slate-100 dark:divide-white/[0.06]">
        <div className="bg-red-50/50 px-4 py-3.5 dark:bg-red-950/20">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500 text-xs font-black text-white">!</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">Septanest 1:100k</span>
                <span className="text-[11px] text-red-700 dark:text-red-400">Critical · zero in 4d · Lot 7F-9921</span>
              </span>
            </span>
            <span className="shrink-0 rounded-md bg-white/80 px-2 py-1 text-xs font-bold tabular-nums text-red-800 ring-1 ring-red-200 dark:bg-zinc-900 dark:text-red-300 dark:ring-red-900/50">
              3 left
            </span>
          </div>
          <p className="mt-2 pl-12 text-[10px] font-medium text-red-800/90 dark:text-red-300/80">Exp 14 Aug · flag for next week&apos;s lists</p>
        </div>
        <div className="flex items-center justify-between gap-3 bg-amber-50/40 px-4 py-3.5 dark:bg-amber-950/15">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-xs font-black text-white">!</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">Nitrile gloves M</span>
              <span className="text-[11px] text-amber-800 dark:text-amber-300/90">Low · zero in 9d</span>
            </span>
          </span>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">14 boxes</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <span className="text-sm font-bold">✓</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">Filtek Universal A2</span>
              <span className="text-[10px] text-slate-500">28 syringes · healthy</span>
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <span className="text-sm font-bold">✓</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">Scotchbond Universal</span>
              <span className="text-[10px] text-slate-500">11 bottles · healthy</span>
            </span>
          </span>
        </div>
      </div>
      <p className="bg-slate-50 py-2 text-center text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:bg-zinc-900/80 dark:text-slate-500">
        Illustrative preview · same story as /platform#stock-tracking
      </p>
    </DeviceFrame>
  );
}

function PreviewSavings() {
  return (
    <DeviceFrame>
      <div className="px-4 pb-2 pt-4">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tracked vs list · Q2</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">£4,212</p>
        <p className="text-xs text-slate-500">Estimated captured in period</p>
      </div>
      <div className="flex h-44 items-end justify-between gap-1.5 px-4 pb-4 pt-2">
        {[38, 55, 48, 72, 64, 88, 76].map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2">
            <div
              className="w-full max-w-[36px] rounded-t-md bg-gradient-to-t from-slate-700 to-slate-400 dark:from-zinc-200 dark:to-zinc-500"
              style={{ height: `${h}%` }}
            />
            <span className="text-[8px] font-semibold uppercase text-slate-400">{["W", "1", "2", "3", "4", "5", "6"][i]}</span>
          </div>
        ))}
      </div>
      <div className="mx-4 mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-white/[0.06] dark:bg-zinc-900/60">
        <div>
          <p className="text-[9px] font-semibold uppercase text-slate-400">List delta</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">−9.2%</p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase text-slate-400">Top SKU win</p>
          <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">Gloves M</p>
        </div>
      </div>
      <p className="bg-slate-50 py-2 text-center text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:bg-zinc-900/80 dark:text-slate-500">
        Illustrative preview
      </p>
    </DeviceFrame>
  );
}

function PreviewApprovals() {
  return (
    <DeviceFrame>
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/[0.06] dark:bg-zinc-900/40">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Queue</span>
        <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-900">3</span>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {[
          { who: "Dr. Chen", sub: "Basket · 14 lines", amt: "£1,240", z: true },
          { who: "Hygienists", sub: "Consignment restock", amt: "£286", z: false },
          { who: "Locum", sub: "One-off supplies", amt: "£412", z: false },
        ].map((row) => (
          <div
            key={row.who}
            className={cn(
              "rounded-xl px-3 py-3",
              row.z ? "bg-slate-900 text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900" : "bg-slate-50/90 dark:bg-zinc-900/50",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", row.z ? "text-white dark:text-zinc-900" : "text-slate-900 dark:text-white")}>{row.who}</p>
                <p className={cn("text-[11px]", row.z ? "text-white/70 dark:text-zinc-600" : "text-slate-500")}>{row.sub}</p>
              </div>
              <p className={cn("shrink-0 text-sm font-bold tabular-nums", row.z ? "text-white dark:text-zinc-900" : "text-slate-800 dark:text-slate-100")}>{row.amt}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-white/[0.06]">
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:border-white/[0.1] dark:bg-zinc-900 dark:text-slate-400">
          Review
        </span>
        <span className="rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-semibold text-white dark:bg-white dark:text-zinc-900">Approve all</span>
      </div>
      <p className="bg-slate-50 py-2 text-center text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:bg-zinc-900/80 dark:text-slate-500">
        Illustrative preview
      </p>
    </DeviceFrame>
  );
}

function PreviewAnalytics() {
  return (
    <DeviceFrame>
      <div className="border-b border-slate-100 px-4 py-3 dark:border-white/[0.06]">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Spend by supplier · April</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">£26.5k</p>
        <p className="text-[10px] text-slate-500">Clinic total · month to date</p>
      </div>
      <div className="space-y-4 p-4">
        {[
          { n: "Henry Schein", w: 92 },
          { n: "Dental Sky", w: 68 },
          { n: "Kent Express", w: 44 },
        ].map((s) => (
          <div key={s.n}>
            <div className="mb-1.5 flex justify-between text-[11px]">
              <span className="font-medium text-slate-700 dark:text-slate-200">{s.n}</span>
              <span className="tabular-nums text-slate-500">{s.w}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-slate-600 to-slate-400 dark:from-zinc-300 dark:to-zinc-500"
                style={{ width: `${s.w}%` }}
              />
            </div>
          </div>
        ))}
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-center dark:border-white/[0.08] dark:bg-zinc-900/40">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Benchmark</p>
          <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">−9% vs UK median</p>
        </div>
      </div>
      <p className="bg-slate-50 py-2 text-center text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:bg-zinc-900/80 dark:text-slate-500">
        Illustrative preview
      </p>
    </DeviceFrame>
  );
}

function PreviewAI() {
  return (
    <DeviceFrame>
      <div className="border-b border-slate-800 bg-zinc-950 px-4 py-3">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Assistant</p>
        <p className="mt-0.5 text-sm font-medium text-slate-200">Ask in plain English · answers with your numbers</p>
      </div>
      <div className="space-y-2 bg-zinc-950 p-4">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[12px] text-slate-400">Did PPE spend drop after we switched gloves?</div>
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.08] px-3 py-3 text-[11px] leading-relaxed text-slate-200">
          <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-sky-400/90">Reply</span>
          Yes — down £312 vs Q1. Four of six recent orders favour Wrights on unit cost. Lock as default?
        </div>
        <div className="flex gap-2 pt-1">
          <span className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-400">Not now</span>
          <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-semibold text-zinc-900">Apply</span>
        </div>
      </div>
      <p className="bg-zinc-900 py-2 text-center text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">Illustrative preview</p>
    </DeviceFrame>
  );
}

function PreviewHub() {
  return (
    <DeviceFrame>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {[
          { t: "Search", sub: "All suppliers" },
          { t: "Cart", sub: "One checkout" },
          { t: "Suppliers", sub: "Live links" },
          { t: "Approvals", sub: "Guard rails" },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm dark:border-white/[0.08] dark:from-zinc-900 dark:to-zinc-950"
          >
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{c.t}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{c.sub}</p>
          </div>
        ))}
      </div>
      <div className="mx-4 mb-4 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-10 text-center dark:border-white/[0.08] dark:bg-zinc-900/60">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300/80 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-800">
          <span className="material-symbols-outlined text-2xl text-slate-500">hub</span>
        </div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">One operating layer</p>
        <p className="mx-auto mt-1 max-w-[200px] text-[11px] leading-snug text-slate-500">Procurement through to finance — no silos.</p>
      </div>
      <p className="bg-slate-50 py-2 text-center text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:bg-zinc-900/80 dark:text-slate-500">
        Illustrative preview
      </p>
    </DeviceFrame>
  );
}

function PreviewGeneric() {
  return (
    <DeviceFrame>
      <div className="relative overflow-hidden px-6 py-12 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden>
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full border border-slate-200 dark:border-white/[0.06]" />
          <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full border border-slate-200 dark:border-white/[0.06]" />
        </div>
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-800 to-slate-600 text-2xl font-black tracking-tight text-white shadow-xl dark:from-zinc-100 dark:to-zinc-300 dark:text-zinc-900">
          Pro
        </div>
        <p className="relative mt-6 text-lg font-semibold text-slate-900 dark:text-white">£299/mo</p>
        <p className="relative mx-auto mt-2 max-w-[240px] text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          30-day free trial · then £299/mo — procurement on autopilot: inventory, approvals, analytics, and hands-off basket workflows for UK clinics.
        </p>
      </div>
      <p className="bg-slate-50 py-2 text-center text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:bg-zinc-900/80 dark:text-slate-500">
        Illustrative preview
      </p>
    </DeviceFrame>
  );
}

function PreviewMock({ kind }: { kind: ProUpgradeContent["preview"] }) {
  switch (kind) {
    case "inventory":
      return <PreviewInventory />;
    case "savings":
      return <PreviewSavings />;
    case "approvals":
      return <PreviewApprovals />;
    case "analytics":
      return <PreviewAnalytics />;
    case "ai":
      return <PreviewAI />;
    case "hub":
      return <PreviewHub />;
    default:
      return <PreviewGeneric />;
  }
}

const FALLBACK_OUTCOMES: ProUpgradeOutcome[] = [
  {
    icon: "timer",
    title: "Win back Monday mornings",
    body: "Less chasing suppliers and stock — more time with patients and team.",
  },
  {
    icon: "verified",
    title: "Built for UK dental ops",
    body: "Stock, approvals, and spend in one layer — not six disconnected logins.",
  },
  {
    icon: "favorite",
    title: "Try it properly for 30 days",
    body: "Full Pro on your workspace before you pay — same promise as our pricing page.",
  },
];

function outcomesFor(content: ProUpgradeContent): ProUpgradeOutcome[] {
  if (content.outcomes && content.outcomes.length > 0) return content.outcomes;
  return FALLBACK_OUTCOMES;
}

function OutcomeTiles({ items }: { items: ProUpgradeOutcome[] }) {
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-3">
      {items.map((o) => (
        <li
          key={o.title}
          className={cn(
            "flex flex-col rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm",
            "dark:border-white/[0.08] dark:bg-zinc-900/60 dark:shadow-none",
          )}
        >
          <span
            className={cn(
              "material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-[22px] text-slate-700",
              "dark:border-white/[0.08] dark:bg-zinc-800 dark:text-slate-200",
            )}
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 500" }}
            aria-hidden
          >
            {o.icon}
          </span>
          <p className="mt-3 text-sm font-bold leading-snug text-[var(--dc-text,#0f172a)] dark:text-white">{o.title}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{o.body}</p>
        </li>
      ))}
    </ul>
  );
}

export default function ProUpgradeUpsell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<"free" | "pro" | "unknown">("unknown");

  const featureId = useMemo(() => {
    const raw = searchParams.get("f") ?? searchParams.get("feature");
    return normalizeProUpgradeFeature(raw);
  }, [searchParams]);

  const from = searchParams.get("from") ?? "upgrade";

  const content = useMemo(() => getProUpgradeContent(featureId), [featureId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tok = await getFreshToken();
      if (!tok || cancelled) {
        setPlan("free");
        return;
      }
      const res = await fetch("/api/clinic/me", { headers: { Authorization: `Bearer ${tok}` } });
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { clinic?: { product_plan?: string } };
      const p = body.clinic?.product_plan === "pro" ? "pro" : "free";
      if (!cancelled) setPlan(p);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (plan !== "pro") return;
    router.replace("/dashboard");
  }, [plan, router]);

  if (plan === "unknown") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--dc-border)]" aria-hidden />
      </div>
    );
  }

  if (plan === "pro") return null;

  const learnMoreHref = `/platform#${content.learnMoreHash}`;
  const primaryHref = pricingHref(featureId === "default" ? "default" : featureId, from);
  const outcomeItems = outcomesFor(content);

  return (
    <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-4 py-8 md:px-8 md:py-12">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(15,23,42,0.06),transparent_55%),radial-gradient(ellipse_70%_50%_at_100%_50%,rgba(15,23,42,0.04),transparent_50%)] dark:bg-[radial-gradient(ellipse_100%_50%_at_50%_0%,rgba(255,255,255,0.06),transparent_50%)]"
        aria-hidden
      />
      <div className="mx-auto max-w-[1180px]">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--dc-muted,#64748b)] transition-colors hover:text-[var(--dc-text,#0f172a)] dark:hover:text-[var(--dc-text)]"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to workspace
        </Link>

        {/* Value-first: copy before preview on all breakpoints */}
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.12fr)] lg:gap-14 xl:gap-16">
          <div className="max-w-xl lg:pt-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dc-muted,#64748b)]">{content.kicker}</p>
            <h1 className="mt-3 font-sans text-[clamp(1.85rem,4.2vw,2.65rem)] font-bold leading-[1.06] tracking-[-0.04em] text-[var(--dc-text,#0f172a)] dark:text-white">
              {content.headline}
            </h1>
            <p className="mt-4 text-lg font-semibold leading-snug text-slate-700 dark:text-slate-200">{content.lead}</p>

            <OutcomeTiles items={outcomeItems} />

            <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
              {content.body.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            <div
              className={cn(
                "mt-10 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white p-6 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.2)]",
                "dark:border-white/[0.1] dark:from-zinc-900/80 dark:to-zinc-950 dark:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)]",
              )}
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Ready when you are</p>
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">Start on pricing — we&apos;ll walk you through supplier connect if you want help.</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
                <Link
                  href={primaryHref}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-zinc-900 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_36px_-10px_rgba(15,23,42,0.4)] transition hover:bg-zinc-800 active:scale-[0.99] dark:bg-white dark:text-zinc-950 dark:shadow-[0_14px_36px_-10px_rgba(0,0,0,0.45)] dark:hover:bg-zinc-100 sm:flex-none sm:min-w-[220px]"
                >
                  Start 30-day free trial
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
                <Link
                  href={learnMoreHref}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-300/90 bg-white px-7 py-3.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 dark:border-white/[0.14] dark:bg-white/[0.05] dark:text-slate-100 dark:hover:bg-white/[0.09] sm:flex-none"
                >
                  <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">play_circle</span>
                  See how it works
                </Link>
              </div>
              <p className="mt-4 text-center text-[12px] leading-relaxed text-slate-500 sm:text-left dark:text-slate-500">
                Then <span className="font-semibold text-slate-700 dark:text-slate-300">£299/mo</span> per practice · cancel anytime · same trial as{" "}
                <Link href="/pricing" className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500 dark:text-slate-300">
                  dentago.co.uk/pricing
                </Link>
              </p>
            </div>
          </div>

          <div className="relative lg:sticky lg:top-24">
            <div className="pointer-events-none absolute -right-8 top-0 -z-10 hidden h-[min(100%,28rem)] w-[min(100%,28rem)] rounded-full bg-slate-300/20 blur-3xl dark:bg-white/[0.05] lg:block" aria-hidden />
            <p className="mb-3 hidden text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 lg:block dark:text-slate-500">
              What you&apos;ll see in Pro
            </p>
            <div className="lg:translate-y-0">
              <PreviewMock kind={content.preview} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
