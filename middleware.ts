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
    if (auth === 'dentago-os-2026') return NextResponse.next();

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

/** Every navigational/API hit except Next internals & favicon (massive automatic audit trail) */
export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
