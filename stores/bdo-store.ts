"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_ROADMAP } from "@/lib/bdo/default-roadmap";
import type {
  CompoundingAction,
  DecisionRecord,
  JournalEntry,
  LearningNode,
  LeverageCategory,
  NetworkContact,
  RoadmapNode,
  StrategicGoal,
} from "@/lib/bdo/types";

/** Small synthetic history for sparklines — replace with real pulls over time. */
export function syntheticSeries(base: number, jitter = 0.06, len = 18): number[] {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    const step = 1 + (Math.random() - 0.49) * jitter;
    v *= step;
    out.push(Math.round(v));
  }
  return out;
}

export type MetricSeriesKey =
  | "estimatedNetWorth"
  | "dentagoValuation"
  | "ownershipPct"
  | "arr"
  | "gmv"
  | "activeClinics"
  | "payingClinics"
  | "monthlyBurn"
  | "runwayMonths"
  | "suppliersIntegrated"
  | "retentionPct"
  | "deepWorkHoursWeek"
  | "sleepScore"
  | "trainingConsistencyPct"
  | "strategicAlignmentScore";

export interface MetricPoint {
  label: string;
  value: number;
  previous: number;
  series: number[];
  format: "usd" | "usd_short" | "pct" | "count" | "months" | "hours" | "score";
}

export const METRIC_DEFINITIONS: Record<
  MetricSeriesKey,
  Omit<MetricPoint, "value" | "previous" | "series">
> = {
  estimatedNetWorth: {
    label: "Estimated net worth",
    format: "usd",
  },
  dentagoValuation: {
    label: "Estimated Dentago valuation",
    format: "usd_short",
  },
  ownershipPct: {
    label: "Ownership",
    format: "pct",
  },
  arr: {
    label: "ARR",
    format: "usd_short",
  },
  gmv: {
    label: "GMV",
    format: "usd_short",
  },
  activeClinics: {
    label: "Active clinics",
    format: "count",
  },
  payingClinics: {
    label: "Paying clinics",
    format: "count",
  },
  monthlyBurn: {
    label: "Monthly burn",
    format: "usd_short",
  },
  runwayMonths: {
    label: "Runway remaining",
    format: "months",
  },
  suppliersIntegrated: {
    label: "Suppliers integrated",
    format: "count",
  },
  retentionPct: {
    label: "Retention",
    format: "pct",
  },
  deepWorkHoursWeek: {
    label: "Deep work (this week)",
    format: "hours",
  },
  sleepScore: {
    label: "Sleep score",
    format: "score",
  },
  trainingConsistencyPct: {
    label: "Training consistency",
    format: "pct",
  },
  strategicAlignmentScore: {
    label: "Strategic alignment score",
    format: "score",
  },
};

export interface HonestMetric {
  key: string;
  label: string;
  value: number;
  warning: "ok" | "watch" | "critical";
  invertGood?: boolean;
}

interface BdoState {
  /** Command center */
  metrics: Record<MetricSeriesKey, Omit<MetricPoint, "label" | "format">>;
  roadmap: RoadmapNode;
  journal: JournalEntry[];
  decisions: DecisionRecord[];
  compounding: CompoundingAction[];
  goals: StrategicGoal[];
  contacts: NetworkContact[];
  learning: LearningNode[];
  honest: HonestMetric[];

  setMetricValue: (key: MetricSeriesKey, value: number) => void;
  updateRoadmapNode: (
    id: string,
    patch: Partial<Pick<RoadmapNode, "notes" | "blockers" | "assumptions" | "confidencePct">>,
  ) => void;
  addJournalEntry: (body: string, tags?: string[], mood?: JournalEntry["mood"]) => void;
  addDecision: (d: Omit<DecisionRecord, "id">) => void;
  addCompoundingAction: (category: LeverageCategory, description: string, leverageNote?: string) => void;
  addGoal: (goal: Omit<StrategicGoal, "id">) => void;
  addContact: (c: Omit<NetworkContact, "id">) => void;
  addLearning: (l: Omit<LearningNode, "id">) => void;
  patchHonestMetric: (key: string, value: number) => void;
  resetStrategicData: () => void;
}

function initMetrics(): Record<MetricSeriesKey, Omit<MetricPoint, "label" | "format">> {
  const m = {
    estimatedNetWorth: { value: 2_400_000, previous: 2_050_000 },
    dentagoValuation: { value: 18_500_000, previous: 14_200_000 },
    ownershipPct: { value: 34, previous: 34 },
    arr: { value: 1_200_000, previous: 980_000 },
    gmv: { value: 4_800_000, previous: 4_100_000 },
    activeClinics: { value: 52, previous: 44 },
    payingClinics: { value: 41, previous: 36 },
    monthlyBurn: { value: 185_000, previous: 192_000 },
    runwayMonths: { value: 21, previous: 18 },
    suppliersIntegrated: { value: 47, previous: 43 },
    retentionPct: { value: 91, previous: 89 },
    deepWorkHoursWeek: { value: 26, previous: 31 },
    sleepScore: { value: 72, previous: 76 },
    trainingConsistencyPct: { value: 78, previous: 71 },
    strategicAlignmentScore: { value: 6.8, previous: 6.2 },
  };

  const out = {} as Record<MetricSeriesKey, Omit<MetricPoint, "label" | "format">>;
  (Object.keys(m) as MetricSeriesKey[]).forEach((key) => {
    const row = m[key];
    const jitter = key === "monthlyBurn" ? 0.04 : key === "runwayMonths" ? 0.03 : 0.05;
    out[key] = {
      ...row,
      series:
        key === "strategicAlignmentScore"
          ? Array.from({ length: 20 }, (_, i) =>
              Number((row.value + (i - 10) * 0.035).toFixed(2)),
            )
          : syntheticSeries(row.value, jitter, 20),
    };
  });

  return out;
}

function cloneRoadmap(): RoadmapNode {
  return JSON.parse(JSON.stringify(DEFAULT_ROADMAP)) as RoadmapNode;
}

function mutateRoadmap(root: RoadmapNode, id: string, patch: Partial<RoadmapNode>): RoadmapNode {
  if (root.id === id) return { ...root, ...patch };
  if (!root.children?.length) return root;
  return {
    ...root,
    children: root.children.map((c) => mutateRoadmap(c, id, patch)),
  };
}

const initialHonest: HonestMetric[] = [
  {
    key: "real_revenue_mrr",
    label: "Recognized net revenue (MRR)",
    value: 98000,
    warning: "watch",
  },
  { key: "fundraising_pipe", label: "Probability-weighted pipeline $", value: 420000, warning: "ok" },
  {
    key: "failed_outreach",
    label: "Ignored / dead outreach (rolling 30d)",
    value: 128,
    warning: "watch",
    invertGood: true,
  },
  {
    key: "sleep_h",
    label: "Avg sleep hours (7d)",
    value: 6.1,
    warning: "critical",
    invertGood: true,
  },
];

const initialJournal: JournalEntry[] = [
  {
    id: "seed-j1",
    createdAt: new Date().toISOString(),
    tags: ["truth", "risk"],
    mood: "focused",
    body:
      "Reminder: the only scoreboard that compounds is **retained economic behavior**, not pitch momentum or vanity pipeline.",
  },
];

const initialGoals: StrategicGoal[] = [
  {
    id: "g1",
    horizon: "quarterly",
    title: "Establish non-negotiable reorder curve in UK core cohort",
    measurable: "D14 reorder ≥ X% in top decile clinics (define X from baseline)",
    importance: 9,
    leverage: 10,
    dependencies: ["Supplier SLA dashboard live", "Pricing drift alerts"],
    linkedMetricIds: [],
  },
  {
    id: "g2",
    horizon: "yearly",
    title: "Earn strategic indispensability in procurement graph",
    measurable: "≥70% of clinic spend on covered SKUs routes through platform where contracted",
    importance: 10,
    leverage: 9,
    dependencies: ["SKU coverage expansion", "Checkout reliability 99.9% perceived"],
    linkedMetricIds: [],
  },
];

export const useBdoStore = create<BdoState>()(
  persist(
    (set) => ({
      metrics: initMetrics(),
      roadmap: cloneRoadmap(),
      journal: initialJournal,
      decisions: [],
      compounding: [],
      goals: initialGoals,
      contacts: [],
      learning: [],
      honest: initialHonest,

      setMetricValue: (key, value) =>
        set((s) => ({
          metrics: {
            ...s.metrics,
            [key]: {
              ...s.metrics[key],
              value,
              series: [...s.metrics[key].series.slice(1), value],
            },
          },
        })),

      updateRoadmapNode: (id, patch) =>
        set((s) => ({
          roadmap: mutateRoadmap(s.roadmap, id, patch),
        })),

      addJournalEntry: (body, tags = [], mood) =>
        set((s) => ({
          journal: [
            {
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              body,
              tags,
              mood,
            },
            ...s.journal,
          ],
        })),

      addDecision: (d) =>
        set((s) => ({
          decisions: [{ ...d, id: crypto.randomUUID() }, ...s.decisions],
        })),

      addCompoundingAction: (category, description, leverageNote = "") =>
        set((s) => ({
          compounding: [
            {
              id: crypto.randomUUID(),
              loggedAt: new Date().toISOString(),
              category,
              description,
              leverageNote,
            },
            ...s.compounding,
          ],
        })),

      addGoal: (goal) =>
        set((s) => ({
          goals: [...s.goals, { ...goal, id: crypto.randomUUID() }],
        })),

      addContact: (c) =>
        set((s) => ({
          contacts: [...s.contacts, { ...c, id: crypto.randomUUID() }],
        })),

      addLearning: (l) =>
        set((s) => ({
          learning: [...s.learning, { ...l, id: crypto.randomUUID() }],
        })),

      patchHonestMetric: (key, value) =>
        set((s) => ({
          honest: s.honest.map((h) => (h.key === key ? { ...h, value } : h)),
        })),

      resetStrategicData: () =>
        set({
          metrics: initMetrics(),
          roadmap: cloneRoadmap(),
          journal: initialJournal,
          decisions: [],
          compounding: [],
          goals: initialGoals,
          contacts: [],
          learning: [],
          honest: initialHonest,
        }),
    }),
    {
      name: "dentago-billion-dollar-os",
      partialize: (s) => ({
        metrics: s.metrics,
        roadmap: s.roadmap,
        journal: s.journal,
        decisions: s.decisions,
        compounding: s.compounding,
        goals: s.goals,
        contacts: s.contacts,
        learning: s.learning,
        honest: s.honest,
      }),
    },
  ),
);

export function deriveCompoundingStats(actions: CompoundingAction[]) {
  const byCat: Record<LeverageCategory, number> = {
    product: 0,
    sales: 0,
    distribution: 0,
    hiring: 0,
    relationships: 0,
    learning: 0,
    health: 0,
    capital: 0,
    brand: 0,
    systems: 0,
  };
  actions.forEach((a) => {
    byCat[a.category] += 1;
  });
  const counts = Object.entries(byCat).sort((a, b) => a[1] - b[1]);
  const weakest = counts[0]?.[0] as LeverageCategory | undefined;
  const strongest = counts[counts.length - 1]?.[0] as LeverageCategory | undefined;
  /** Simple heuristic score: volume + breadth bonus */
  const breadth = Object.values(byCat).filter((n) => n > 0).length;
  const score = Math.min(100, Math.round((actions.length / 4) * 10 + breadth * 6));
  return { byCat, weakest, strongest, score };
}
