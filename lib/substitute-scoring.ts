/**
 * Clinical Equivalent Substitution — scoring logic
 *
 * Pure functions: no I/O, no Supabase — fully unit-testable.
 *
 * Scoring strategy (additive, out of 100):
 *   40 pts — same category (required; cross-category substitutes are never returned)
 *   15 pts — same subcategory (extracted from specs: Type / Form / Application label)
 *   20 pts — same brand (shares material spec baseline, clinically preferred)
 *   20 pts — same material type extracted from specs
 *   (pack size bonus: reserved for future use, spec not reliably populated yet)
 *
 * Only products that:
 *   (a) belong to the same category as the source product, AND
 *   (b) have at least one in-stock supplier row
 * are ever passed to this scorer. Cross-category products are excluded
 * by the caller before scoring, guaranteeing the 40-point floor.
 */

export interface SpecEntry {
  label: string;
  value: string;
}

export interface SourceProduct {
  id: number;
  category: string;
  brand: string | null;
  specs: SpecEntry[] | null;
}

export interface CandidateProduct {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  image: string;
  pack_size: string | null;
  specs: SpecEntry[] | null;
  /** Pre-filtered: only in-stock supplier rows */
  inStockPrices: number[];
}

export interface ScoredSubstitute {
  id: number;
  name: string;
  brand: string;
  category: string;
  image: string;
  packSize: string;
  bestPrice: number | null;
  sameBrand: boolean;
  material: string | null;
  /** Composite clinical equivalence score (0–100) */
  score: number;
}

/** Extract material value from a specs array (case-insensitive label match). */
export function extractMaterial(specs: SpecEntry[] | null): string | null {
  if (!specs) return null;
  const entry = specs.find(s =>
    s.label.toLowerCase().includes("material") ||
    s.label.toLowerCase().includes("composition")
  );
  return entry?.value ?? null;
}

/**
 * Extract subcategory signal from a specs array.
 * Matches spec labels: "Type", "Form", "Application", "Subcategory", "Sub-category".
 * Returns the value normalised to lowercase, or null if not found.
 */
export function extractSubcategory(specs: SpecEntry[] | null): string | null {
  if (!specs) return null;
  const SUBCATEGORY_LABELS = ["type", "form", "application", "subcategory", "sub-category", "product type"];
  const entry = specs.find(s =>
    SUBCATEGORY_LABELS.some(label => s.label.toLowerCase().trim() === label)
  );
  return entry ? entry.value.trim().toLowerCase() : null;
}

/** Parse pack size to a numeric quantity (e.g. "50 gloves" → 50, "1 box" → 1). */
function parsePackSize(ps: string | null): number | null {
  if (!ps) return null;
  const m = ps.match(/\d+/);
  return m ? parseInt(m[0]) : null;
}

/**
 * Score a single candidate against the source product.
 * Assumes the candidate is already in the same category.
 * Returns a score in [40, 95].
 *
 * Breakdown:
 *   40 pts — same category (base, caller guarantees this)
 *   15 pts — same subcategory (Type/Form/Application spec)
 *   20 pts — same brand
 *   20 pts — same material type
 */
export function scoreCandidate(
  source: SourceProduct,
  candidate: CandidateProduct
): number {
  let score = 40; // base: same category (caller guarantees this)

  // Same subcategory (+15) — extracted from Type/Form/Application spec
  const sourceSubcategory = extractSubcategory(source.specs);
  const candidateSubcategory = extractSubcategory(candidate.specs);
  if (
    sourceSubcategory &&
    candidateSubcategory &&
    sourceSubcategory === candidateSubcategory
  ) {
    score += 15;
  }

  // Same brand (+20)
  const sameBrand =
    !!source.brand &&
    !!candidate.brand &&
    source.brand.trim().toLowerCase() === candidate.brand.trim().toLowerCase();
  if (sameBrand) score += 20;

  // Same material type (+20)
  const sourceMaterial = extractMaterial(source.specs);
  const candidateMaterial = extractMaterial(candidate.specs);
  if (
    sourceMaterial &&
    candidateMaterial &&
    sourceMaterial.trim().toLowerCase() === candidateMaterial.trim().toLowerCase()
  ) {
    score += 20;
  }

  // Pack size: reserved for future use (source pack_size not passed into scorer yet)
  void parsePackSize;

  return Math.min(score, 100);
}

/**
 * Rank and filter candidates for a given source product.
 *
 * Guarantees:
 *   - Cross-category products are never returned (enforced here + by caller query)
 *   - In-stock products only (caller pre-filters)
 *   - Source product and its variations are excluded (caller pre-filters)
 *
 * Returns candidates sorted by score desc, then bestPrice asc.
 */
export function rankSubstitutes(
  source: SourceProduct,
  candidates: CandidateProduct[],
  limit: number = 6
): ScoredSubstitute[] {
  const results: ScoredSubstitute[] = candidates
    // Final safety net: exclude cross-category (redundant with DB query, but defensive)
    .filter(c => c.category === source.category)
    .map(c => {
      const score = scoreCandidate(source, c);
      const bestPrice = c.inStockPrices.length ? Math.min(...c.inStockPrices) : null;
      const sameBrand =
        !!source.brand &&
        !!c.brand &&
        source.brand.trim().toLowerCase() === c.brand.trim().toLowerCase();

      return {
        id: c.id,
        name: c.name,
        brand: c.brand ?? "",
        category: c.category,
        image: c.image,
        packSize: c.pack_size ?? "",
        bestPrice,
        sameBrand,
        material: extractMaterial(c.specs),
        score,
      };
    });

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = a.bestPrice ?? Infinity;
    const pb = b.bestPrice ?? Infinity;
    return pa - pb;
  });

  return results.slice(0, limit);
}
