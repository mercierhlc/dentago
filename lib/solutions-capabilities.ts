/** Solutions page — procurement capability pillars (marketing copy). */

export type ProcurementFeature = {
  id: string;
  title: string;
  tag: string;
  bullets: string[];
  purpose: string;
};

export type ProcurementFeatureWithId = ProcurementFeature;

export type CapabilityGroup = {
  slug: string;
  eyebrow: string;
  headline: string;
  sub?: string;
  features: ProcurementFeature[];
};

export const PROCUREMENT_CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    slug: "discover-order",
    eyebrow: "Discover & order",
    headline: "One surface for every supplier",
    sub: "Replace tab-switching with a single procurement lane.",
    features: [
      {
        id: "unified-supplier-ordering",
        title: "Unified Supplier Ordering",
        tag: "Order",
        bullets: [
          "Order from all suppliers in one platform",
          "Single cart across suppliers",
          "Live pricing and stock visibility",
          "Delivery estimate comparison",
          "Centralized order history",
        ],
        purpose: "Eliminates supplier switching and fragmented ordering workflows.",
      },
      {
        id: "smart-product-search",
        title: "Smart Product Search",
        tag: "Search",
        bullets: [
          "Universal product search across suppliers",
          "Search by SKU, brand, category, or procedure",
          "AI-powered product matching",
          "Saved products and favourites",
        ],
        purpose: "Makes procurement dramatically faster and easier.",
      },
      {
        id: "ai-product-substitutions",
        title: "AI Product Substitutions",
        tag: "Substitutions",
        bullets: [
          "Suggest equivalent alternatives when items are unavailable",
          "Recommend cheaper or faster alternatives",
          "Confidence scoring for substitutions",
          "Clinic preference learning over time",
        ],
        purpose: "Prevents stockouts and improves purchasing efficiency.",
      },
    ],
  },
  {
    slug: "stock-automation",
    eyebrow: "Stock & replenishment",
    headline: "Visibility without spreadsheets",
    features: [
      {
        id: "inventory-usage-management",
        title: "Inventory & Usage Management",
        tag: "Inventory",
        bullets: [
          "Real-time stock tracking",
          "Low-stock alerts",
          "Expiry date tracking",
          "Usage monitoring",
          "Procedure-to-inventory mapping",
          "Multi-location inventory support",
        ],
        purpose: "Gives clinics operational visibility and reduces waste.",
      },
      {
        id: "smart-reordering-templates",
        title: "Smart Reordering & Ordering Templates",
        tag: "Reorder",
        bullets: [
          "Automated reorder suggestions",
          "Usage-based reorder predictions",
          "One-click replenishment",
          "Saved supply bundles by clinic/procedure/supplier",
          "Recurring order workflows",
        ],
        purpose: "Reduces repetitive purchasing work and prevents shortages.",
      },
    ],
  },
  {
    slug: "invoices",
    eyebrow: "Invoices & reconciliation",
    headline: "From inbox to matched ledger",
    features: [
      {
        id: "invoice-ocr-processing",
        title: "Invoice OCR & Processing",
        tag: "Capture",
        bullets: [
          "Upload PDFs, scans, or supplier emails",
          "Automatic invoice extraction",
          "Line-item recognition",
          "Duplicate invoice detection",
          "Spend categorization",
        ],
        purpose: "Eliminates manual invoice admin.",
      },
      {
        id: "receiving-invoice-reconciliation",
        title: "Receiving & Invoice Reconciliation",
        tag: "Match",
        bullets: [
          "Match invoices against orders and deliveries",
          "Confirm received quantities",
          "Handle partial deliveries and backorders",
          "Detect overcharges, missing items, and pricing discrepancies",
          "Credit/refund tracking",
        ],
        purpose: "Creates procurement accuracy and financial control.",
      },
    ],
  },
  {
    slug: "spend-suppliers",
    eyebrow: "Spend & suppliers",
    headline: "Govern spend and supplier performance",
    features: [
      {
        id: "spend-analytics-budget",
        title: "Spend Analytics & Budget Controls",
        tag: "Spend",
        bullets: [
          "Spend tracking by supplier/category/location",
          "Budget limits by clinic, chair, department, or user",
          "Price increase alerts",
          "Procurement trend reporting",
          "Savings and margin insights",
        ],
        purpose: "Helps clinics govern and optimize purchasing.",
      },
      {
        id: "supplier-management-scorecards",
        title: "Supplier Management & Scorecards",
        tag: "Suppliers",
        bullets: [
          "Centralized supplier directory",
          "Supplier performance scoring",
          "Delivery reliability tracking",
          "Fill-rate and error-rate monitoring",
          "Contract and rebate tracking",
          "Supplier pricing management",
        ],
        purpose: "Helps clinics evaluate and control supplier relationships.",
      },
    ],
  },
  {
    slug: "governance",
    eyebrow: "Governance",
    headline: "Requests, roles, and audit-ready trails",
    features: [
      {
        id: "request-approve-workflows",
        title: "Request-to-Approve Workflows",
        tag: "Approvals",
        bullets: [
          "Staff purchasing requests",
          "Multi-stage approval chains",
          "Role permissions",
          "Exception approvals",
          "Audit logs and activity history",
        ],
        purpose: "Creates structured, collaborative procurement governance.",
      },
    ],
  },
  {
    slug: "fulfillment-comms",
    eyebrow: "Fulfillment & communication",
    headline: "Track shipments and keep conversations in one place",
    features: [
      {
        id: "delivery-backorder-tracking",
        title: "Delivery & Backorder Tracking",
        tag: "Delivery",
        bullets: [
          "Shipment tracking",
          "Delivery status updates",
          "Missing order reporting",
          "Backorder management",
          "Supplier issue tracking",
        ],
        purpose: "Keeps clinics operationally informed.",
      },
      {
        id: "vendor-message-center",
        title: "Vendor Message Center",
        tag: "Messages",
        bullets: [
          "Supplier communication threads",
          "Order-linked conversations",
          "Invoice dispute management",
          "Centralized procurement communications",
        ],
        purpose: "Eliminates fragmented procurement communication.",
      },
    ],
  },
  {
    slug: "intelligence",
    eyebrow: "Intelligence & alerts",
    headline: "Stay ahead of stock, price, and margin risk",
    features: [
      {
        id: "smart-notifications-alerts",
        title: "Smart Notifications & Operational Alerts",
        tag: "Alerts",
        bullets: [
          "Low stock alerts",
          "Delayed shipment alerts",
          "Invoice mismatch alerts",
          "Price increase alerts",
          "Approval reminders",
          "Expiry warnings",
          "Reorder risk alerts",
        ],
        purpose: "Keeps clinics proactive instead of reactive.",
      },
      {
        id: "procurement-intelligence-layer",
        title: "Procurement Intelligence Layer",
        tag: "AI",
        bullets: [
          "AI reorder suggestions",
          "Supplier optimization recommendations",
          "Spend anomaly detection",
          "Margin warnings",
          "Operational insights",
          "Natural-language procurement search",
        ],
        purpose: "Turns Dentago into operational intelligence infrastructure.",
      },
      {
        id: "closed-loop-procurement-analytics",
        title: "Closed-Loop Procurement Analytics",
        tag: "Analytics",
        bullets: [
          "Track request → approval → order → delivery → invoice → payment lifecycle",
          "Approval bottleneck reporting",
          "Procurement efficiency metrics",
          "Supplier fulfillment analytics",
        ],
        purpose: "Provides full operational procurement visibility.",
      },
    ],
  },
  {
    slug: "scale",
    eyebrow: "Multi-site & command centre",
    headline: "Built for groups and principals who need one pane of glass",
    features: [
      {
        id: "multi-clinic-procurement",
        title: "Multi-Clinic Procurement Management",
        tag: "Scale",
        bullets: [
          "Centralized purchasing across locations",
          "Location-level inventory visibility",
          "Shared supplier management",
          "Cross-clinic spend comparison",
          "Central governance controls",
        ],
        purpose: "Supports growing clinic groups and DSOs.",
      },
      {
        id: "clinic-control-tower-dashboard",
        title: "Clinic Control Tower Dashboard",
        tag: "Dashboard",
        bullets: [
          "Low stock overview",
          "Delayed deliveries",
          "Pending approvals",
          "Invoice mismatches",
          "Budget warnings",
          "Supplier issues",
          "Upcoming reorder risks",
          "Procurement activity feed",
        ],
        purpose: 'Creates the “all-in-one operational workspace” feeling clinics actually want.',
      },
    ],
  },
  {
    slug: "connect",
    eyebrow: "Finance & mobility",
    headline: "Connect procurement to the rest of the stack",
    features: [
      {
        id: "accounting-finance-integrations",
        title: "Accounting & Finance Integrations",
        tag: "Finance",
        bullets: [
          "Accounting software sync",
          "Invoice export",
          "Payment tracking",
          "Financial reconciliation support",
        ],
        purpose: "Connects procurement with finance operations.",
      },
      {
        id: "mobile-procurement-access",
        title: "Mobile Procurement Access",
        tag: "Mobile",
        bullets: [
          "Mobile ordering",
          "Inventory checks",
          "Invoice uploads",
          "Approval workflows",
          "Delivery tracking",
        ],
        purpose: "Allows clinics to manage procurement in real time from anywhere.",
      },
    ],
  },
];

/** Flattened catalogue — stable IDs for audience pages */
export const PROCUREMENT_FEATURES_FLAT: ProcurementFeatureWithId[] = PROCUREMENT_CAPABILITY_GROUPS.flatMap((g) =>
  g.features.map((f) => ({ ...f })),
);

export function getProcurementFeatureById(id: string): ProcurementFeatureWithId | undefined {
  return PROCUREMENT_FEATURES_FLAT.find((f) => f.id === id);
}

/** Returns features in the order of `ids` (dedupe preserves first occurrence) */
export function getProcurementFeaturesByIds(ids: readonly string[]): ProcurementFeatureWithId[] {
  const map = new Map(PROCUREMENT_FEATURES_FLAT.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const out: ProcurementFeatureWithId[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const f = map.get(id);
    if (f) out.push(f);
  }
  return out;
}
