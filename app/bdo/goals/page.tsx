"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { GoalHorizon } from "@/lib/bdo/types";
import { useBdoStore } from "@/stores/bdo-store";

const HORIZONS: GoalHorizon[] = ["daily", "weekly", "monthly", "quarterly", "yearly", "decade"];

export default function BdoGoalsPage() {
  const goals = useBdoStore((s) => s.goals);
  const addGoal = useBdoStore((s) => s.addGoal);

  const [horizon, setHorizon] = useState<GoalHorizon>("quarterly");
  const [title, setTitle] = useState("");
  const [measurable, setMeasurable] = useState("");
  const [importance, setImportance] = useState(8);
  const [leverage, setLeverage] = useState(8);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !measurable.trim()) return;
    addGoal({
      horizon,
      title: title.trim(),
      measurable: measurable.trim(),
      importance,
      leverage,
      dependencies: [],
      linkedMetricIds: [],
    });
    setTitle("");
    setMeasurable("");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Strategic Goals</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Mission objectives across time horizons — measurable, dependency-aware, explicitly weighted for leverage. Not a
          todo list.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Define objective
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Horizon</span>
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as GoalHorizon)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)]"
            >
              {HORIZONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)]"
              placeholder="Strategic outcome, not activity"
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Measurable outcome
          </span>
          <textarea
            value={measurable}
            onChange={(e) => setMeasurable(e.target.value)}
            className="min-h-[64px] w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)]"
            placeholder="Pass/fail or numeric definition you cannot weasel out of"
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Importance 1–10</span>
            <input
              type="number"
              min={1}
              max={10}
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 font-[family-name:var(--font-mono)] text-[13px]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Leverage 1–10</span>
            <input
              type="number"
              min={1}
              max={10}
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 font-[family-name:var(--font-mono)] text-[13px]"
            />
          </label>
        </div>
        <Button type="submit" className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90">
          Add mission objective
        </Button>
      </form>

      <div className="space-y-3">
        {goals.map((g) => (
          <article
            key={g.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 ring-1 ring-white/[0.02]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                {g.horizon}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted-foreground)]">
                I {g.importance} · L {g.leverage}
              </span>
            </div>
            <h3 className="mt-2 text-sm font-semibold tracking-tight text-[var(--foreground)]">{g.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted-foreground)]">{g.measurable}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
