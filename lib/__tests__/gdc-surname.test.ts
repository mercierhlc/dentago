/**
 * Run: npx tsx --test lib/__tests__/gdc-surname.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { inferSurnameForGdcSearch } from "../gdc-surname.js";

describe("inferSurnameForGdcSearch", () => {
  test("strips Dr and takes last token", () => {
    assert.equal(inferSurnameForGdcSearch("Dr Jane Smith"), "Smith");
  });

  test("returns null for empty", () => {
    assert.equal(inferSurnameForGdcSearch(""), null);
    assert.equal(inferSurnameForGdcSearch("   "), null);
  });
});
