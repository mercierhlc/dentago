export interface ClinicalEquivalent {
  canonical: string;        // what we match against
  equivalents: string[];    // search terms for equivalent products
  category: string;         // e.g. "Local Anaesthetic", "Nitrile Gloves"
  equivalence_note: string; // e.g. "Same active ingredient, different brand"
  confidence: "high" | "medium"; // high = direct equivalent, medium = category equivalent
}

export const CLINICAL_EQUIVALENTS: ClinicalEquivalent[] = [
  {
    canonical: "septanest articaine",
    equivalents: ["citanest prilocaine", "scandonest mepivacaine", "xylestesin lidocaine"],
    category: "Local Anaesthetic",
    equivalence_note: "Same class (local anaesthetic), different active ingredient — check clinical suitability",
    confidence: "medium",
  },
  {
    canonical: "cranberry nitrile",
    equivalents: ["aurelia nitrile", "medicom nitrile", "sempercare nitrile"],
    category: "Examination Gloves",
    equivalence_note: "Same material (nitrile), different brand — direct equivalent",
    confidence: "high",
  },
  {
    canonical: "protaper gold",
    equivalents: ["waveone gold", "reciproc blue", "hyflex edm"],
    category: "Rotary Files",
    equivalence_note: "Same category (NiTi rotary files), verify clinical suitability with dentist",
    confidence: "medium",
  },
  {
    canonical: "filtek z250",
    equivalents: ["filtek z350", "tetric evoceram", "charisma diamond"],
    category: "Composite Resin",
    equivalence_note: "Same category (posterior composite), shade matching required",
    confidence: "medium",
  },
  {
    canonical: "optim 33 wipes",
    equivalents: ["clinell wipes", "tristel wipes", "PDI wipes"],
    category: "Surface Disinfectant",
    equivalence_note: "Same category (surface disinfectant wipes), check contact time requirements",
    confidence: "medium",
  },
  {
    canonical: "type iir face mask",
    equivalents: ["type ii face mask", "ffp2 mask", "ffp3 mask"],
    category: "PPE",
    equivalence_note: "Check local IPC guidelines before substituting mask type",
    confidence: "medium",
  },
];

/**
 * Given a search query, find a matching ClinicalEquivalent entry.
 * Matches if the query contains any word from the canonical field.
 * Returns null if no match found.
 */
export function findEquivalents(query: string): ClinicalEquivalent | null {
  if (!query) return null;
  const lowerQuery = query.toLowerCase();

  for (const entry of CLINICAL_EQUIVALENTS) {
    const canonicalWords = entry.canonical.toLowerCase().split(/\s+/);
    const hasMatch = canonicalWords.some(word => lowerQuery.includes(word));
    if (hasMatch) return entry;
  }

  return null;
}
