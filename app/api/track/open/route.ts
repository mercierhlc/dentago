/**
 * Email open tracking pixel
 * Injected into outreach emails as: <img src="https://www.dentago.co.uk/api/track/open?e=EMAIL&b=BATCH" />
 * Returns a 1x1 transparent GIF, logs open event to OS
 */

import { NextResponse } from 'next/server';
import { logEvent } from '@/lib/events';

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('e') ?? '';
  const batch = searchParams.get('b') ?? 'unknown';
  const ua = request.headers.get('user-agent') ?? '';

  // Skip bot/preview opens (email clients pre-fetch images)
  const isBot = /bot|preview|prefetch|outlook|thunderbird/i.test(ua);

  if (email && !isBot) {
    // Fire and forget — don't block the pixel response
    logEvent({
      event_type: 'outreach_opened',
      entity_type: 'outreach',
      entity_id: email.toLowerCase(),
      payload: { email: email.toLowerCase(), batch, user_agent: ua.slice(0, 200) },
      metrics: { open: 1 },
      source: 'email_pixel',
    }).catch(() => {});
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}
