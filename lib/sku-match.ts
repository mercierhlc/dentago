/**
 * SKU Match Confidence Scoring
 *
 * Used during supplier catalogue ingestion to score how confidently
 * a supplier SKU row maps to a canonical dentago_products row.
 *
 * Thresholds:
 *   score >= 85  → 'approved'         (auto-shown in search)
 *   score 60–84  → 'pending_review'   (queued for clinical review)
 *   score < 60   → 'unmatched'        (not linked, shown as separate product)
 *
 * Safety rationale:
 *   A wrong SKU match shows false savings on a different product.
 *   Worst case: a clinic orders the wrong material/specification,
 *   causing a clinical incident. The 85% auto-approve threshold is
 *   intentionally conservative for dental consumables.
 */

export type MatchStatus = "approved" | "pending_review" | "unmatched";

export interface MatchInput {
  // Supplier-side (the row being imported)
  supplierName:      string;
  supplierBrand:     string;
  supplierCategory:  string;
  supplierPackSize:  string;
  supplierSku:       string;

  // Canonical product (the dentago_products row being tested against)
  canonicalName:     string;
  canonicalBrand:    string;
  canonicalCategory: string;
  canonicalPackSize: string;
}

export interface MatchResult {
  score:       number;     // 0–100
  status:      MatchStatus;
  method:      string;
  breakdown:   Record<string, number>;
}

/** Auto-approve threshold (≥ this is shown in search without review) */
export const THRESHOLD_AUTO_APPROVE = 85;

/** Review queue threshold (≥ this goes to manual review; below = unmatched) */
export const THRESHOLD_REVIEW_QUEUE = 60;

/**
 * Compute a composite confidence score for a supplier→canonical product match.
 * Returns score 0–100, status, method, and per-dimension breakdown.
 */
export function scoreSkuMatch(input: MatchInput): MatchResult {
  const breakdown: Record<string, number> = {};

  // ── 1. Name similarity (40% weight) ──────────────────────────────────────
  const nameSim = tokenSetSimilarity(
    normalise(input.supplierName),
    normalise(input.canonicalName)
  );
  breakdown.name = Math.round(nameSim * 100);

  // ── 2. Brand match (25% weight) ──────────────────────────────────────────
  const brandSim = tokenSetSimilarity(
    normalise(input.supplierBrand),
    normalise(input.canonicalBrand)
  );
  breakdown.brand = Math.round(brandSim * 100);

  // ── 3. Category match (20% weight) ───────────────────────────────────────
  const catSim = tokenSetSimilarity(
    normalise(input.supplierCategory),
    normalise(input.canonicalCategory)
  );
  breakdown.category = Math.round(catSim * 100);

  // ── 4. Pack size match (15% weight) ──────────────────────────────────────
  // Pack size mismatches are clinically significant (e.g. 50pk vs 100pk affects
  // per-unit cost comparisons). Penalise heavily when pack sizes differ.
  const packSim = packSizeSimilarity(
    input.supplierPackSize,
    input.canonicalPackSize
  );
  breakdown.packSize = Math.round(packSim * 100);

  // ── Composite score ───────────────────────────────────────────────────────
  const composite =
    breakdown.name     * 0.40 +
    breakdown.brand    * 0.25 +
    breakdown.category * 0.20 +
    breakdown.packSize * 0.15;

  const score = Math.round(composite);

  // ── Hard rules: category mismatch is a veto ──────────────────────────────
  // A match across dental categories (e.g. "Impression Materials" vs
  // "Anaesthetics") is clinically unsafe regardless of name similarity.
  const categoryVeto = catSim < 0.4 && nameSim < 0.9;

  const effectiveScore = categoryVeto ? Math.min(score, 55) : score;

  const status: MatchStatus =
    effectiveScore >= THRESHOLD_AUTO_APPROVE
      ? "approved"
      : effectiveScore >= THRESHOLD_REVIEW_QUEUE
      ? "pending_review"
      : "unmatched";

  const method =
    status === "approved"
      ? "name_fuzzy"
      : status === "pending_review"
      ? "name_fuzzy_review"
      : "unmatched";

  return { score: effectiveScore, status, method, breakdown };
}

/**
 * Returns the status bucket for a given numeric confidence score.
 * Use this when the score is already stored (e.g. re-evaluating after
 * threshold changes without re-running the full scorer).
 */
export function statusFromScore(score: number | null): MatchStatus {
  if (score === null) return "approved"; // legacy row, treat as approved
  if (score >= THRESHOLD_AUTO_APPROVE) return "approved";
  if (score >= THRESHOLD_REVIEW_QUEUE) return "pending_review";
  return "unmatched";
}

// ── String utilities ────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Token-set similarity: compare the intersection/union of word tokens.
 * More robust than raw edit distance for product name comparison where
 * word order and extra words differ between suppliers.
 */
function tokenSetSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));

  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 1;
  return intersection / union;
}

/**
 * Pack size similarity: extracts the numeric quantity and compares.
 * "50 pack", "50pk", "x50" all resolve to 50.
 * Returns 1.0 for exact match, 0.5 for same order of magnitude, 0 for mismatch.
 */
function packSizeSimilarity(a: string, b: string): number {
  const numA = extractPackSize(a);
  const numB = extractPackSize(b);

  if (numA === null || numB === null) return 0.7; // unknown — don't penalise
  if (numA === numB) return 1.0;

  // Same order of magnitude (e.g. 50 vs 60): partial credit
  const ratio = Math.min(numA, numB) / Math.max(numA, numB);
  if (ratio >= 0.8) return 0.5;

  // Completely different (e.g. 50 vs 200): clinically significant mismatch
  return 0.0;
}

function extractPackSize(s: string): number | null {
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
