# GA4 conversion tracking — key events

## Context
GA4 is already loaded in app/layout.tsx via a Script tag but no key events are being fired — showing 0 conversions in GA4. We need to track: demo bookings, signups, searches, and orders.

## Task
Add GA4 event tracking throughout the app. The GA4 measurement ID is already in layout.tsx — find it and use it.

### Events to track

1. **demo_booked** — fire when user lands on /demo page (page load = intent signal)
   - File: app/demo/page.tsx
   - gtag('event', 'demo_booked', { event_category: 'conversion' })

2. **sign_up** — fire when clinic account created successfully
   - File: app/api/leads/route.ts already logs to OS. Also add a client-side fire.
   - Find the signup success state in app/login/page.tsx or app/signup/page.tsx and fire there.

3. **search** — fire when a search is performed from the search page
   - File: app/search/page.tsx — find where results are fetched and fire:
   - gtag('event', 'search', { search_term: query })

4. **begin_checkout / purchase** — fire when an order is placed
   - File: app/cart/page.tsx or wherever the order POST is called
   - On success: gtag('event', 'purchase', { value: totalAmount, currency: 'GBP' })

### Implementation approach
- Create a helper lib/gtag.ts with typed wrappers:
  ```ts
  export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';
  export function gtagEvent(name: string, params?: Record<string, unknown>) {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', name, params);
    }
  }
  ```
- Add NEXT_PUBLIC_GA_ID to .env.local (get value from existing layout.tsx Script src)
- Use gtagEvent() in each location above

## Acceptance criteria
- lib/gtag.ts created with GA_ID + gtagEvent helper
- Events fired on: demo page load, signup success, search performed, order placed
- TypeScript compiles clean: npx tsc --noEmit
- No runtime errors if GA4 not loaded (typeof window check)
