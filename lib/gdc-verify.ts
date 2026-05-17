/**
 * GDC Register auto-verification
 *
 * The GDC (General Dental Council) exposes a public register search at
 * https://olr.gdc-uk.org/SearchRegister/SearchResult
 *
 * We POST with form-encoded body { RegistrationNumber, Surname } and parse
 * the HTML response. If the register returns a matching row we extract the
 * registrant name and status.
 *
 * This function NEVER throws — on any network or parse error it returns
 * { found: false }.
 */

import { parseGdcSearchResultHtml } from "@/lib/gdc-parse";

export interface GdcVerifyResult {
  found: boolean;
  name?: string;
  status?: string;
  registrationNumber?: string;
}

const GDC_SEARCH_URL = "https://olr.gdc-uk.org/SearchRegister/SearchResult";

/**
 * Verify a GDC registration number against the public GDC online register.
 *
 * @param registrationNumber  e.g. "123456"
 * @param surname             Dentist's surname — required by the GDC form
 */
export async function verifyGdcRegistration(
  registrationNumber: string,
  surname: string
): Promise<GdcVerifyResult> {
  try {
    const body = new URLSearchParams({
      RegistrationNumber: registrationNumber.trim(),
      Surname: surname.trim(),
    });

    const response = await fetch(GDC_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Mimic a real browser so the server doesn't reject the bot
        "User-Agent":
          "Mozilla/5.0 (compatible; Dentago-GDC-Verify/1.0; +https://www.dentago.co.uk)",
        Accept: "text/html,application/xhtml+xml",
      },
      body: body.toString(),
      // 10-second timeout
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(
        `[gdc-verify] HTTP ${response.status} for registration ${registrationNumber}`
      );
      return { found: false };
    }

    const html = await response.text();
    const parsed = parseGdcSearchResultHtml(html, registrationNumber);
    if (!parsed.found) return { found: false };

    return {
      found: true,
      name: parsed.name,
      status: parsed.status,
      registrationNumber,
    };
  } catch (err) {
    console.error("[gdc-verify] verifyGdcRegistration error:", err);
    return { found: false };
  }
}
