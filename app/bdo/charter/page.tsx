import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MRR_TARGETS,
  PARTNER_CHARTER_SECTIONS,
  PARTNER_ROLES_HEADLINE,
} from "@/lib/bdo/partner-charter";

export default function BdoPartnerCharterPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      <header className="space-y-3 border-b border-[var(--border)] pb-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-[var(--primary)]">
          Cursor master prompt · in-product reference
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
          Dentago · £1M MRR Operating System Charter
        </h1>
        <p className="text-[14px] font-medium leading-relaxed text-[var(--foreground)]">
          {PARTNER_ROLES_HEADLINE}
        </p>
        <p className="text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          A partner obsessed with getting Dentago to{" "}
          <span className="font-[family-name:var(--font-mono)] text-[var(--foreground)]">
            £1M MRR in twelve months as a directional target
          </span>
          — with eyes open that it is extraordinarily aggressive (see maths below).
        </p>
        <Link
          href="/bdo/settings"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-2 border-[var(--border)] text-[var(--foreground)]",
          )}
        >
          Settings · persistence & Supabase
        </Link>
      </header>

      <aside className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-5 ring-1 ring-white/[0.03]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          {MRR_TARGETS.headline}
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          At <span className="font-[family-name:var(--font-mono)] text-[var(--foreground)]">
            £{MRR_TARGETS.pricePerSiteGbpPerMonth}/site/month
          </span>
          , you&apos;d need on the order of{" "}
          <span className="font-[family-name:var(--font-mono)] text-[var(--foreground)]">
            {MRR_TARGETS.impliedPayingSites.toLocaleString("en-GB")}
          </span>{" "}
          paying sites. That is far beyond build cool product: it implies sales velocity, onboarding, retention,
          suppliers, support, reliability, and organisational execution. Most founders underweight distribution —
          still useful as directional intensity.
        </p>
      </aside>

      <div className="space-y-10">
        {PARTNER_CHARTER_SECTIONS.map((section) => (
          <section key={section.id} className="scroll-mt-24" id={section.id}>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              {section.title}
            </h2>
            {section.body && section.body.length > 0 && (
              <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-[var(--muted-foreground)]">
                {section.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
            {section.bullets && section.bullets.length > 0 && (
              <ul
                className={cn(
                  (section.body?.length ?? 0) > 0 ? "mt-4" : "mt-3",
                  "space-y-2 text-[13px] text-[var(--muted-foreground)]",
                )}
              >
                {section.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--primary)] opacity-70" aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <footer className="border-t border-[var(--border)] pt-8 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
        Paste the full verbatim prompt into Cursor project rules if you want the agent to carry this persona on every tab;
        this page is your single in-app canonical copy for the Billion Dollar OS.
      </footer>
    </div>
  );
}
