/**
 * Cross-supplier SKU deduplication
 *
 * Compares products by name similarity using token-set overlap.
 * Pairs with >70% token overlap are returned as potential matches.
 */

export interface SkuMatchCandidate {
  productA_id: number;
  productB_id: number;
  confidence: number;  // 0–1
  reason: string;
}

interface Product {
  id: number;
  name: string;
  supplier_id: number;
}

/** Lowercase and strip punctuation, return token set */
function tokenise(name: string): Set<string> {
  const normalised = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return new Set(normalised.split(" ").filter(Boolean));
}

/** Jaccard / token-set overlap: intersection / union */
function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const tok of a) {
    if (b.has(tok)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Compare all products and return pairs with >70% name token overlap.
 * Only cross-supplier pairs are returned (same supplier duplicates are
 * handled separately during ingest).
 */
export function findSkuMatches(products: Product[]): SkuMatchCandidate[] {
  const results: SkuMatchCandidate[] = [];

  // Pre-tokenise once
  const tokenised = products.map((p) => ({
    product: p,
    tokens: tokenise(p.name),
  }));

  for (let i = 0; i < tokenised.length; i++) {
    for (let j = i + 1; j < tokenised.length; j++) {
      const a = tokenised[i];
      const b = tokenised[j];

      // Only compare cross-supplier pairs
      if (a.product.supplier_id === b.product.supplier_id) continue;

      const confidence = tokenOverlap(a.tokens, b.tokens);
      if (confidence > 0.7) {
        results.push({
          productA_id: a.product.id,
          productB_id: b.product.id,
          confidence: Math.round(confidence * 1000) / 1000,
          reason: `name token overlap ${Math.round(confidence * 100)}%`,
        });
      }
    }
  }

  return results;
}
