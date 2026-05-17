/** Dedicated `/solutions/[slug]` pages — mega-menu audiences × curated capability IDs */

export type SolutionsAudienceSegment = "clinic-type" | "role" | "workflow";

export type HeroSegment = { text: string; italic?: boolean };

export type SolutionsAudiencePageConfig = {
  slug: string;
  segment: SolutionsAudienceSegment;
  menuLabel: string;
  metaTitle: string;
  metaDescription: string;
  heroEyebrow: string;
  heroTitleSegments: HeroSegment[];
  heroLead: string;
  outcomesHeading: string;
  outcomes: string[];
  capabilityIntro: string;
  featureIds: readonly string[];
};

const clinic = (partial: Omit<SolutionsAudiencePageConfig, "segment">): SolutionsAudiencePageConfig => ({
  ...partial,
  segment: "clinic-type",
});

const role = (partial: Omit<SolutionsAudiencePageConfig, "segment">): SolutionsAudiencePageConfig => ({
  ...partial,
  segment: "role",
});

const workflow = (partial: Omit<SolutionsAudiencePageConfig, "segment">): SolutionsAudiencePageConfig => ({
  ...partial,
  segment: "workflow",
});

export const SOLUTIONS_AUDIENCE_PAGES: SolutionsAudiencePageConfig[] = [
  clinic({
    slug: "single-site-practices",
    menuLabel: "Single-site practices",
    metaTitle: "Single-site dental practices",
    metaDescription:
      "Unified ordering, search, stock visibility and mobile access for independent UK practices — one login for every supplier.",
    heroEyebrow: "By clinic type · Single site",
    heroTitleSegments: [
      { text: "One tab for " },
      { text: "every supplier", italic: true },
    ],
    heroLead:
      "Independent practices win when procurement is fast, visible and boring. Dentago replaces portal-hopping with live pricing, a single cart and history that actually matches what you ordered.",
    outcomesHeading: "What changes day one",
    outcomes: [
      "Staff stop juggling six browser tabs for routine orders",
      "Substitutions and favourites cut time-to-basket on repeat buys",
      "Low-stock and delivery signals surface before the nurse WhatsApp thread starts",
    ],
    capabilityIntro:
      "These capability areas map directly to how single-site teams buy, receive and stay ahead — without enterprise overhead.",
    featureIds: [
      "unified-supplier-ordering",
      "smart-product-search",
      "ai-product-substitutions",
      "inventory-usage-management",
      "smart-reordering-templates",
      "delivery-backorder-tracking",
      "smart-notifications-alerts",
      "mobile-procurement-access",
      "clinic-control-tower-dashboard",
    ],
  }),
  clinic({
    slug: "multi-site-groups",
    menuLabel: "Multi-site groups",
    metaTitle: "Multi-site dental groups",
    metaDescription:
      "Centralise procurement across practices with shared governance, spend visibility, budgets and location-level inventory.",
    heroEyebrow: "By clinic type · Multi-site",
    heroTitleSegments: [
      { text: "Group buying with " },
      { text: "local control", italic: true },
    ],
    heroLead:
      "When you run several practices, procurement friction scales faster than headcount. Dentago gives you one operating picture — budgets, approvals and supplier performance — without stripping sites of autonomy.",
    outcomesHeading: "What groups stabilise first",
    outcomes: [
      "Comparable spend and stock posture across locations",
      "Approval chains that respect site managers and finance",
      "Fewer emergency transfers between practices after surprise stockouts",
    ],
    capabilityIntro: "Curated for regional groups balancing consistency with surgical flexibility.",
    featureIds: [
      "multi-clinic-procurement",
      "spend-analytics-budget",
      "request-approve-workflows",
      "clinic-control-tower-dashboard",
      "supplier-management-scorecards",
      "inventory-usage-management",
      "unified-supplier-ordering",
      "closed-loop-procurement-analytics",
    ],
  }),
  clinic({
    slug: "dsos-corporates",
    menuLabel: "DSOs & corporates",
    metaTitle: "DSOs & corporate dental",
    metaDescription:
      "Enterprise procurement depth: closed-loop analytics, OCR, reconciliation, integrations and supplier scorecards across many sites.",
    heroEyebrow: "By clinic type · DSO / Corporate",
    heroTitleSegments: [
      { text: "Procurement as " },
      { text: "infrastructure", italic: true },
    ],
    heroLead:
      "At scale, email attachments and spreadsheet reconciliation quietly drain seven figures. Dentago is structured as an intelligence layer — lifecycle analytics, finance-grade controls and supplier accountability.",
    outcomesHeading: "Board-level outcomes",
    outcomes: [
      "Full request-to-pay visibility instead of quarterly forensic exercises",
      "Supplier scorecards backed by delivery and fill-rate reality",
      "Finance closes faster with matched invoices and exports",
    ],
    capabilityIntro:
      "The deepest cuts across automation, analytics and integrations — aligned to how corporates actually govern.",
    featureIds: [
      "multi-clinic-procurement",
      "closed-loop-procurement-analytics",
      "procurement-intelligence-layer",
      "supplier-management-scorecards",
      "invoice-ocr-processing",
      "receiving-invoice-reconciliation",
      "accounting-finance-integrations",
      "request-approve-workflows",
      "spend-analytics-budget",
      "vendor-message-center",
    ],
  }),
  clinic({
    slug: "nhs-practices",
    menuLabel: "NHS practices",
    metaTitle: "NHS dental practices",
    metaDescription:
      "Governed procurement for NHS teams: approvals, audit trails, budgets and transparent ordering alongside everyday supplier access.",
    heroEyebrow: "By clinic type · NHS",
    heroTitleSegments: [
      { text: "Compliance-ready " },
      { text: "buying rhythm", italic: true },
    ],
    heroLead:
      "NHS workflows reward clarity — who approved what, why budgets moved and where savings landed. Dentago keeps marketplace convenience inside structured approvals and reporting.",
    outcomesHeading: "Operational hygiene",
    outcomes: [
      "Approval and audit history that stands up to scrutiny",
      "Spend signals by category and supplier without bespoke BI",
      "Fewer off-contract surprises when prices shift",
    ],
    capabilityIntro: "Capabilities weighted toward governance, transparency and traceability.",
    featureIds: [
      "request-approve-workflows",
      "spend-analytics-budget",
      "closed-loop-procurement-analytics",
      "unified-supplier-ordering",
      "smart-product-search",
      "inventory-usage-management",
      "invoice-ocr-processing",
      "receiving-invoice-reconciliation",
      "smart-notifications-alerts",
    ],
  }),
  clinic({
    slug: "specialist-clinics",
    menuLabel: "Specialist clinics",
    metaTitle: "Specialist dental clinics",
    metaDescription:
      "Procedure-led procurement: advanced search, substitutions, procedure-to-stock mapping and predictive reorder for high-variance specialty lists.",
    heroEyebrow: "By clinic type · Specialist",
    heroTitleSegments: [
      { text: "Built for " },
      { text: "complex SKUs", italic: true },
    ],
    heroLead:
      "Specialist lists change fast — kits, boutique suppliers and chair-side urgency. Dentago centres substitutions, procedure-linked inventory and intelligence so you are never guessing parity mid-case.",
    outcomesHeading: "Clinical procurement leverage",
    outcomes: [
      "Find equivalents faster when a line goes obsolete or short",
      "Bundles and templates tuned to procedure mix",
      "Natural-language answers over sprawling SKU catalogues",
    ],
    capabilityIntro: "Everything here reduces friction when your formulary is non-standard.",
    featureIds: [
      "smart-product-search",
      "ai-product-substitutions",
      "inventory-usage-management",
      "smart-reordering-templates",
      "procurement-intelligence-layer",
      "unified-supplier-ordering",
      "smart-notifications-alerts",
      "delivery-backorder-tracking",
    ],
  }),

  role({
    slug: "practice-managers",
    menuLabel: "Practice managers",
    metaTitle: "Practice managers",
    metaDescription:
      "Control tower operations for practice managers: approvals, vendor threads, stock alerts, deliveries and day-to-day ordering in one workspace.",
    heroEyebrow: "For roles · Practice manager",
    heroTitleSegments: [
      { text: "The week, " },
      { text: "orchestrated", italic: true },
    ],
    heroLead:
      "You triage everyone’s urgency — clinical, supplier and finance. Dentago turns procurement into a single cockpit: what needs approving, what is stuck inbound and what will blow budget next week.",
    outcomesHeading: "Fewer Monday scrambles",
    outcomes: [
      "Morning scan across stock risk, deliveries and signatures pending",
      "Supplier chatter anchored to orders and invoices, not inbox archaeology",
      "Reorder drafts appear before par breaches become emergencies",
    ],
    capabilityIntro:
      "Selected for the operational glue role — visibility + conversation + approval leverage.",
    featureIds: [
      "clinic-control-tower-dashboard",
      "request-approve-workflows",
      "smart-notifications-alerts",
      "inventory-usage-management",
      "vendor-message-center",
      "delivery-backorder-tracking",
      "unified-supplier-ordering",
      "smart-reordering-templates",
    ],
  }),
  role({
    slug: "principal-dentists",
    menuLabel: "Principal dentists",
    metaTitle: "Principal dentists & owners",
    metaDescription:
      "Margin, savings and supplier leverage without micromanaging baskets — executive dashboards, analytics and intelligence.",
    heroEyebrow: "For roles · Principal",
    heroTitleSegments: [
      { text: "See " },
      { text: "margin", italic: true },
      { text: ", not noise" },
    ],
    heroLead:
      "You care whether procurement strategy pays — not whether glove carton three had the right VAT code on Tuesday. Dentago surfaces savings trajectory, anomalies and supplier posture in plain English.",
    outcomesHeading: "Owner-grade signal",
    outcomes: [
      "Quarterly savings narrative backed by data, not vibes",
      "Early warning when supplier mix drifts expensive",
      "Single-pane exceptions feed instead of fifteen Slack pings",
    ],
    capabilityIntro: "Curated for principals who budget time in minutes, not hours.",
    featureIds: [
      "spend-analytics-budget",
      "procurement-intelligence-layer",
      "supplier-management-scorecards",
      "closed-loop-procurement-analytics",
      "clinic-control-tower-dashboard",
      "smart-notifications-alerts",
      "multi-clinic-procurement",
    ],
  }),
  role({
    slug: "group-operations",
    menuLabel: "Group operations",
    metaTitle: "Group operations",
    metaDescription:
      "Run multi-site fulfilment, supplier performance and escalations — central visibility with operational granularity.",
    heroEyebrow: "For roles · Group operations",
    heroTitleSegments: [
      { text: "Standards that " },
      { text: "scale", italic: true },
    ],
    heroLead:
      "Ops leads translate strategy into weekly cadence — stock posture across locations, supplier remediation and cross-practice escalations. Dentago aligns messaging, analytics and inventory truth.",
    outcomesHeading: "Execution leverage",
    outcomes: [
      "Central supplier scorecards with delivery and fill-rate reality",
      "Backorder and shipment narratives attached to sites automatically",
      "Spend comparisons that spotlight outliers without finger-pointing",
    ],
    capabilityIntro: "Weighted toward multi-site orchestration and supplier accountability.",
    featureIds: [
      "multi-clinic-procurement",
      "supplier-management-scorecards",
      "delivery-backorder-tracking",
      "vendor-message-center",
      "closed-loop-procurement-analytics",
      "spend-analytics-budget",
      "request-approve-workflows",
      "smart-notifications-alerts",
    ],
  }),
  role({
    slug: "finance-teams",
    menuLabel: "Finance teams",
    metaTitle: "Finance teams",
    metaDescription:
      "Invoice capture, three-way match discipline, exports and reconciliation hooks — procurement accuracy finance can trust.",
    heroEyebrow: "For roles · Finance",
    heroTitleSegments: [
      { text: "Match. Export. " },
      { text: "Close.", italic: true },
    ],
    heroLead:
      "Finance inherits procurement chaos as spreadsheet archaeology. OCR ingestion, duplicate detection and reconciliation scaffolding shrink exception queues — then accounting integrations carry clean cohorts outward.",
    outcomesHeading: "Month-end relief",
    outcomes: [
      "Fewer mystery invoices without PO lineage",
      "Spend categorisation that survives audit sampling",
      "Straight-through exports toward Xero, Sage or QuickBooks workflows",
    ],
    capabilityIntro: "Every capability here improves evidentiary chain from basket to ledger.",
    featureIds: [
      "invoice-ocr-processing",
      "receiving-invoice-reconciliation",
      "accounting-finance-integrations",
      "spend-analytics-budget",
      "closed-loop-procurement-analytics",
      "request-approve-workflows",
      "smart-notifications-alerts",
    ],
  }),

  workflow({
    slug: "daily-ordering",
    menuLabel: "Daily ordering",
    metaTitle: "Daily ordering workflow",
    metaDescription:
      "Fast basket building across suppliers with live pricing, substitutions, delivery estimates and mobile checkout.",
    heroEyebrow: "For workflows · Daily ordering",
    heroTitleSegments: [
      { text: "Minutes to basket, " },
      { text: "seconds", italic: true },
      { text: " to certainty" },
    ],
    heroLead:
      "Daily ordering should feel like a consumer checkout — except prices are real account pricing and substitutions handle disruption gracefully.",
    outcomesHeading: "Throughput habits",
    outcomes: [
      "SKU or plain-language discovery across supplier boundaries",
      "Confidence when preferred SKUs go short — alternatives ranked",
      "Delivery expectation surfaced before commit — fewer inbound surprises",
    ],
    capabilityIntro: "The velocity stack: discover → substitute → order → track.",
    featureIds: [
      "unified-supplier-ordering",
      "smart-product-search",
      "ai-product-substitutions",
      "delivery-backorder-tracking",
      "mobile-procurement-access",
      "smart-notifications-alerts",
    ],
  }),
  workflow({
    slug: "stockroom-requests",
    menuLabel: "Stockroom requests",
    metaTitle: "Stockroom & shelf workflows",
    metaDescription:
      "Shelf-level visibility, par alerts, reorder drafts and mobile checks — built for nurses and managers coordinating stock.",
    heroEyebrow: "For workflows · Stockroom",
    heroTitleSegments: [
      { text: "Shelf truth → " },
      { text: "automatic drafts", italic: true },
    ],
    heroLead:
      "Stockrooms fail silently until someone opens the wrong cupboard mid-clinic. Dentago binds monitoring, prediction and one-click replenishment so gaps surface early.",
    outcomesHeading: "Operational continuity",
    outcomes: [
      "Expiry intelligence reduces silent waste write-offs",
      "Reorder bundles mirror actual clinical cadence",
      "Mobile spot-checks without logging into supplier portals",
    ],
    capabilityIntro: "Focused on physical stock reality — not just procurement paperwork.",
    featureIds: [
      "inventory-usage-management",
      "smart-reordering-templates",
      "smart-notifications-alerts",
      "mobile-procurement-access",
      "unified-supplier-ordering",
      "delivery-backorder-tracking",
    ],
  }),
  workflow({
    slug: "monthly-reconciliation",
    menuLabel: "Monthly reconciliation",
    metaTitle: "Monthly reconciliation",
    metaDescription:
      "Invoice ingestion, matching against receipts and orders, finance exports and lifecycle analytics — shrink the reconciliation calendar.",
    heroEyebrow: "For workflows · Reconciliation",
    heroTitleSegments: [
      { text: "Exceptions " },
      { text: "surface themselves", italic: true },
    ],
    heroLead:
      "Reconciliation is detective work unless lineage exists by design. OCR capture plus structured matching replaces binder archaeology.",
    outcomesHeading: "Predictable closes",
    outcomes: [
      "Duplicate invoices intercepted before payment",
      "Three-way alignment narratives ready for review meetings",
      "Accounting exports cut manual journal rework",
    ],
    capabilityIntro:
      "Invoice discipline plus analytics — so reconciliation becomes narrative, not archaeology.",
    featureIds: [
      "invoice-ocr-processing",
      "receiving-invoice-reconciliation",
      "accounting-finance-integrations",
      "spend-analytics-budget",
      "closed-loop-procurement-analytics",
      "smart-notifications-alerts",
    ],
  }),
  workflow({
    slug: "spend-review",
    menuLabel: "Spend review",
    metaTitle: "Spend review & optimisation",
    metaDescription:
      "Trend boards, supplier scorecards, anomaly detection and savings narratives — turn retrospectives into decisions.",
    heroEyebrow: "For workflows · Spend review",
    heroTitleSegments: [
      { text: "Insight that " },
      { text: "commands rooms", italic: true },
    ],
    heroLead:
      "Spend reviews flop when data arrives patched from invoices, spreadsheets and memory. Dentago anchors commentary in unified analytics and supplier performance.",
    outcomesHeading: "Meetings with receipts",
    outcomes: [
      "Explain variance by supplier, category or chair without offline joins",
      "Catch behavioural drift before it compounds",
      "Supplier conversations grounded in scorecards, not anecdotes",
    ],
    capabilityIntro: "Governance of purse strings — analytics forward, intelligence when nuance matters.",
    featureIds: [
      "spend-analytics-budget",
      "supplier-management-scorecards",
      "procurement-intelligence-layer",
      "closed-loop-procurement-analytics",
      "smart-notifications-alerts",
      "multi-clinic-procurement",
    ],
  }),
];

export const SOLUTIONS_AUDIENCE_SLUGS = SOLUTIONS_AUDIENCE_PAGES.map((p) => p.slug) as readonly string[];

export function getSolutionsAudiencePage(slug: string): SolutionsAudiencePageConfig | undefined {
  return SOLUTIONS_AUDIENCE_PAGES.find((p) => p.slug === slug);
}
