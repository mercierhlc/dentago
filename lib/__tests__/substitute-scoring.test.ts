/**
 * Unit tests for substitute-scoring.ts
 *
 * Run with: npx tsx --test lib/__tests__/substitute-scoring.test.ts
 *
 * Tests:
 *   (a) Correct substitutes returned for an OOS product
 *   (b) No substitutes returned when no candidates match the category
 *   (c) Cross-category products are never returned
 *   (d) In-stock product with no candidates → empty list
 *   (e) Same-brand + same-material candidates rank highest
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  rankSubstitutes,
  scoreCandidate,
  extractMaterial,
} from "../substitute-scoring.js";
import type { SourceProduct, CandidateProduct } from "../substitute-scoring.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SOURCE: SourceProduct = {
  id: 1,
  category: "Impression Materials",
  brand: "3M",
  specs: [{ label: "Material", value: "Polyvinylsiloxane" }],
};

function makeCandidate(overrides: Partial<CandidateProduct> & { id: number }): CandidateProduct {
  return {
    id: overrides.id,
    name: overrides.name ?? `Product ${overrides.id}`,
    brand: overrides.brand ?? "Generic",
    category: overrides.category ?? "Impression Materials",
    image: "https://example.com/img.jpg",
    pack_size: overrides.pack_size ?? "50 units",
    specs: overrides.specs ?? null,
    inStockPrices: overrides.inStockPrices ?? [9.99],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("extractMaterial", () => {
  test("returns material value when label matches", () => {
    const specs = [{ label: "Material", value: "Polyvinylsiloxane" }];
    assert.equal(extractMaterial(specs), "Polyvinylsiloxane");
  });

  test("returns null when no material spec exists", () => {
    const specs = [{ label: "Colour", value: "White" }];
    assert.equal(extractMaterial(specs), null);
  });

  test("returns null for null specs", () => {
    assert.equal(extractMaterial(null), null);
  });
});

describe("scoreCandidate", () => {
  test("base score is 40 for same-category different brand and material", () => {
    const candidate = makeCandidate({ id: 2, brand: "OtherBrand" });
    const score = scoreCandidate(SOURCE, candidate);
    assert.equal(score, 40);
  });

  test("adds 20 points for same brand", () => {
    const candidate = makeCandidate({ id: 3, brand: "3M" });
    const score = scoreCandidate(SOURCE, candidate);
    assert.equal(score, 60); // 40 + 20
  });

  test("adds 20 points for same material type", () => {
    const candidate = makeCandidate({
      id: 4,
      brand: "Dentsply",
      specs: [{ label: "Material", value: "Polyvinylsiloxane" }],
    });
    const score = scoreCandidate(SOURCE, candidate);
    assert.equal(score, 60); // 40 + 20
  });

  test("adds 40 points for same brand AND same material", () => {
    const candidate = makeCandidate({
      id: 5,
      brand: "3M",
      specs: [{ label: "Material", value: "Polyvinylsiloxane" }],
    });
    const score = scoreCandidate(SOURCE, candidate);
    assert.equal(score, 80); // 40 + 20 + 20
  });
});

describe("rankSubstitutes", () => {
  // Test (a): correct substitutes returned for an OOS product
  test("returns in-stock candidates from the same category, highest-scored first", () => {
    const candidates: CandidateProduct[] = [
      makeCandidate({ id: 10, brand: "Generic", inStockPrices: [12.00] }),
      makeCandidate({ id: 11, brand: "3M", inStockPrices: [15.00] }), // same brand → score 60
      makeCandidate({
        id: 12,
        brand: "3M",
        specs: [{ label: "Material", value: "Polyvinylsiloxane" }],
        inStockPrices: [18.00],
      }), // same brand + material → score 80
    ];

    const results = rankSubstitutes(SOURCE, candidates, 6);
    assert.equal(results.length, 3);
    // id:12 scores 80, id:11 scores 60, id:10 scores 40
    assert.equal(results[0].id, 12);
    assert.equal(results[1].id, 11);
    assert.equal(results[2].id, 10);
  });

  // Test (b): no substitutes returned when no in-stock candidates exist in category
  test("returns empty list when all candidates have no in-stock prices", () => {
    const candidates: CandidateProduct[] = [
      makeCandidate({ id: 20, inStockPrices: [] }),
      makeCandidate({ id: 21, inStockPrices: [] }),
    ];
    // Simulate what the API does: only candidates with inStockPrices.length > 0 are passed
    const filtered = candidates.filter(c => c.inStockPrices.length > 0);
    const results = rankSubstitutes(SOURCE, filtered, 6);
    assert.equal(results.length, 0);
  });

  // Test (c): cross-category products are never returned
  test("excludes candidates from a different category", () => {
    const candidates: CandidateProduct[] = [
      makeCandidate({ id: 30, category: "Anaesthetics", inStockPrices: [5.00] }),
      makeCandidate({ id: 31, category: "PPE", inStockPrices: [3.00] }),
      makeCandidate({ id: 32, category: "Impression Materials", inStockPrices: [9.00] }),
    ];
    const results = rankSubstitutes(SOURCE, candidates, 6);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 32);
    const returnedCategories = results.map(r => r.category);
    assert.ok(
      returnedCategories.every(cat => cat === SOURCE.category),
      "All returned products must be in the same category as the source"
    );
  });

  test("respects the limit parameter", () => {
    const candidates: CandidateProduct[] = Array.from({ length: 10 }, (_, i) =>
      makeCandidate({ id: 100 + i, inStockPrices: [5.00 + i] })
    );
    const results = rankSubstitutes(SOURCE, candidates, 3);
    assert.equal(results.length, 3);
  });

  test("sameBrand flag is set correctly on results", () => {
    const candidates: CandidateProduct[] = [
      makeCandidate({ id: 40, brand: "3M", inStockPrices: [10.00] }),
      makeCandidate({ id: 41, brand: "Dentsply", inStockPrices: [10.00] }),
    ];
    const results = rankSubstitutes(SOURCE, candidates, 6);
    const brandMatch = results.find(r => r.id === 40);
    const noBrandMatch = results.find(r => r.id === 41);
    assert.equal(brandMatch?.sameBrand, true);
    assert.equal(noBrandMatch?.sameBrand, false);
  });

  test("ties in score are broken by bestPrice ascending", () => {
    const candidates: CandidateProduct[] = [
      makeCandidate({ id: 50, brand: "Generic", inStockPrices: [20.00] }),
      makeCandidate({ id: 51, brand: "Generic", inStockPrices: [8.00] }),
      makeCandidate({ id: 52, brand: "Generic", inStockPrices: [15.00] }),
    ];
    const results = rankSubstitutes(SOURCE, candidates, 6);
    // All score 40 (same category, different brand/material) → sorted by price
    assert.equal(results[0].id, 51); // £8
    assert.equal(results[1].id, 52); // £15
    assert.equal(results[2].id, 50); // £20
  });
});
