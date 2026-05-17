"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useBdoStore } from "@/stores/bdo-store";

export default function BdoDecisionsPage() {
  const decisions = useBdoStore((s) => s.decisions);
  const add = useBdoStore((s) => s.addDecision);
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [expected, setExpected] = useState("");
  const [confidence, setConfidence] = useState(60);
  const [actual, setActual] = useState("");
  const [lessons, setLessons] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    add({
      title: title.trim(),
      context: context.trim(),
      assumptions: assumptions.trim(),
      expectedOutcome: expected.trim(),
      confidencePct: confidence,
      actualResult: actual.trim(),
      lessons: lessons.trim(),
      decidedAt: new Date().toISOString(),
    });
    setTitle("");
    setContext("");
    setAssumptions("");
    setExpected("");
    setActual("");
    setLessons("");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Decision Log</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Strategic decisions compound when closed-loop learning is enforced. Confidence without posterior review is
          cosplay.
        </p>
      </header>

      <form onSubmit={submit} className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <input
          className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)]"
          placeholder="Decision title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea className="min-h-[64px] rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px]" placeholder="Context" value={context} onChange={(e) => setContext(e.target.value)} />
        <textarea className="min-h-[52px] rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px]" placeholder="Assumptions" value={assumptions} onChange={(e) => setAssumptions(e.target.value)} />
        <textarea className="min-h-[52px] rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px]" placeholder="Expected outcome" value={expected} onChange={(e) => setExpected(e.target.value)} />
        <label className="flex items-center gap-3 text-[12px] text-[var(--muted-foreground)]">
          Confidence
          <input type="range" min={10} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
          <span className="font-[family-name:var(--font-mono)]">{confidence}%</span>
        </label>
        <textarea className="min-h-[48px] rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px]" placeholder="Actual result (fill later)" value={actual} onChange={(e) => setActual(e.target.value)} />
        <textarea className="min-h-[48px] rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px]" placeholder="Lessons" value={lessons} onChange={(e) => setLessons(e.target.value)} />
        <Button type="submit" className="justify-self-start bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90">
          Record decision
        </Button>
      </form>

      <div className="space-y-3">
        {decisions.map((d) => (
          <article key={d.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">{d.title}</h3>
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted-foreground)]">
                conf {d.confidencePct}% · {new Date(d.decidedAt).toLocaleDateString()}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-[13px] text-[var(--muted-foreground)] sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em]">Context</dt>
                <dd className="mt-1 text-[var(--foreground)]">{d.context || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em]">Assumptions</dt>
                <dd className="mt-1 text-[var(--foreground)]">{d.assumptions || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.16em]">Expected</dt>
                <dd className="mt-1 text-[var(--foreground)]">{d.expectedOutcome || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.16em]">Actual result</dt>
                <dd className="mt-1 text-[var(--foreground)]">{d.actualResult || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-[0.16em]">Lessons</dt>
                <dd className="mt-1 text-[var(--foreground)]">{d.lessons || "—"}</dd>
              </div>
            </dl>
          </article>
        ))}
        {decisions.length === 0 && (
          <p className="text-[13px] text-[var(--muted-foreground)]">No logged decisions.</p>
        )}
      </div>
    </div>
  );
}
