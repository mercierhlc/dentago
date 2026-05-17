import { ACQUISITION_CASES, ACQUISITION_TARGETS } from "@/lib/bdo/acquisition-seed";

export default function BdoAcquisitionPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Acquisition Playbook</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Model how Dentago becomes strategically unavoidable — not “exit dreams,” but buyer logic, timing risk, and the
          metrics that actually move acquisition premiums.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {ACQUISITION_TARGETS.map((t) => (
          <article
            key={t.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 ring-1 ring-white/[0.02]"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--primary)]">{t.category}</p>
            <h3 className="mt-2 text-sm font-semibold tracking-tight text-[var(--foreground)]">{t.name}</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted-foreground)]">{t.whyAcquire}</p>
            <div className="mt-4 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Watch metrics</p>
              <ul className="list-inside list-disc text-[12px] text-[var(--foreground)]">
                {t.watchMetrics.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
            <p className="mt-3 border-t border-[var(--border)] pt-3 text-[12px] text-[var(--muted-foreground)]">
              Timing: {t.timingNote}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Strategic danger (what acquirers fear missing)
        </h3>
        <ul className="mt-4 space-y-2 text-[13px] text-[var(--muted-foreground)]">
          <li>• Procurement graph captures repeat, high-friction baskets before anyone else indexes them.</li>
          <li>• Supplier SLA + pricing integrity becomes the trust layer clinics route through by default.</li>
          <li>• Density in a core geography compounds faster than subsidy-led national sprawl.</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Case study compression
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {ACQUISITION_CASES.map((c) => (
            <div key={c.deal} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-[12px] font-medium text-[var(--foreground)]">{c.deal}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted-foreground)]">{c.lesson}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
