/**
 * Labels for sibling SKUs on the product page (sizes, shades, pack formats).
 */

export function variationDisplayLabel(p: {
  name: string;
  pack_size: string;
  specs: unknown;
}): string {
  const specs = Array.isArray(p.specs) ? p.specs : [];
  for (const entry of specs as { label?: string; value?: string }[]) {
    const lbl = entry.label?.trim() ?? "";
    const val = entry.value?.trim();
    if (!val) continue;
    if (/^(shade|size|colour|color)$/i.test(lbl)) return val;
  }
  const pk = p.pack_size?.trim();
  if (pk) return pk;
  return p.name.length > 52 ? `${p.name.slice(0, 49)}…` : p.name;
}
