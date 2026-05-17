"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useBdoStore } from "@/stores/bdo-store";
import { cn } from "@/lib/utils";

export default function BdoJournalPage() {
  const journal = useBdoStore((s) => s.journal);
  const add = useBdoStore((s) => s.addJournalEntry);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    add(
      body.trim(),
      tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    );
    setBody("");
    setTags("");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Founder Journal</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Decades-long narrative archive. Markdown-friendly. Prefer painful precision over eloquent coping.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[140px] w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 font-[family-name:var(--font-mono)] text-[13px] leading-relaxed text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          placeholder={"## Thesis fracture\nWhat changed? What stays true?"}
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)]"
          placeholder="tags: truth, fear, capitulation, breakout"
        />
        <Button type="submit" className="bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90">
          Commit entry
        </Button>
      </form>

      <div className="space-y-3">
        {journal.map((entry) => (
          <article
            key={entry.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 ring-1 ring-white/[0.02]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <time className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted-foreground)]">
                {new Date(entry.createdAt).toLocaleString()}
              </time>
              <div className="flex gap-1.5">
                {entry.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <pre
              className={cn(
                "mt-3 whitespace-pre-wrap font-[family-name:var(--font-mono)] text-[13px] leading-relaxed text-[var(--foreground)]",
              )}
            >
              {entry.body}
            </pre>
          </article>
        ))}
      </div>
    </div>
  );
}
