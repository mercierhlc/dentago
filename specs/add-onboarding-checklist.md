# Add clinic onboarding checklist to dashboard

## Context
Dentago is a B2B dental procurement marketplace. Clinics sign up, connect their supplier accounts, then search and order. Currently after signup there is no onboarding flow — clinics land on a dashboard with no clear next steps, leading to low activation.

## Task
Add an onboarding checklist component to the clinic dashboard that tracks these 3 activation steps:
1. ✅ Account created (always done — show as ticked)
2. Connect at least one supplier (check clinic_suppliers table for clinic_id)
3. Browse products / run first search (check events table for search_performed or product_viewed)

## Implementation notes
- Read existing dashboard at app/(clinic)/dashboard/page.tsx (or similar path — find it)
- Add a card component following the existing Tailwind + shadcn/ui design (primary purple: #6C3DE8)
- The checklist should disappear once all 3 steps are completed (or show a "You're all set!" state)
- Fetch completion status via a new GET /api/clinic/onboarding-status route
- The route should check:
  - supplier connected: SELECT count(*) FROM clinic_suppliers WHERE clinic_id = $1
  - first search: SELECT count(*) FROM events WHERE entity_id = $1 AND event_type IN ('search_performed', 'product_viewed')
- Log a clinic_activated event when all 3 steps are first completed
- Use logEvent() from lib/events.ts for the clinic_activated event

## Acceptance criteria
- Checklist visible on dashboard for new clinics
- Each step shows green checkmark when complete
- Disappears or shows success state when all 3 done
- clinic_activated event fires exactly once (first time all 3 complete)
- TypeScript compiles clean (npx tsc --noEmit)
