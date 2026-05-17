"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  deriveCompoundingStats,
  useBdoStore,
} from "@/stores/bdo-store";
import type { LeverageCategory } from "@/lib/bdo/types";
import { cn } from "@/lib/utils";

const CATS: LeverageCategory[] = [
  "product",
  "sales",
  "distribution",
  "hiring",
  "relationships",
  "learning",
  "health",
  "capital",
  "brand",
  "systems",
];

export default function BdoCompoundingPage() {
  const compounding = useBdoStore((s) => s.compounding);
  const add = useBdoStore((s) => s.addCompoundingAction);
  const [cat, setCat] = useState<LeverageCategory>("product");
  const [desc, setDesc] = useState("");
  const [lev, setLev] = useState("");

  const { byCat, weakest, strongest, score } = deriveCompoundingStats(compounding);
  const max = Math.max(1, ...Object.values(byCat));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const d = desc.trim();
    if (!d) return;
    add(cat, d, lev.trim());
    setDesc("");
    setLev("");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Compounding Engine</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Log actions that still matter in five years — distribution wins, retained behavior changes, hires, relational
          trust, systemic leverage. This is deliberately not a streak machine.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Log compounding action
          </h3>
          <label className="space-y-1 block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Category</span>
            <select
              className="w-full max-w-xs rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)] sm:max-w-none"
              value={cat}
              onChange={(e) => setCat(e.target.value as LeverageCategory)}
            >
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Outcome</span>
            <textarea
              className="min-h-[72px] w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              placeholder="e.g. Signed supplier SLA addendum — eliminated 14% phantom stockouts in pilot cohort"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Leverage note (optional)
            </span>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              value={lev}
              onChange={(e) => setLev(e.target.value)}
              placeholder="Why this compounds — ownership, repeatability, downside protection…"
            />
          </label>
          <Button type="submit" className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90">
            Record
          </Button>
        </form>

        <aside className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Weekly signal
          </h3>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Compounding score</p>
            <p className="font-[family-name:var(--font-mono)] text-3xl text-[var(--primary)]">{score}</p>
          </div>
          <div className="space-y-1 text-[12px] text-[var(--muted-foreground)]">
            <p>
              <span className="text-[var(--foreground)]">Weakest area:</span> {weakest ?? "—"}
            </p>
            <p>
              <span className="text-[var(--foreground)]">Largest volume:</span> {strongest ?? "—"}
            </p>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            Score is a crude blend of volume + breadth — tune the heuristic once you have enough history.
          </p>
        </aside>
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Category heatmap (counts)
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CATS.map((c) => {
            const v = byCat[c];
            const intensity = v / max;
            return (
              <div
                key={c}
                className={cn("rounded-md border border-[var(--border)] px-3 py-3 text-[12px] capitalize ring-1 ring-white/[0.02]")}
                style={{
                  background: `color-mix(in oklab, var(--primary) ${Math.round(intensity * 55)}%, var(--card))`,
                }}
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{c}</p>
                <p className="mt-2 font-[family-name:var(--font-mono)] text-lg text-[var(--foreground)]">{v}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Ledger</h3>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {compounding.length === 0 ? (
            <li className="px-4 py-6 text-[13px] text-[var(--muted-foreground)]">No entries yet.</li>
          ) : (
            compounding.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[12px] font-medium capitalize text-[var(--foreground)]">{a.category}</p>
                  <p className="text-[13px] text-[var(--muted-foreground)]">{a.description}</p>
                  {a.leverageNote && <p className="mt-1 text-[12px] text-[var(--primary)]">{a.leverageNote}</p>}
                </div>
                <time className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted-foreground)]">
                  {new Date(a.loggedAt).toLocaleString()}
                </time>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
