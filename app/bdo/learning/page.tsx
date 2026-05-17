"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { LearningNode } from "@/lib/bdo/types";
import { useBdoStore } from "@/stores/bdo-store";

export default function BdoLearningPage() {
  const learning = useBdoStore((s) => s.learning);
  const add = useBdoStore((s) => s.addLearning);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<LearningNode["kind"]>("insight");
  const [summary, setSummary] = useState("");
  const [links, setLinks] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    add({
      title: title.trim(),
      kind,
      summary: summary.trim(),
      linksTo: links
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setTitle("");
    setSummary("");
    setLinks("");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Learning System</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Mental models, procurement-specific insight, founder scar tissue. Link notes to build an explicit knowledge graph
          — this is scaffolding until graph visualization ships.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <input className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px]" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select value={kind} onChange={(e) => setKind(e.target.value as LearningNode["kind"])} className="w-full max-w-xs rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px]">
          <option value="book">book</option>
          <option value="insight">insight</option>
          <option value="framework">framework</option>
          <option value="market">market</option>
        </select>
        <textarea className="min-h-[80px] w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px]" placeholder="Compressed summary — one screen max" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <input className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 font-[family-name:var(--font-mono)] text-[13px]" placeholder="Link to titles (comma-separated)" value={links} onChange={(e) => setLinks(e.target.value)} />
        <Button type="submit" className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90">
          Capture
        </Button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {learning.length === 0 ? (
          <p className="text-[13px] text-[var(--muted-foreground)]">No captured nodes.</p>
        ) : (
          learning.map((n) => (
            <article key={n.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">{n.kind}</p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">{n.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted-foreground)]">{n.summary}</p>
              {n.linksTo.length > 0 && (
                <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">
                  <span className="uppercase tracking-[0.14em]">Links</span> · {n.linksTo.join(" → ")}
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
