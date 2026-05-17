import type { AcquisitionTarget } from "./types";

export const ACQUISITION_TARGETS: AcquisitionTarget[] = [
  {
    id: "henry-schein",
    name: "Henry Schein",
    category: "Strategic distributor / platform adjacency",
    whyAcquire:
      "Own the digital procurement layer that routes demand before it hits legacy ERP workflows — defensive against disintermediation.",
    watchMetrics: ["Attach rate on high-mix SKUs", "Clinic switching costs", "Supplier SLA depth"],
    timingNote: "Most acute when digital share-of-wallet crosses a perceived threat band in core markets.",
  },
  {
    id: "patterson",
    name: "Patterson Dental",
    category: "Strategic distributor",
    whyAcquire: "Consolidate category demand intelligence + reduce price discovery leakage across regions.",
    watchMetrics: ["Regional GMV density", "Procurement frequency", "Multi-site rollups"],
    timingNote: "Often follows proof of habitual basket behavior, not early ARR noise.",
  },
  {
    id: "rollup",
    name: "Dental procurement roll-ups",
    category: "Financial / strategic buyers",
    whyAcquire: "Bundle procurement infrastructure to compress COGS and accelerate clinic roll-up economics.",
    watchMetrics: ["Net revenue retention", "Supplier rebate economics", "Ops leverage per $ GMV"],
    timingNote: "PE will pay for predictable cash conversion — not for experimental UX.",
  },
  {
    id: "infra",
    name: "Healthcare infrastructure buyers",
    category: "Vertical SaaS / payments / data platforms",
    whyAcquire: "Embed purchasing graph into broader practice operations stack — widen TAM inside workflow.",
    watchMetrics: ["API reliability", "Data graph richness", "Cross-sell surface area"],
    timingNote: "Requires technical credibility and ruthless uptime storytelling.",
  },
];

export const ACQUISITION_CASES = [
  {
    deal: "Visa / Plaid (aborted) — infra adjacency",
    lesson: "Regulatory posture can crater strategic premium overnight; diversify buyer theses.",
  },
  {
    deal: "Adyen — payments depth",
    lesson: "Strategic acquirers pay for deterministic unit economics at scale — not novelty.",
  },
  {
    deal: "Vertical SaaS rollups (various MSPs)",
    lesson: "Recurring gross margin + expansion NRR outperform hero ARR multiples.",
  },
] as const;
