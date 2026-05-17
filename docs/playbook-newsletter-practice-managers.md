# Practice-manager newsletter (technical checklist)

> **Reference only.** Following this checklist does **not** automatically satisfy newsletter-related Agents tasks — acceptance criteria still apply separately.

## Positioning

- **Audience:** UK practice managers / lead nurses (permission-based list only).
- **Cadence:** Monthly or biweekly; avoid harming cold outreach domain reputation.

## Technical (Resend)

1. Create **Audience** in Resend dashboard (`Contacts → Audiences`).
2. Add **topics** tag: `newsletter-practice-managers`.
3. Use **double opt-in** flow: landing page or signup form → confirmation email → subscribed.
4. Template IDs: store in env `RESEND_NEWSLETTER_TEMPLATE_ID` when ready.

## Content spine (issue #1)

1. One **procurement tip** (compare basket across suppliers).  
2. One **Dentago changelog** (new supplier, search tweak).  
3. One **CTA:** book demo / reply with supplier wishlist.

## Legal

- Consent trail required (GDPR); do not import cold CRM into newsletter without opt-in.

## Related `/os` items

- **Agents:** Tasks mentioning “newsletter” or “practice managers” — close only when copy + audience + consent path actually ship.
