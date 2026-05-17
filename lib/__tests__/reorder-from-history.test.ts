/**
 * Run: npx tsx --test lib/__tests__/reorder-from-history.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildReorderSuggestionsFromOrderDates } from "../reorder-from-history.js";

describe("buildReorderSuggestionsFromOrderDates", () => {
  test("returns empty when fewer than minOrders distinct days", () => {
    const m = new Map<number, Date[]>([[1, [new Date("2025-01-10"), new Date("2025-01-10")]]]);
    const out = buildReorderSuggestionsFromOrderDates(m, new Date("2025-02-01"), { minOrders: 2 });
    assert.equal(out.length, 0);
  });

  test("ranks due when days_since_last exceeds typical gap", () => {
    const m = new Map<number, Date[]>([
      [
        42,
        [
          new Date("2025-01-01T12:00:00Z"),
          new Date("2025-01-08T12:00:00Z"),
          new Date("2025-01-15T12:00:00Z"),
        ],
      ],
    ]);
    const out = buildReorderSuggestionsFromOrderDates(m, new Date("2025-02-20T12:00:00Z"), { minOrders: 2 });
    assert.ok(out.length >= 1);
    const row = out.find((r) => r.product_id === 42);
    assert.ok(row);
    assert.equal(row!.urgency, "due");
  });
});
