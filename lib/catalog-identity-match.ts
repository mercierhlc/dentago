/**
 * Rules for suggesting that two dentago_products rows are the same marketplace item
 * across suppliers. Used by catalog-identity-agent + admin review UI.
 *
 * Hard gate: same brand identity key (NFKC + trim + collapsed spaces, case-insensitive).
 * If brands differ after normalisation → never a match.
 *
 * Name: token Jaccard on normalised titles + Sørensen–Dice on character bigrams,
 * blended (suggestions from ~50%+ combined score). Distinguishing-token conflict flags
 * ambiguous pack counts / shade codes / sizes for review.
 */

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "for", "in", "to", "with", "by", "from",
  "pack", "box", "bag", "kit", "set", "unit", "units", "each", "per", "ml", "mg", "g", "mm", "cm", "l",
  "standard", "sterile", "dental", "grade", "quality", "professional", "product", "item", "uk",
]);

export function catalogBrandIdentityKey(brand: string): string {
  try {
    return brand
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  } catch {
    return brand.trim().replace(/\s+/g, " ").toLowerCase();
  }
}

export function brandsMatchForCatalogIdentity(a: string, b: string): boolean {
  const ka = catalogBrandIdentityKey(a);
  const kb = catalogBrandIdentityKey(b);
  if (!ka || !kb) return false;
  return ka === kb;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b0+(\d)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenise(name: string): Set<string> {
  return new Set(
    normalise(name)
      .split(" ")
      .filter((t) => {
        if (!t || STOP.has(t)) return false;
        if (/^\d+$/.test(t)) return true;
        if (/^[a-z]\d+$/i.test(t)) return true;
        if (/^(xs|s|m|l|xl|xxl)$/i.test(t)) return true;
        return t.length >= 2;
      }),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function distinguishingTokens(tokens: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    if (/^\d+$/.test(t)) out.add(t);
    else if (/^\d+(ml|mm|cm|g|mg|l|kg|oz)$/i.test(t)) out.add(t);
    else if (/^[a-z]\d{1,2}$/i.test(t) && t.length <= 4) out.add(t);
    else if (/^(xs|s|m|l|xl|xxl)$/i.test(t)) out.add(t);
  }
  return out;
}

function sameClass(a: string, b: string): boolean {
  const cls = (t: string) =>
    /^\d+$/.test(t)
      ? "num"
      : /^\d+(ml|mm|cm|g|mg|l|kg|oz)$/i.test(t)
        ? t.replace(/^\d+/, "#")
        : /^[a-z]\d{1,2}$/i.test(t) && t.length <= 4
          ? t[0].toUpperCase() + "#"
          : /^(xs|s|m|l|xl|xxl)$/i.test(t)
            ? "size"
            : "other";
  return cls(a) === cls(b);
}

function distinguishingConflict(a: Set<string>, b: Set<string>): boolean {
  const da = distinguishingTokens(a);
  const db = distinguishingTokens(b);

  for (const t of da) {
    if (!db.has(t)) {
      if ([...db].some((t2) => sameClass(t, t2) && t2 !== t)) return true;
    }
  }
  for (const t of db) {
    if (!da.has(t)) {
      if ([...da].some((t2) => sameClass(t, t2) && t2 !== t)) return true;
    }
  }

  const isSize = (t: string) => /^(xs|s|m|l|xl|xxl)$/i.test(t);
  const isCode = (t: string) => /^[a-z]\d{1,2}$/i.test(t) && t.length <= 4;
  for (const t of da) {
    if (isSize(t) && !db.has(t)) return true;
    if (isCode(t) && !db.has(t)) return true;
  }
  for (const t of db) {
    if (isSize(t) && !da.has(t)) return true;
    if (isCode(t) && !da.has(t)) return true;
  }

  return false;
}

/** Remove leading brand tokens from product title so "Septodont Septanest" vs "Septanest" align. */
export function stripBrandPrefixFromName(name: string, brand: string): string {
  const n = name.normalize("NFKC").trim();
  const b = brand.normalize("NFKC").trim();
  if (!b) return n;
  const lower = n.toLowerCase();
  const brandLower = b.toLowerCase();
  if (lower.startsWith(brandLower)) {
    return n.slice(b.length).replace(/^[\s\-–—:]+/, "").trim() || n;
  }
  const brandTokens = brandLower.split(/\s+/).filter(Boolean);
  const nameTokens = n.split(/\s+/);
  let i = 0;
  for (; i < brandTokens.length && i < nameTokens.length; i++) {
    if (nameTokens[i].toLowerCase() !== brandTokens[i]) break;
  }
  if (i === brandTokens.length && i > 0) {
    return nameTokens.slice(i).join(" ").trim() || n;
  }
  return n;
}

function bigrams(s: string): Map<string, number> {
  const x = s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const m = new Map<string, number>();
  if (x.length < 2) return m;
  for (let i = 0; i < x.length - 1; i++) {
    const g = x.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Sørensen–Dice coefficient on character bigram multisets. */
function diceBigram(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const [g, ca] of A) {
    const cb = B.get(g) ?? 0;
    inter += Math.min(ca, cb);
  }
  const sumA = [...A.values()].reduce((s, v) => s + v, 0);
  const sumB = [...B.values()].reduce((s, v) => s + v, 0);
  return (2 * inter) / (sumA + sumB);
}

export type CatalogIdentityNameScore = {
  /** 0–1 combined similarity */
  score: number;
  /** True when size / count / shade tokens disagree — do not auto-suggest */
  distinguishingConflict: boolean;
  tokenJaccardFull: number;
  tokenJaccardStripped: number;
  dice: number;
};

/** Minimum combined name similarity (0–1) to emit a suggestion. */
const MIN_SCORE = 0.5;
/** At or above this (and no conflict) → confidence_tier `high`. */
const HIGH_TIER = 0.8;

/**
 * Compare two product titles given the same brand already matched.
 * Returns null if below MIN_SCORE (no suggestion).
 */
export function scoreCatalogIdentityNamePair(
  nameA: string,
  brandA: string,
  nameB: string,
  brandB: string,
): CatalogIdentityNameScore | null {
  const ta = tokenise(nameA);
  const tb = tokenise(nameB);
  const sa = stripBrandPrefixFromName(nameA, brandA);
  const sb = stripBrandPrefixFromName(nameB, brandB);
  const tas = tokenise(sa);
  const tbs = tokenise(sb);

  const jFull = jaccard(ta, tb);
  const jStrip = jaccard(tas, tbs);
  const tokenPart = Math.max(jFull, jStrip);
  const dice = diceBigram(normalise(nameA), normalise(nameB));
  const score = Math.min(1, 0.62 * tokenPart + 0.38 * dice);

  const conflict = distinguishingConflict(ta, tb) || distinguishingConflict(tas, tbs);
  if (score < MIN_SCORE) return null;

  return {
    score: Math.round(score * 10000) / 10000,
    distinguishingConflict: conflict,
    tokenJaccardFull: Math.round(jFull * 10000) / 10000,
    tokenJaccardStripped: Math.round(jStrip * 10000) / 10000,
    dice: Math.round(dice * 10000) / 10000,
  };
}

export function catalogIdentityConfidenceTier(score: number, conflict: boolean): "high" | "medium" {
  if (conflict) return "medium";
  if (score >= HIGH_TIER) return "high";
  return "medium";
}
