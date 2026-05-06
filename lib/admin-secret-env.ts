/**
 * Edge-safe resolution of ADMIN_SECRET (middleware must not import next/server helpers).
 */

export const ADMIN_SECRET_DEV_FALLBACK = "dentago-admin-2024";

let warnedDevFallback = false;

export function getEffectiveAdminSecret(): string | null {
  const raw = process.env.ADMIN_SECRET;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed.length > 0) return trimmed;
  if (process.env.NODE_ENV !== "production") {
    if (!warnedDevFallback) {
      warnedDevFallback = true;
      console.warn(
        `[admin-auth] ADMIN_SECRET unset — using dev-only fallback "${ADMIN_SECRET_DEV_FALLBACK}". ` +
          "Set ADMIN_SECRET in .env.local to mirror production."
      );
    }
    return ADMIN_SECRET_DEV_FALLBACK;
  }
  return null;
}
