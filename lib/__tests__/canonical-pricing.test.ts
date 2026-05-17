/**
 * Run: npx tsx --test lib/__tests__/canonical-pricing.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildSupplierOfferSyncPatch,
  computePricePerUnitExVat,
  inferPrimaryPackQuantity,
  stockStatusFromBoolean,
} from "../canonical-pricing.js";

describe("inferPrimaryPackQuantity", () => {
  test("parses pk suffix", () => {
    assert.equal(inferPrimaryPackQuantity("200 pk"), 200);
  });
  test("returns null for empty", () => {
    assert.equal(inferPrimaryPackQuantity(""), null);
    assert.equal(inferPrimaryPackQuantity(null), null);
  });
});

describe("buildSupplierOfferSyncPatch", () => {
  test("sets stock_status and last_synced_at", () => {
    const at = "2026-05-10T12:00:00.000Z";
    const p = buildSupplierOfferSyncPatch(100, false, { syncedAt: at });
    assert.equal(p.last_synced_at, at);
    assert.equal(p.stock_status, "out_of_stock");
    assert.equal(p.price_per_unit_ex_vat, 100);
  });

  test("divides by inferred pack from hint", () => {
    const p = buildSupplierOfferSyncPatch(50, true, {
      packSizeHint: "Box of 10",
      syncedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(p.stock_status, "in_stock");
    assert.equal(p.price_per_unit_ex_vat, 5);
  });

  test("uses explicit supplier_pack_quantity", () => {
    const p = buildSupplierOfferSyncPatch(30, true, {
      supplierPackQuantity: 6,
      packSizeHint: "200 pk",
      syncedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(p.price_per_unit_ex_vat, 5);
  });
});

describe("computePricePerUnitExVat", () => {
  test("null for non-positive line price", () => {
    assert.equal(computePricePerUnitExVat(0, {}), null);
    assert.equal(computePricePerUnitExVat(-1, {}), null);
  });
});

describe("stockStatusFromBoolean", () => {
  test("maps booleans", () => {
    assert.equal(stockStatusFromBoolean(true), "in_stock");
    assert.equal(stockStatusFromBoolean(false), "out_of_stock");
  });
});
