/**
 * Server-side admin authentication guard.
 *
 * Every /api/admin/* route must call requireAdminAuth(request) and return 401
 * if it throws or returns a non-null Response.
 *
 * The admin secret is stored in ADMIN_SECRET env var (never shipped to the client).
 * The browser receives an httpOnly `admin-auth` cookie set by POST /api/admin/session after Supabase sign-in.
 *
 * **Local dev:** if ADMIN_SECRET is unset and NODE_ENV is not `production`, a fixed
 * dev fallback is used so `/admin` works without copying prod secrets. Set
 * ADMIN_SECRET in `.env.local` to match production behaviour.
 *
 * MFA note: Supabase Auth TOTP MFA should also be enforced at the project level
 * (Authentication → MFA → "Required for all users with admin role") so that the
 * admin Supabase account itself requires a second factor before the session is
 * granted. This code layer guards the API routes independently of that.
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_SECRET_DEV_FALLBACK,
  getEffectiveAdminSecret,
} from '@/lib/admin-secret-env';

export { ADMIN_SECRET_DEV_FALLBACK, getEffectiveAdminSecret };

export function getAdminSecret(): string {
  const s = getEffectiveAdminSecret();
  if (!s) throw new Error('ADMIN_SECRET env var not set (required in production)');
  return s;
}

/** Who may call POST /api/admin/session. Override with ADMIN_ALLOWED_EMAILS (comma-separated). */
export function isAllowedAdminEmail(email: string | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  if (normalized === "mercier@dentago.co.uk") return true;
  const raw = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  if (raw) {
    const allowed = raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return allowed.includes(normalized);
  }
  return normalized.endsWith("@dentago.co.uk");
}

/**
 * Returns null if the request is authenticated, or a 401 NextResponse if not.
 * Usage:
 *   const unauth = requireAdminAuth(request);
 *   if (unauth) return unauth;
 */
export function requireAdminAuth(request: NextRequest | Request): NextResponse | null {
  const secret = getEffectiveAdminSecret();
  if (!secret) {
    console.error('[admin-auth] ADMIN_SECRET not configured (production requires ADMIN_SECRET)');
    return NextResponse.json({ error: 'Admin not configured' }, { status: 500 });
  }

  // Accept cookie (browser) or Authorization header (scripts/API clients)
  let token: string | undefined;

  if (request instanceof NextRequest) {
    token = request.cookies.get('admin-auth')?.value;
  } else {
    const cookieHeader = request.headers.get('cookie') ?? '';
    const match = cookieHeader.match(/admin-auth=([^;]+)/);
    token = match?.[1];
  }

  if (!token) {
    const authHeader = request.headers.get('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) token = authHeader.slice(7);
  }

  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

/** Must match `os-auth` cookie value set in `app/api/os/auth/route.ts`. */
function expectedOsSessionCookieValue(): string {
  return "dentago-os-8a76d2a0";
}

function getCookieFromRequest(request: NextRequest | Request, name: string): string | undefined {
  if (request instanceof NextRequest) {
    return request.cookies.get(name)?.value;
  }
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1];
}

/** True when the request has a valid Dentago OS dashboard session (same cookie as /os middleware). */
export function isOsDashboardSession(request: NextRequest | Request): boolean {
  return getCookieFromRequest(request, "os-auth") === expectedOsSessionCookieValue();
}

/**
 * Internal tools used from both `/admin` (Supabase admin cookie) and `/os` (OS password cookie).
 * Checks OS session first so founder can use OS without a separate admin session.
 */
export function requireAdminOrOsAuth(request: NextRequest | Request): NextResponse | null {
  if (isOsDashboardSession(request)) return null;
  return requireAdminAuth(request);
}

/**
 * Extract a best-effort admin identifier for audit logging.
 * In the current password-only setup this returns 'admin'.
 * When Supabase Auth is wired up, replace with the session user id.
 */
export function getAdminIdentifier(_request: Request | NextRequest): string {
  return 'admin';
}
