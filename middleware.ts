import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getEffectiveAdminSecret } from '@/lib/admin-secret-env';
import { scheduleUniversalHttpActionLog } from '@/lib/http-action-middleware';

/** Passed on supported runtimes (e.g. Vercel) so logging fetch completes after response */
type MiddlewareCtx = { waitUntil?: (promise: Promise<unknown>) => void };

export function middleware(request: NextRequest, ctx?: MiddlewareCtx) {
  scheduleUniversalHttpActionLog(request, ctx);

  /** Trailing slashes break exact matches for public admin pages and can cause redirect loops. */
  const pathname = request.nextUrl.pathname.replace(/\/+$/, '') || '/';

  // ── OS routes ──────────────────────────────────────────────────────────────
  if (pathname === '/os/login' || pathname === '/api/os/auth') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/os') || pathname.startsWith('/api/os') || pathname.startsWith('/api/intelligence')) {
    const auth = request.cookies.get('os-auth')?.value;
    if (auth === 'dentago-os-8a76d2a0') return NextResponse.next();

    const loginUrl = new URL('/os/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Admin routes ───────────────────────────────────────────────────────────
  /** Bootstrap cookie after Supabase sign-in — caller has no admin-auth yet */
  if (pathname === '/api/admin/session' && (request.method === 'POST' || request.method === 'OPTIONS')) {
    return NextResponse.next();
  }

  /** Pages where users authenticate — must NOT require admin-auth or we redirect-loop /admin/login → /admin/login */
  const isAdminPublicPage =
    pathname === '/admin' ||
    pathname === '/admin/login' ||
    pathname.startsWith('/admin/login/');

  /** Legacy static signup — canonical flow is App Router `/signup` */
  if (pathname === '/onboarding/step1.html') {
    return NextResponse.redirect(new URL('/signup', request.url));
  }

  if (pathname === '/signup' && request.nextUrl.searchParams.get('finish') === '1') {
    return NextResponse.redirect(new URL('/signup/finish', request.url));
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const adminSecret = getEffectiveAdminSecret();
    if (adminSecret) {
      if (pathname.startsWith('/admin') && isAdminPublicPage) {
        return NextResponse.next();
      }
      const cookie = request.cookies.get('admin-auth')?.value;
      if (cookie !== adminSecret) {
        if (pathname.startsWith('/api/admin')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

/**
 * Run middleware on app routes only — not on `/_next/*` (chunks, data, HMR) or common static files.
 * Skipping `/_next/` avoids edge work on every asset request (major latency win in dev + prod).
 */
export const config = {
  matcher: [
    '/',
    '/((?!_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?|txt|xml|map)$).*)',
  ],
};
