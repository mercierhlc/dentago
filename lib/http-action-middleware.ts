/**
 * Edge-safe HTTP → Supabase `events` row (no CRON_SECRET hop).
 * Used from middleware only.
 */

import type { NextRequest } from "next/server";

export type MiddlewareWaitUntil = { waitUntil?: (promise: Promise<unknown>) => void };

function truncateSearch(search: string, max: number): string | undefined {
  if (!search) return undefined;
  return search.length <= max ? search : `${search.slice(0, max - 1)}…`;
}

/** Skip logging only when it would recurse or spam the OS reader itself */
export function shouldSkipUniversalHttpLog(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  // Reading the timeline would append one row per poll forever
  if (request.method === "GET" && pathname === "/api/os/events") return true;
  return false;
}

/**
 * Default: only record API traffic + mutating requests — avoids a Supabase insert on every
 * HTML/RSC navigation (was dominating edge latency and DB write volume).
 * Set OS_HTTP_LOG_ALL=1 to restore verbose logging (document GETs too).
 */
export function shouldRecordUniversalHttpAction(request: NextRequest): boolean {
  if (process.env.OS_HTTP_LOG_ALL === "1") return true;
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) return true;
  if (request.method !== "GET" && request.method !== "HEAD") return true;
  return false;
}

function schedulePromise(ctx: MiddlewareWaitUntil | undefined, promise: Promise<unknown>) {
  if (ctx?.waitUntil) {
    ctx.waitUntil(promise);
  } else {
    void promise;
  }
}

/**
 * Insert `http_action` directly via PostgREST (service role).
 * Fails silently — never blocks the user request.
 */
export function scheduleUniversalHttpActionLog(request: NextRequest, ctx?: MiddlewareWaitUntil) {
  if (shouldSkipUniversalHttpLog(request)) return;
  if (!shouldRecordUniversalHttpAction(request)) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  const pathname = request.nextUrl.pathname;
  const payload = {
    method: request.method,
    pathname,
    search: truncateSearch(request.nextUrl.search ?? "", 900),
    phase: "request" as const,
    request_id: crypto.randomUUID(),
    host: request.headers.get("host") ?? undefined,
    cf_ray: request.headers.get("cf-ray") ?? undefined,
  };

  const row = {
    event_type: "http_action",
    entity_type: null as string | null,
    entity_id: null as string | null,
    payload,
    metrics: {} as Record<string, unknown>,
    kpi_impact: {} as Record<string, unknown>,
    source: "edge_middleware",
    session_id: null as string | null,
  };

  const promise = fetch(`${supabaseUrl}/rest/v1/events`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  }).catch(() => {});

  schedulePromise(ctx, promise);
}
