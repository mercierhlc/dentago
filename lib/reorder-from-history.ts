/**
 * Heuristic reorder suggestions from order timestamps (no ML — predictable v1).
 */

export type ReorderUrgency = "due" | "soon" | "watch";

export type ReorderSuggestion = {
  product_id: number;
  typical_days_between: number;
  days_since_last: number;
  urgency: ReorderUrgency;
  order_count: number;
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * @param orderDates — distinct calendar days (or order timestamps) the product appeared on an order, newest first optional
 */
export function buildReorderSuggestionsFromOrderDates(
  productOrderDates: Map<number, Date[]>,
  now: Date = new Date(),
  options: { minOrders?: number; soonDays?: number } = {},
): ReorderSuggestion[] {
  const minOrders = options.minOrders ?? 2;
  const soonDays = options.soonDays ?? 7;
  const out: ReorderSuggestion[] = [];
  const nowMs = now.getTime();

  for (const [product_id, rawDates] of productOrderDates) {
    const dates = [...rawDates]
      .map((d) => new Date(d.getTime()))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());
    if (dates.length < minOrders) continue;

    const dayBuckets = new Map<string, Date>();
    for (const d of dates) {
      const key = d.toISOString().slice(0, 10);
      if (!dayBuckets.has(key)) dayBuckets.set(key, d);
    }
    const distinct = [...dayBuckets.values()].sort((a, b) => b.getTime() - a.getTime());
    if (distinct.length < minOrders) continue;

    const gaps: number[] = [];
    for (let i = 0; i < distinct.length - 1; i++) {
      const a = distinct[i].getTime();
      const b = distinct[i + 1].getTime();
      gaps.push(Math.max(1, Math.round((a - b) / 86_400_000)));
    }
    const typical = Math.max(7, Math.round(median(gaps)));
    const last = distinct[0];
    const days_since_last = Math.floor((nowMs - last.getTime()) / 86_400_000);

    const nextExpected = typical;
    let urgency: ReorderUrgency = "watch";
    if (days_since_last >= nextExpected) urgency = "due";
    else if (days_since_last >= nextExpected - soonDays) urgency = "soon";

    out.push({
      product_id,
      typical_days_between: typical,
      days_since_last,
      urgency,
      order_count: distinct.length,
    });
  }

  out.sort((a, b) => {
    const rank = (u: ReorderUrgency) => (u === "due" ? 0 : u === "soon" ? 1 : 2);
    const d = rank(a.urgency) - rank(b.urgency);
    if (d !== 0) return d;
    return b.days_since_last - a.days_since_last;
  });
  return out;
}
