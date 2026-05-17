/**
 * Per-unit pricing utilities for Dentago search results.
 *
 * Extracts unit counts from product names (not pack size strings) so clinics
 * can compare cost-per-glove / cost-per-cartridge across suppliers.
 */

/**
 * Extract the unit quantity from a product name.
 *
 * Examples:
 *   "Cranberry Nitrile Gloves Large 100"   → 100
 *   "Septanest 4% Articaine 50 x 1.7ml"   → 50
 *   "Disposable Cups Pack of 50"           → 50
 *   "3M ESPE Filtek 20 x 0.2g Capsules"   → 20
 *
 * Strategy: collect all integer tokens that are plausibly unit counts
 * (between 10 and 1000, not percentages, not concentrations) and return
 * the largest one — "50 x 1.7ml" gives [50], "100 Nitrile" gives [100].
 *
 * Returns null if no suitable number is found.
 */
export function extractUnitCount(productName: string): number | null {
  if (!productName) return null;

  const candidates: number[] = [];

  // Match patterns like "50 x", "x 50", "pack of 50", standalone integers
  // Exclude numbers followed by % (concentrations) or ml/mg/g (weights/volumes)
  const patterns = [
    /pack\s+of\s+(\d+)/i,
    /(\d+)\s*[x×]\s/i,   // "50 x 1.7ml" — capture the multiplier
    /\s[x×]\s*(\d+)/i,   // "x 50"
    /\b(\d+)\b/g,         // any standalone integer
  ];

  // Named patterns first (priority)
  for (let i = 0; i < patterns.length - 1; i++) {
    const m = productName.match(patterns[i]);
    if (m) {
      const n = parseInt(m[1]);
      if (n >= 10 && n <= 1000 && isValidUnitCount(productName, m[0], n)) {
        candidates.push(n);
      }
    }
  }

  // Fallback: all bare integers in the name
  const allIntegers = productName.matchAll(/\b(\d+)\b/g);
  for (const m of allIntegers) {
    const n = parseInt(m[1]);
    if (n >= 10 && n <= 1000 && isValidUnitCount(productName, m[0], n)) {
      candidates.push(n);
    }
  }

  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

/**
 * Reject numbers that look like concentrations / decimals / percentages.
 * E.g. "4%" or "1.7ml" context around a number disqualifies it.
 */
function isValidUnitCount(name: string, match: string, _n: number): boolean {
  // Find position of the match and check surrounding characters
  const idx = name.indexOf(match.trim());
  if (idx === -1) return true;

  const after = name.slice(idx + match.trim().length).trimStart();
  // Discard if followed by %, ml, mg, g, kg, mm, cm, litre, L, %
  if (/^(%|ml|mg\b|g\b|kg\b|mm\b|cm\b|litre|ltr\b|\bL\b)/i.test(after)) return false;

  // Discard if preceded by decimal point (part of a float like "1.7")
  const before = name.slice(0, idx);
  if (/\.\s*$/.test(before)) return false;

  return true;
}

/**
 * Calculate per-unit price.
 */
export function perUnitPrice(totalPrice: number, unitCount: number): number {
  return totalPrice / unitCount;
}

/**
 * Format per-unit price for display.
 *
 * Uses contextual unit label based on product name keywords.
 * Falls back to "unit".
 *
 * Examples:
 *   (0.42, "Nitrile Gloves 100") → "£0.42/glove"
 *   (2.14, "Septanest Articaine 50 x 1.7ml") → "£2.14/cartridge"
 *   (0.08, "Disposable Cups 50") → "£0.08/cup"
 */
export function formatPerUnit(price: number, productName: string): string {
  const label = unitLabel(productName);
  if (price < 1) {
    return `${(price * 100).toFixed(1)}p/${label}`;
  }
  return `£${price.toFixed(2)}/${label}`;
}

function unitLabel(productName: string): string {
  const n = productName.toLowerCase();
  if (/glove/.test(n)) return "glove";
  if (/cartridge|articaine|lidocaine|prilocaine|mepivacaine|septanest|citanest|scandonest/.test(n)) return "cartridge";
  if (/mask/.test(n)) return "mask";
  if (/cup/.test(n)) return "cup";
  if (/wipe/.test(n)) return "wipe";
  if (/capsule/.test(n)) return "capsule";
  if (/file/.test(n)) return "file";
  if (/syringe/.test(n)) return "syringe";
  if (/bib|napkin/.test(n)) return "bib";
  if (/needle/.test(n)) return "needle";
  if (/bracket/.test(n)) return "bracket";
  return "unit";
}
