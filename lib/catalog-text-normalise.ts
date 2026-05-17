/**
 * UK catalogue copy normalisation — removes pointless spelling drift on colours
 * so "Gray" / "Grey" / "Color" / "Colour" do not split matching or display.
 */

const COLOUR_SPELLING_REPLACEMENTS: [RegExp, string][] = [
  [/\bcolours\b/gi, "colours"],
  [/\bcolors\b/gi, "colours"],
  [/\bcolor\b/gi, "colour"],
  [/\bgrays\b/gi, "greys"],
  [/\bgray\b/gi, "grey"],
  [/\baluminum\b/gi, "aluminium"],
  [/\bodorless\b/gi, "odourless"],
  [/\bfiber\b/gi, "fibre"],
  [/\bfibers\b/gi, "fibres"],
];

/**
 * Normalise common US→UK spellings in a product title (and similar free text).
 * Idempotent enough for repeated runs; does not strip actual shade names like "Acid Red".
 */
export function normaliseUkColourSpellingInProductText(text: string): string {
  let s = text.normalize("NFKC").replace(/\s+/g, " ").trim();
  for (const [re, rep] of COLOUR_SPELLING_REPLACEMENTS) {
    s = s.replace(re, rep);
  }
  return s.replace(/\s+/g, " ").trim();
}
