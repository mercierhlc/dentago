// Lightweight client-side auth helpers
// Token comes from the Supabase session (auto-refreshed) — falls back to
// dentago_token for backwards compatibility with older stored sessions.

import { createClient } from "@supabase/supabase-js";

const CLINIC_KEY = "dentago_clinic";
const LEGACY_TOKEN_KEY = "dentago_token";

// Browser-side Supabase client — used only for session/token access
const supabaseBrowser =
  typeof window !== "undefined"
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : null;

export type Clinic = {
  id: string;
  clinic_name: string;
  email: string;
};

/** Returns the current access token, refreshing it via Supabase if needed. */
export async function getFreshToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (supabaseBrowser) {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (session?.access_token) {
      // Keep legacy key in sync so getToken() (sync) is usable for presence checks
      localStorage.setItem(LEGACY_TOKEN_KEY, session.access_token);
      return session.access_token;
    }
  }
  // Fallback for sessions established before this change
  return localStorage.getItem(LEGACY_TOKEN_KEY);
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
}

export function clearAuth() {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(CLINIC_KEY);
  supabaseBrowser?.auth.signOut().catch(() => {});
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
