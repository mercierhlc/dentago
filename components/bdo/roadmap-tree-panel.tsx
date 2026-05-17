"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { RoadmapNode } from "@/lib/bdo/types";
import { cn } from "@/lib/utils";
import { useBdoStore } from "@/stores/bdo-store";
import { Button } from "@/components/ui/button";
import { formatPct } from "@/lib/bdo/format";

function collectIds(node: RoadmapNode, depthLimit = 4): string[] {
  const ids = [node.id];
  if ((node.children?.length ?? 0) > 0 && depthLimit > 0) {
    node.children!.forEach((c) => {
      ids.push(...collectIds(c, depthLimit - 1));
    });
  }
  return ids;
}

function RoadmapBranch({
  node,
  depth,
  expanded,
  toggle,
  selectedId,
  onSelect,
}: {
  node: RoadmapNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const hasKids = !!(node.children && node.children.length > 0);
  const open = expanded.has(node.id);

  return (
    <div className={cn(depth > 0 && "border-l border-[var(--border)] pl-3")}>
      <div className="flex items-start gap-1">
        {hasKids ? (
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className="mt-0.5 rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            aria-expanded={open}
          >
            {open ? <ChevronDown className="size-4" strokeWidth={1.5} /> : <ChevronRight className="size-4" strokeWidth={1.5} />}
          </button>
        ) : (
          <span className="inline-block w-5" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug transition-colors",
            selectedId === node.id
              ? "bg-[var(--sidebar-accent)] text-[var(--foreground)] ring-1 ring-[var(--border)]"
              : "text-[var(--foreground)] hover:bg-[var(--muted)]/80",
          )}
        >
          <span className="block font-medium tracking-tight">{node.title}</span>
          <span className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            <span>Conf {formatPct(node.confidencePct, 0)}</span>
            {node.milestonePct != null && <span>Mile {formatPct(node.milestonePct, 0)}</span>}
          </span>
        </button>
      </div>
      {hasKids && open && (
        <div className="mt-1 space-y-1">
          {node.children!.map((c) => (
            <RoadmapBranch
              key={c.id}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function findNode(root: RoadmapNode, id: string): RoadmapNode | null {
  if (root.id === id) return root;
  if (!root.children) return null;
  for (const c of root.children) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
}

export function RoadmapTreePanel() {
  const roadmap = useBdoStore((s) => s.roadmap);
  const updateRoadmapNode = useBdoStore((s) => s.updateRoadmapNode);

  const defaultExpanded = useMemo(() => new Set(collectIds(roadmap, 5)), [roadmap]);
  const [expanded, setExpanded] = useState<Set<string>>(defaultExpanded);
  const [selectedId, setSelectedId] = useState<string | null>(roadmap.id);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selected = selectedId ? findNode(roadmap, selectedId) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Dependency graph (backwards from outcome)
        </p>
        <RoadmapBranch
          node={roadmap}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        {selected ? (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Selected node</p>
              <h3 className="mt-1 text-sm font-semibold tracking-tight text-[var(--foreground)]">{selected.title}</h3>
              <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">{selected.timelineNote}</p>
            </div>

            <label className="block space-y-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Notes</span>
              <textarea
                className="min-h-[88px] w-full resize-y rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none ring-[var(--ring)] focus-visible:ring-2"
                value={selected.notes}
                onChange={(e) => updateRoadmapNode(selected.id, { notes: e.target.value })}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Blockers (one per line)</span>
              <textarea
                className="min-h-[72px] w-full resize-y rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                value={selected.blockers.join("\n")}
                onChange={(e) =>
                  updateRoadmapNode(selected.id, {
                    blockers: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Assumptions (one per line)</span>
              <textarea
                className="min-h-[72px] w-full resize-y rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                value={selected.assumptions.join("\n")}
                onChange={(e) =>
                  updateRoadmapNode(selected.id, {
                    assumptions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Confidence %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[13px] font-[family-name:var(--font-mono)] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  value={selected.confidencePct}
                  onChange={(e) =>
                    updateRoadmapNode(selected.id, { confidencePct: Number(e.target.value) || 0 })
                  }
                />
              </label>
            </div>

            {selected.metrics.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Linked metrics</p>
                <ul className="mt-2 list-inside list-disc text-[12px] text-[var(--muted-foreground)]">
                  {selected.metrics.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-[13px] text-[var(--muted-foreground)]">Select a node.</p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-[var(--border)]"
          onClick={() => setExpanded(new Set(collectIds(roadmap, 8)))}
        >
          Expand all near-term nodes
        </Button>
      </div>
    </div>
  );
}
