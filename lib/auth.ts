// Lightweight client-side auth helpers
// Token comes from the Supabase session (auto-refreshed) — falls back to
// dentago_token for backwards compatibility with older stored sessions.

import { supabase } from "@/lib/supabase";

const CLINIC_KEY = "dentago_clinic";
const LEGACY_TOKEN_KEY = "dentago_token";

// Single shared browser-side Supabase client — exported so other files can
// import this instead of creating a second GoTrueClient instance.
export const supabaseBrowser = typeof window !== "undefined" ? supabase : null;

export type Clinic = {
  id: string;
  clinic_name: string;
  email: string;
  /** Present after `/api/clinic/me` sync — drives Pro sidebar gates */
  product_plan?: "free" | "pro";
};

/** `sub` (auth user id) we last aligned dentago_clinic localStorage with */
let lastSyncedAuthSub: string | null = null;
let clinicSyncInFlight: Promise<void> | null = null;

function decodeJwtSub(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const payload = JSON.parse(atob(b64 + pad)) as { sub?: string };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Keep dentago_clinic in sync when JWT user changes (e.g. admin impersonation magic link). */
async function syncClinicMetadataFromSession(accessToken: string): Promise<void> {
  const sub = decodeJwtSub(accessToken);
  if (!sub || sub === lastSyncedAuthSub) return;

  const run = async () => {
    const res = await fetch("/api/clinic/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { clinic?: Clinic };
      if (body.clinic?.id) {
        localStorage.setItem(LEGACY_TOKEN_KEY, accessToken);
        localStorage.setItem(CLINIC_KEY, JSON.stringify(body.clinic));
        lastSyncedAuthSub = sub;
      }
    } else if (res.status === 404) {
      // No clinic_accounts row yet — avoid hammering the API until auth user changes
      lastSyncedAuthSub = sub;
      localStorage.removeItem(CLINIC_KEY);
    }
  };

  if (!clinicSyncInFlight) {
    clinicSyncInFlight = run().finally(() => {
      clinicSyncInFlight = null;
    });
  }
  await clinicSyncInFlight;
}

/** Returns the current access token, refreshing it via Supabase if needed. */
export async function getFreshToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (supabaseBrowser) {
    let { data: { session } } = await supabaseBrowser.auth.getSession();

    // Proactively refresh before expiry so /api/* routes don't see flaky 401s
    if (session?.refresh_token) {
      const now = Math.floor(Date.now() / 1000);
      const exp = session.expires_at;
      const expiringSoon = exp != null && exp - now < 120;
      if (!session.access_token || expiringSoon) {
        const { data: refreshed, error } = await supabaseBrowser.auth.refreshSession();
        if (!error && refreshed.session) session = refreshed.session;
      }
    }

    if (session?.access_token) {
      localStorage.setItem(LEGACY_TOKEN_KEY, session.access_token);
      await syncClinicMetadataFromSession(session.access_token);
      return session.access_token;
    }
  }
  // Fallback for sessions established before this change (may be expired — caller gets 401)
  const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacy) await syncClinicMetadataFromSession(legacy);
  return legacy;
}

/** Synchronous presence check — does NOT guarantee the token is still valid. */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LEGACY_TOKEN_KEY);
}

export function getClinic(): Clinic | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CLINIC_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, clinic: Clinic) {
  localStorage.setItem(LEGACY_TOKEN_KEY, token);
  localStorage.setItem(CLINIC_KEY, JSON.stringify(clinic));
  const sub = decodeJwtSub(token);
  if (sub) lastSyncedAuthSub = sub;
}

export async function clearAuth() {
  lastSyncedAuthSub = null;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(CLINIC_KEY);
  try {
    const { clearGetStartedSessionCache } = await import("@/lib/get-started-session-cache");
    clearGetStartedSessionCache();
  } catch {
    /* ignore */
  }
  await supabaseBrowser?.auth.signOut().catch(() => {});
}

/** Sync helper — use freshAuthHeaders() in fetch calls instead. */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Async helper — always sends a fresh, non-expired token. */
export async function freshAuthHeaders(): Promise<Record<string, string>> {
  const token = await getFreshToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
