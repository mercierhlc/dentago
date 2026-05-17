/**
 * Infer registrant surname for GDC register POST when admin does not pass one explicitly.
 * GDC form requires Surname — we derive a best-effort token from practice / trading name.
 */

const PREFIX = /^(dr|mr|mrs|ms|miss|prof)\.?\s+/i;

export function inferSurnameForGdcSearch(practiceName: string | null | undefined): string | null {
  if (!practiceName?.trim()) return null;
  let s = practiceName.replace(PREFIX, "").trim();
  if (!s) return null;
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1].replace(/[^a-zA-Z'-]/g, "");
  if (last.length >= 2) return last;
  if (parts.length >= 2) {
    const prev = parts[parts.length - 2].replace(/[^a-zA-Z'-]/g, "");
    if (prev.length >= 2) return prev;
  }
  return null;
}
