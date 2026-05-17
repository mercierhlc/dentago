/**
 * Run: npx tsx --test lib/__tests__/par-level-alerts.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeParLevelAlertsDue, type ParLevelAlertInput } from "../par-level-alerts.js";

const base = (over: Partial<ParLevelAlertInput>): ParLevelAlertInput => ({
  id: "1",
  clinic_id: "c",
  product_id: 1,
  par_quantity: 10,
  reorder_quantity: 10,
  reorder_interval_days: 7,
  last_ordered_at: null,
  alert_sent_at: null,
  ...over,
});

describe("computeParLevelAlertsDue", () => {
  test("skips rows without positive interval", () => {
    assert.equal(computeParLevelAlertsDue([base({ reorder_interval_days: null })]).length, 0);
    assert.equal(computeParLevelAlertsDue([base({ reorder_interval_days: 0 })]).length, 0);
  });

  test("never ordered with interval set is due", () => {
    const out = computeParLevelAlertsDue([base({ last_ordered_at: null })]);
    assert.equal(out.length, 1);
    assert.equal(out[0].reason, "never_ordered");
  });

  test("respects cooldown when alert_sent_at is recent", () => {
    const recent = new Date(Date.now() - 12 * 3_600_000).toISOString();
    const oldOrder = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const out = computeParLevelAlertsDue(
      [base({ last_ordered_at: oldOrder, alert_sent_at: recent, reorder_interval_days: 7 })],
      Date.now(),
      { respectAlertCooldown: true },
    );
    assert.equal(out.length, 0);
  });

  test("ignores cooldown when respectAlertCooldown is false", () => {
    const recent = new Date(Date.now() - 12 * 3_600_000).toISOString();
    const oldOrder = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const out = computeParLevelAlertsDue(
      [base({ last_ordered_at: oldOrder, alert_sent_at: recent, reorder_interval_days: 7 })],
      Date.now(),
      { respectAlertCooldown: false },
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].reason, "interval_elapsed");
  });
});
