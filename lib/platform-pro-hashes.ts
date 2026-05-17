/** Mega-menu labels → DOM ids on `/platform` (Pro Features). */
export const PLATFORM_PRO_FEATURE_HASH: Record<string, string> = {
  "Procurement Hub": "procurement-hub",
  "Stock Tracking": "stock-tracking",
  "Predictive Par": "predictive-par",
  "Auto-Reorder": "auto-reorder",
  "Approval Queue": "approval-queue",
  "Spend Analytics": "spend-analytics",
  "Budget Ceiling": "budget-ceiling",
  "Consolidated Invoice": "consolidated-invoice",
  "Smart Order Gen": "smart-order-gen",
  "AI Assistant": "ai-assistant",
};

export function platformProHref(label: string): string {
  const hash = PLATFORM_PRO_FEATURE_HASH[label];
  return hash ? `/platform#${hash}` : "/platform";
}

export const PLATFORM_FEATURED_PREDICTIVE_PAR_HASH = "predictive-par";

/** Homepage `/` tier card copy → section ids on `/platform`. */
export const HOME_PRO_TIER_HASH: Record<string, string> = {
  "Procurement Hub": "procurement-hub",
  "Predictive par alerts": "predictive-par",
  "Auto-reorder drafts": "auto-reorder",
  "Approval queue": "approval-queue",
  "Stock + expiry tracking": "stock-tracking",
  "Spend analytics": "spend-analytics",
  "Budget ceilings": "budget-ceiling",
  "Consolidated invoice": "consolidated-invoice",
  "AI purchasing assistant": "ai-assistant",
  "Treatment-to-stock mapping": "smart-order-gen",
  "Multi-clinic management": "multi-clinic-management",
};

export function homeProTierHref(label: string): string {
  const hash = HOME_PRO_TIER_HASH[label];
  return hash ? `/platform#${hash}` : "/platform";
}
