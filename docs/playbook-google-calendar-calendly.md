# Calendar sync & demos (Calendly / Google)

> **Reference only.** Keeping this playbook updated does **not** close Approvals items or Agent tasks — execution still happens in calendar tooling + `/os` Approvals.

## Recommendation

**Defer full “Calendar MCP” integration** until Postmaster + first GMV are stable. Calendly already emails ICS and can sync natively to Google Calendar per organizer settings.

## If you prioritize sync this month

1. **Fast path:** In Calendly → **Calendar connection** → connect the founder Google account used for bookings. No OAuth app required.
2. **Automation path:** Zapier/Make webhook on `invitee.created` → Google Calendar API (`calendar.events.insert`). Cost ~£15–30/mo; clearer audit trail than experimental MCP.
3. **MCP path:** Google Workspace MCP needs OAuth consent screen + restricted scopes (`calendar.events`). Budget half a day for consent review + token storage (encrypted env / Vault). Not justified before first paying orders.

## Blockers to resolve elsewhere

- Which mailbox “owns” Calendly notifications vs clinic-facing hello@.
- Whether demos must appear on a shared company calendar vs personal.

## Related `/os` items

- **Approvals:** “Founder · Google Calendar / Calendly depth”
- **Agents:** Anything mentioning Calendar MCP, Calendly, or Google sync — completing docs ≠ completing those rows.

## Next action

Choose **native Calendly ↔ Google** now; revisit MCP when supplier onboarding automation shares the same OAuth infrastructure.
