# Add demo CTA to search page

## Context
Clinics are landing on the search page and browsing products but there's no clear CTA to book a demo or sign up. This is a conversion gap. Add a persistent, non-intrusive demo CTA banner.

## Task
Add a demo CTA to app/search/page.tsx. Show it only to non-logged-in users (or users with no connected suppliers).

### Design spec
- Thin banner below the search bar, above the results grid
- Text: "Want a 10-minute walkthrough? We'll show you how much your practice could save."
- CTA button: "Book a free demo" → links to https://calendly.com/rnsv/dentago-introduction
- Secondary link: "Sign up free →" → links to /signup
- Use primary purple (#6C3DE8), white text, rounded-2xl
- Dismissable: clicking X sets localStorage key 'search_demo_dismissed' = '1', hides banner
- Don't show if user is logged in AND has connected suppliers

## Acceptance criteria
- Banner visible on /search for unauthenticated or unactivated users
- "Book a free demo" links to the Calendly URL
- Dismissable with X button, persists dismiss in localStorage
- Doesn't show if clinic is fully activated (connected supplier + placed order)
- TypeScript compiles clean: npx tsc --noEmit
