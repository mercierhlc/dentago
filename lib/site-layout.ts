/**
 * Marketplace URL when entering from public marketing nav (home, navbar, footer).
 * `AppSidebarLayout` reads `sb=0`, collapses the clinic sidebar, persists preference, then strips the param.
 */
export const MARKETPLACE_HREF_FROM_MARKETING = "/search?sb=0";

/** Fixed chrome heights — keep Navbar + scroll offsets in sync. */
export const SITE_ANNOUNCE_BAR_HEIGHT_PX = 43;
export const SITE_NAV_BAR_HEIGHT_PX = 58;
export const SITE_FIXED_HEADER_TOTAL_PX = SITE_ANNOUNCE_BAR_HEIGHT_PX + SITE_NAV_BAR_HEIGHT_PX;
/** Visible gap below fixed chrome when aligning hash / programmatic scroll targets */
export const SITE_HEADER_SCROLL_GAP_PX = 28;
/** Scroll offset = chrome height + gap (used by /platform hash scroll + scroll-margin) */
export const SITE_HEADER_SCROLL_MARGIN_PX = SITE_FIXED_HEADER_TOTAL_PX + SITE_HEADER_SCROLL_GAP_PX;
/** Dark marketing heroes (e.g. Dentago Pro) — slightly more air than scroll gap for the eyebrow line */
export const SITE_MARKETING_HERO_TOP_PAD_PX = SITE_FIXED_HEADER_TOTAL_PX + 44;

/** Reads measured announce height from `--dentago-announce-px` (set by Navbar) + nav + gap. */
export function getSiteHeaderScrollOffsetPx(): number {
  if (typeof document === "undefined") return SITE_HEADER_SCROLL_MARGIN_PX;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--dentago-announce-px").trim();
  const announce = raw ? Number.parseFloat(raw) || SITE_ANNOUNCE_BAR_HEIGHT_PX : SITE_ANNOUNCE_BAR_HEIGHT_PX;
  return announce + SITE_NAV_BAR_HEIGHT_PX + SITE_HEADER_SCROLL_GAP_PX;
}
