/**
 * In-app Pro upsell (`/upgrade`) — copy + deep-link to Platform feature sections.
 * Keys match `?f=` query values from sidebar, dashboard, and onboarding.
 */
export type ProUpgradeFeatureId =
  | "inventory"
  | "savings"
  | "approvals"
  | "analytics"
  | "predictive-par"
  | "stock-tracking"
  | "auto-reorder"
  | "approval-queue"
  | "budget-ceiling"
  | "spend-analytics"
  | "ai-assistant"
  | "consolidated-invoice"
  | "procurement-hub"
  | "smart-order-gen"
  | "default";

export type ProUpgradeOutcome = {
  /** Material Symbols ligature name */
  icon: string;
  title: string;
  body: string;
};

export type ProUpgradeContent = {
  id: ProUpgradeFeatureId;
  kicker: string;
  headline: string;
  /** Supporting line under headline (value-first). */
  lead: string;
  /** 2–3 short paragraphs; plain text, newlines become breaks in UI. */
  body: string;
  /** Three human outcomes — mirrors `/platform` feature story, shown above the fold. */
  outcomes?: ProUpgradeOutcome[];
  learnMoreHash: string;
  /** Which mock to show in the preview column */
  preview: "inventory" | "savings" | "approvals" | "analytics" | "ai" | "hub" | "generic";
};

const ALIASES: Record<string, ProUpgradeFeatureId> = {
  inventory: "inventory",
  par: "inventory",
  "par-levels": "inventory",
  savings: "savings",
  approvals: "approvals",
  analytics: "analytics",
  "predictive-par": "predictive-par",
  "stock-tracking": "stock-tracking",
  "auto-reorder": "auto-reorder",
  "approval-queue": "approval-queue",
  "budget-ceiling": "budget-ceiling",
  "spend-analytics": "spend-analytics",
  "ai-assistant": "ai-assistant",
  "consolidated-invoice": "consolidated-invoice",
  "procurement-hub": "procurement-hub",
  "smart-order-gen": "smart-order-gen",
  pro: "default",
  upgrade: "default",
};

export const CONTENT: Record<ProUpgradeFeatureId, ProUpgradeContent> = {
  inventory: {
    id: "inventory",
    kicker: "Stock · Dentago Pro",
    headline: "Never run out mid-procedure.",
    lead: "Pro tracks burn rate, expiry, par, and lot — then quietly drafts the next reorder before you hit zero. The nurse-WhatsApp scramble disappears.",
    outcomes: [
      {
        icon: "schedule",
        title: "Days before you hit zero",
        body: "Alerts from real ordering and treatment pace — with the cheapest reorder pre-staged in your cart, not a panic single.",
      },
      {
        icon: "inventory_2",
        title: "Shelf truth across sites",
        body: "Every item, every lot — expiry warnings and recall-ready lookups when a notice lands.",
      },
      {
        icon: "task_alt",
        title: "Drafts that respect your rules",
        body: "When stock hits par, Dentago drafts at today’s best price and parks it for a quick approve — automation without blind ordering.",
      },
    ],
    body:
      "Same story as Stock on our platform page: one operating layer that learns your clinic’s pace instead of static min/max from last year.\n\nTry it properly for 30 days — connect suppliers, import stock, and see the alerts on your own SKUs before you pay.",
    learnMoreHash: "stock-tracking",
    preview: "inventory",
  },
  "predictive-par": {
    id: "predictive-par",
    kicker: "Predictive par · Dentago Pro",
    headline: "Know four days before you run out.",
    lead: "Dentago learns each clinic’s burn rate from real ordering and treatment volume — then alerts your manager while there’s still time to reorder calmly.",
    outcomes: [
      {
        icon: "trending_up",
        title: "Pace that matches your chairs",
        body: "Not a spreadsheet rule from 2019 — thresholds move with how you actually practice.",
      },
      {
        icon: "shopping_cart",
        title: "Cart already lined up",
        body: "Cheapest reorder path pre-staged so you’re not price-shopping under pressure.",
      },
      {
        icon: "notifications_active",
        title: "Heads-up, not fire drill",
        body: "Replace the group chat “we’re out of gloves” ping with one trusted view.",
      },
    ],
    body:
      "That’s the same predictive par story we show under Stock on the platform — alerts you can act on during the week, not at 8am Monday.\n\n30-day trial: prove it on your own catalogue before you commit.",
    learnMoreHash: "predictive-par",
    preview: "inventory",
  },
  "stock-tracking": {
    id: "stock-tracking",
    kicker: "Stock + expiry · Dentago Pro",
    headline: "Every item, every site, every lot.",
    lead: "Expiry alerts and lot recall traceability — without the cupboard audit nobody has time for.",
    outcomes: [
      {
        icon: "qr_code_2",
        title: "Traceability when it matters",
        body: "Search a lot, see where it went, move fast if a recall hits — built for how UK clinics are audited.",
      },
      {
        icon: "calendar_month",
        title: "Expiry before waste",
        body: "Surface what expires in the next 30 days so you use stock instead of binning it.",
      },
      {
        icon: "hub",
        title: "One source of truth",
        body: "Multi-site visibility so principals and managers see the same numbers.",
      },
    ],
    body:
      "Platform Stock covers tracking alongside par and auto-reorder — it’s the full stack, not a bolt-on report.\n\nUse the 30-day trial to load your real SKUs and see expiry + par in one place.",
    learnMoreHash: "stock-tracking",
    preview: "inventory",
  },
  "auto-reorder": {
    id: "auto-reorder",
    kicker: "Auto-reorder · Dentago Pro",
    headline: "Draft orders before you remember to.",
    lead: "When stock hits par, Dentago drafts at today’s best price and sits it in the approval queue — humans still say yes.",
    outcomes: [
      {
        icon: "edit_note",
        title: "Drafts, not autopilot",
        body: "Buying discipline stays with your team — Dentago just does the tedious basket math.",
      },
      {
        icon: "savings",
        title: "Best live price first",
        body: "Each draft respects connected suppliers and today’s catalogue pricing.",
      },
      {
        icon: "verified_user",
        title: "Queue-ready for finance",
        body: "Fits the same approvals flow as larger baskets — one inbox, clean audit trail.",
      },
    ],
    body:
      "Exactly as on the platform: automation that saves manager hours without bypassing your sign-off rules.\n\nTrial it for 30 days and count how many Friday “emergency orders” you avoid.",
    learnMoreHash: "auto-reorder",
    preview: "inventory",
  },
  savings: {
    id: "savings",
    kicker: "Procurement on autopilot · Dentago Pro",
    headline: "We carry the full buy cycle so your team doesn’t live in six supplier tabs.",
    lead: "Savings vs list pricing and your savings history stay on Free—you keep the proof. Pro is the layer that runs procurement end to end: drafts, par alerts, approvals, and hand-offs from search through supplier checkout with less manual work.",
    outcomes: [
      { icon: "smart_toy", title: "Start-to-finish momentum", body: "Reorder drafts and guardrails keep baskets moving without Friday scrambles." },
      { icon: "inventory_2", title: "Stock + spend in one loop", body: "Par alerts and budgets sit next to approvals—fewer “who signed this off?” threads." },
      { icon: "verified_user", title: "You stay in control", body: "Automation prepares the work; managers approve the exceptions that matter." },
    ],
    body:
      "Every clinic sees estimated and logged savings on Free—that’s table stakes for trusting Dentago.\n\nPro is for teams who want procurement on autopilot: less chasing suppliers, fewer duplicate baskets, and a single hub that pushes the process forward while humans make the calls only when they need to.",
    learnMoreHash: "auto-reorder",
    preview: "hub",
  },
  "spend-analytics": {
    id: "spend-analytics",
    kicker: "Spend analytics · Dentago Pro",
    headline: "Answer “what did we actually spend?” in one glance.",
    lead: "Supplier, category, and SKU views with benchmarks—not exports stitched in Excel.",
    body:
      "Slice spend the way you run the business: by chair, by site, by supplier mix.\n\nSpot drift early, compare periods, and give your team a single place to align before the invoice lands.",
    learnMoreHash: "spend-analytics",
    preview: "analytics",
  },
  analytics: {
    id: "analytics",
    kicker: "Analytics · Dentago Pro",
    headline: "Turn orders into decisions your owner will read.",
    lead: "Procurement analytics tuned for UK dental—not generic retail charts.",
    body:
      "From month-to-date pacing to supplier concentration, you get narratives your practice manager can act on this week.\n\nPair analytics with savings and inventory and you’ve closed the loop from buy → track → improve.",
    learnMoreHash: "spend-analytics",
    preview: "analytics",
  },
  approvals: {
    id: "approvals",
    kicker: "Approvals · Dentago Pro",
    headline: "Spend with guard rails, not bottlenecks.",
    lead: "Route big baskets to one approver inbox—approve from your phone in a tap.",
    outcomes: [
      { icon: "inbox", title: "One queue, zero Slack POs", body: "Pending orders with context — no more forwarding supplier emails." },
      { icon: "history", title: "Audit-ready overrides", body: "Every exception logged for CQC and finance without the scramble." },
      { icon: "phone_iphone", title: "Approve between patients", body: "Managers clear the queue in seconds from mobile." },
    ],
    body:
      "Set who can buy what, and what needs a second pair of eyes. Dentago holds the queue so Slack isn’t your PO system.\n\nEvery override is logged—audit-friendly without the Friday afternoon scramble.",
    learnMoreHash: "approval-queue",
    preview: "approvals",
  },
  "approval-queue": {
    id: "approval-queue",
    kicker: "Approval queue · Dentago Pro",
    headline: "One inbox for every “can you sign this off?”",
    lead: "Pending orders, amounts, and context in a single queue.",
    body:
      "No more forwarding supplier emails. Approvers see the basket, the policy breach (if any), and can approve or bounce back with a note.\n\nYour buyers keep moving; finance keeps control.",
    learnMoreHash: "approval-queue",
    preview: "approvals",
  },
  "budget-ceiling": {
    id: "budget-ceiling",
    kicker: "Budget ceilings · Dentago Pro",
    headline: "Warn at 80%. Block at 100%—until you override.",
    lead: "Per-category and per-site budgets that behave like real guard rails.",
    body:
      "Dentago tracks pacing against the ceilings you set, so surprises land in the dashboard—not on the bank statement.\n\nOverrides stay traceable so you’re never arguing about who approved what.",
    learnMoreHash: "budget-ceiling",
    preview: "approvals",
  },
  "ai-assistant": {
    id: "ai-assistant",
    kicker: "AI assistant · Dentago Pro",
    headline: "Ask your clinic anything—in plain English.",
    lead: "Spend, suppliers, and savings—answered with the numbers attached.",
    body:
      "Skip the pivot tables. Ask whether PPE spend improved, which supplier drifted, or where to consolidate—and get answers tied back to real orders.\n\nIt’s the fastest way for principals and managers to align before they walk into Monday’s huddle.",
    learnMoreHash: "ai-assistant",
    preview: "ai",
  },
  "consolidated-invoice": {
    id: "consolidated-invoice",
    kicker: "Consolidated invoice · Dentago Pro",
    headline: "Eight supplier statements → one line-mapped view.",
    lead: "Close the month without reconciling chaos across inboxes.",
    body:
      "Dentago maps supplier invoices back to POs and baskets so finance sees one consolidated picture.\n\nLess chasing PDFs, fewer accrual surprises, faster month-end.",
    learnMoreHash: "consolidated-invoice",
    preview: "hub",
  },
  "procurement-hub": {
    id: "procurement-hub",
    kicker: "Procurement hub · Dentago Pro",
    headline: "One operating system for how the practice actually buys.",
    lead: "Search, cart, suppliers, and automation in a single workflow.",
    body:
      "Pro ties marketplace buying to inventory, approvals, and analytics so nothing lives in a silo.\n\nIf you’re scaling chairs or adding a site, this is the layer that keeps procurement disciplined without hiring another headcount.",
    learnMoreHash: "procurement-hub",
    preview: "hub",
  },
  "smart-order-gen": {
    id: "smart-order-gen",
    kicker: "Smart order generation · Dentago Pro",
    headline: "Let baskets build themselves from how you practice.",
    lead: "Treatment-aware suggestions that respect stock and policy.",
    body:
      "Connect the dots between what you deliver and what you consume—so suggested orders reflect real clinical throughput.\n\nLess guesswork for whoever runs ordering; more consistency for the ops side of the house.",
    learnMoreHash: "smart-order-gen",
    preview: "hub",
  },
  default: {
    id: "default",
    kicker: "Dentago Pro",
    headline: "Run the back office while you run the chair.",
    lead: "Predictive stock, auto-reorder drafts, approvals, spend analytics, and plain-English AI — the same 21-feature story as our platform page, tuned for UK practices.",
    outcomes: [
      {
        icon: "timer",
        title: "Time back for patients",
        body: "Managers tell us the weekly procurement scramble is what Pro removes first.",
      },
      {
        icon: "shield_with_heart",
        title: "Guard rails, not bottlenecks",
        body: "Spend rules and approvals that keep finance calm without slowing nurses down.",
      },
      {
        icon: "insights",
        title: "Numbers owners actually read",
        body: "Savings and spend views tied to your suppliers — not another dashboard graveyard.",
      },
    ],
    body:
      "You already trust Dentago for search and cart. Pro is the operating layer on top: stock, approvals, and insight working together.\n\nStart with a 30-day free trial — full features — then £299/mo per practice if you stay.",
    learnMoreHash: "predictive-par",
    preview: "generic",
  },
};

const VALID_IDS = new Set<string>(Object.keys(CONTENT) as ProUpgradeFeatureId[]);

export function normalizeProUpgradeFeature(raw: string | null | undefined): ProUpgradeFeatureId {
  if (!raw || typeof raw !== "string") return "default";
  const key = raw.trim().toLowerCase().replace(/\s+/g, "-");
  if (ALIASES[key]) return ALIASES[key];
  if (VALID_IDS.has(key) && key !== "default") return key as ProUpgradeFeatureId;
  return "default";
}

export function getProUpgradeContent(id: ProUpgradeFeatureId): ProUpgradeContent {
  return CONTENT[id] ?? CONTENT.default;
}

/** Pro checkout / compare on marketing pricing; `trial=30` reserved for future deep-links & analytics. */
export function pricingHref(feature: ProUpgradeFeatureId, from: string): string {
  const q = new URLSearchParams({ plan: "pro", from, f: feature, trial: "30" });
  return `/pricing?${q.toString()}`;
}
