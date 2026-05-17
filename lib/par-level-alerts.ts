/**
 * Shared par-level reorder alert logic (cron + clinic dashboard).
 * Mirrors `app/api/cron/stockout-alerts/route.ts` eligibility rules.
 */

export type ParLevelAlertInput = {
  id: string;
  clinic_id: string;
  product_id: number;
  par_quantity: number | null;
  reorder_quantity: number | null;
  reorder_interval_days: number | null;
  last_ordered_at: string | null;
  alert_sent_at: string | null;
};

export type ParLevelAlertDue = ParLevelAlertInput & {
  daysSinceOrder?: number;
  reason: "never_ordered" | "interval_elapsed";
};

const COOLDOWN_HOURS = 48;

export type ComputeParLevelOptions = {
  /** When false (e.g. in-app dashboard), show every due row even if email was recently sent. */
  respectAlertCooldown?: boolean;
};

export function computeParLevelAlertsDue(
  rows: ParLevelAlertInput[],
  nowMs: number = Date.now(),
  options: ComputeParLevelOptions = {},
): ParLevelAlertDue[] {
  const respectCooldown = options.respectAlertCooldown !== false;
  const out: ParLevelAlertDue[] = [];
  for (const pl of rows) {
    if (pl.reorder_interval_days == null || pl.reorder_interval_days <= 0) continue;

    if (!pl.last_ordered_at) {
      out.push({ ...pl, reason: "never_ordered" });
      continue;
    }

    const daysSinceOrder = Math.floor(
      (nowMs - new Date(pl.last_ordered_at).getTime()) / 86_400_000,
    );
    if (daysSinceOrder < pl.reorder_interval_days) continue;

    if (respectCooldown && pl.alert_sent_at) {
      const hoursSinceAlert =
        (nowMs - new Date(pl.alert_sent_at).getTime()) / 3_600_000;
      if (hoursSinceAlert < COOLDOWN_HOURS) continue;
    }

    out.push({ ...pl, daysSinceOrder, reason: "interval_elapsed" });
  }
  return out;
}
