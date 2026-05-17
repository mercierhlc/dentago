import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Placeholder for signed-off strategic artifacts — link from journal entries with tag `archived` for now */
export default function BdoArchivePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Archive</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Cold storage for retired theses, board decks, and post-mortems. Today this is intentionally empty — classify
          journal entries with an <span className="font-[family-name:var(--font-mono)]">archived</span> tag until file
          upload ships.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <Link href="/bdo/journal" className={cn(buttonVariants({ variant: "outline" }), "border-[var(--border)]")}>
          Go to Founder Journal
        </Link>
        <Link href="/bdo/decisions" className={cn(buttonVariants({ variant: "outline" }), "border-[var(--border)]")}>
          Decision Log
        </Link>
      </div>
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-8 text-center">
        <p className="text-[13px] text-[var(--muted-foreground)]">No archival documents indexed.</p>
      </div>
    </div>
  );
}
