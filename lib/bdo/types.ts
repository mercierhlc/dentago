export type GoalHorizon = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "decade";

export type LeverageCategory =
  | "product"
  | "sales"
  | "distribution"
  | "hiring"
  | "relationships"
  | "learning"
  | "health"
  | "capital"
  | "brand"
  | "systems";

export interface DashboardMetricSeed {
  id: string;
  label: string;
  unit: "usd" | "pct" | "count" | "months" | "hours" | "score";
}

export interface RoadmapNode {
  id: string;
  title: string;
  confidencePct: number;
  milestonePct?: number;
  assumptions: string[];
  blockers: string[];
  timelineNote: string;
  notes: string;
  metrics: string[];
  children?: RoadmapNode[];
}

export interface JournalEntry {
  id: string;
  createdAt: string;
  body: string;
  tags: string[];
  mood?: "clear" | "uncertain" | "stressed" | "focused";
}

export interface DecisionRecord {
  id: string;
  title: string;
  context: string;
  assumptions: string;
  expectedOutcome: string;
  confidencePct: number;
  actualResult: string;
  lessons: string;
  decidedAt: string;
}

export interface CompoundingAction {
  id: string;
  loggedAt: string;
  category: LeverageCategory;
  description: string;
  leverageNote: string;
}

export interface StrategicGoal {
  id: string;
  horizon: GoalHorizon;
  title: string;
  measurable: string;
  importance: number;
  leverage: number;
  dependencies: string[];
  linkedMetricIds: string[];
}

export interface NetworkContact {
  id: string;
  name: string;
  archetype:
    | "investor"
    | "mentor"
    | "founder"
    | "supplier"
    | "operator"
    | "clinic"
    | "other";
  strength: number;
  strategicWeight: number;
  lastInteraction: string;
  notes: string;
}

export interface LearningNode {
  id: string;
  title: string;
  kind: "book" | "insight" | "framework" | "market";
  summary: string;
  linksTo: string[];
}

export interface AcquisitionTarget {
  id: string;
  name: string;
  category: string;
  whyAcquire: string;
  watchMetrics: string[];
  timingNote: string;
}
