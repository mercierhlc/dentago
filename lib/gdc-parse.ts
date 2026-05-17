/**
 * Pure HTML parsing for GDC register search results — testable without network.
 */

export interface ParsedGdcPage {
  found: boolean;
  name?: string;
  status?: string;
}

export function parseGdcSearchResultHtml(
  html: string,
  registrationNumber: string,
): ParsedGdcPage {
  const reg = registrationNumber.trim();
  if (!reg) return { found: false };

  const noResults =
    /no results found/i.test(html) || /no records? (were )?found/i.test(html);
  if (noResults) return { found: false };

  if (!html.includes(reg)) return { found: false };

  let name: string | undefined;
  const nameCellMatch = html.match(
    /<td[^>]*>\s*([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,4})\s*<\/td>/,
  );
  if (nameCellMatch) name = nameCellMatch[1].trim();

  let status: string | undefined;
  const statusMatch = html.match(
    /\b(General|Specialist|Conditional|Removed|Voluntarily removed|Erased|Suspended)\b/i,
  );
  if (statusMatch) status = statusMatch[1];

  return {
    found: true,
    name: name ?? undefined,
    status: status ?? "General",
  };
}
