"use client";

import { RoadmapTreePanel } from "@/components/bdo/roadmap-tree-panel";

export default function BdoRoadmapPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Billion Dollar Roadmap</h2>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          Work backwards from the outcome that matters. Confidence and milestone coverage are hypotheses — revise them when
          evidence changes. This graph is editable; assumptions and blockers should hurt to write.
        </p>
      </header>
      <RoadmapTreePanel />
    </div>
  );
}
