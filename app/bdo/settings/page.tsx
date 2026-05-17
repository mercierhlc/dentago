"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useBdoStore } from "@/stores/bdo-store";

export default function BdoSettingsPage() {
  const reset = useBdoStore((s) => s.resetStrategicData);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Settings</h2>
        <p className="text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          State persists in-browser via LocalStorage (<span className="font-[family-name:var(--font-mono)]">dentago-billion-dollar-os</span>).
          Connect Supabase for auth-scoped backups and encrypted journal fields when you&apos;re ready — schema stub lives in{" "}
          <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[11px]">supabase/migrations/</code>.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Danger zone
        </h3>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Reset reloads illustrative defaults across metrics, roadmap, journal seed, decisions, contacts, learning, etc.
          Export persistence JSON first if you care about entries.
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => {
            if (typeof window !== "undefined" && window.confirm("Reset all Billion Dollar OS local state to defaults?")) {
              reset();
            }
          }}
        >
          Reset strategic data
        </Button>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Operational links
        </h3>
        <ul className="mt-3 space-y-2 text-[13px]">
          <li>
            <Link href="/bdo/charter" className="text-[var(--primary)] hover:underline">
              £1M MRR charter · partner execution prompt (in-product)
            </Link>
          </li>
          <li>
            <Link href="/os" className="text-[var(--primary)] hover:underline">
              Dentago OS dashboard
            </Link>{" "}
            · company operating layer
          </li>
          <li>
            <Link href="/" className="text-[var(--primary)] hover:underline">
              Marketing site
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
