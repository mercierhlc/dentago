// Lightweight client-side auth helpers using localStorage

const TOKEN_KEY = "dentago_token";
const CLINIC_KEY = "dentago_clinic";

export type Clinic = {
  id: string;
  clinic_name: string;
  email: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
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
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CLINIC_KEY, JSON.stringify(clinic));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CLINIC_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
