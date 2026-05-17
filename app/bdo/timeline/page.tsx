const PHASES = [
  { age: "18–24", label: "Apprenticeship", note: "Skill stack, taste, survival. Low optionality, high learning rate." },
  { age: "25–34", label: "Company inception → PMF pressure", note: "Brutal clarity period. Optimize for truth-per-week, not prestige." },
  { age: "35–44", label: "Scale + systems", note: "Institutionalize what worked; delete heroics. Capital structure matters." },
  { age: "45–54", label: "Category power", note: "Moat depth, M&A optionality, political capital in market." },
  { age: "55+", label: "Capital allocation + legacy", note: "Risk reduction, generational transfer, intellectual honesty." },
] as const;

export default function BdoTimelinePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Life Timeline</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Decade thinking only works when mapped to physical time. Calibrate phases; they are not prophecies — they are
          sequencing constraints.
        </p>
      </header>

      <div className="relative border-l border-[var(--border)] pl-8">
        {PHASES.map((p, i) => (
          <article key={p.label} className="relative mb-10 last:mb-0">
            <span className="absolute -left-[33px] top-1 flex size-4 items-center justify-center rounded-full border border-[var(--primary)] bg-[var(--card)] shadow-[0_0_12px_rgba(91,156,255,0.35)]" />
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--primary)]">{p.age}</p>
            <h3 className="mt-1 text-sm font-semibold tracking-tight text-[var(--foreground)]">{p.label}</h3>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">{p.note}</p>
            {i < PHASES.length - 1 && <div className="mt-6 h-px w-full bg-[var(--border)] opacity-70" />}
          </article>
        ))}
      </div>

      <section className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Annotate privately
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Family, health, and legacy arcs belong here when you&apos;re ready — keep them out of dashboards that operators
          see. Extend this module with encrypted fields when you wire Supabase.
        </p>
      </section>
    </div>
  );
}
