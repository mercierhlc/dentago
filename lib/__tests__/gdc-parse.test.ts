/**
 * Run: npx tsx --test lib/__tests__/gdc-parse.test.ts
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseGdcSearchResultHtml } from "../gdc-parse.js";

describe("parseGdcSearchResultHtml", () => {
  test("no results", () => {
    const r = parseGdcSearchResultHtml("<html>No results found</html>", "123456");
    assert.equal(r.found, false);
  });

  test("found when reg in body", () => {
    const html = `<table><tr><td>Jane Doe</td></tr><tr><td>123456</td></tr></table> General `;
    const r = parseGdcSearchResultHtml(html, "123456");
    assert.equal(r.found, true);
  });
});
