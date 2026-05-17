# Supplier GMV tracking (internal)

**Source:** Dentago/CEO TODOs — 1 May 2026.md
**Type:** coding
**Priority:** P1

## Task

Log `supplier_id` + `order_value` on every cart conversion or order placed. Build a simple internal dashboard showing GMV directed to each supplier per week/month.
Why: This is the primary sales asset for supplier monetisation conversations. In the Henry Schein meeting and every supplier conversation after it, the number you need is: "We've directed £X to your competitors this month. Here's what you're missing." Without logging this from day one, you'll have nothing concrete to show.
Shape: PostHog event (`order_placed`, properties: `supplier_id`, `gmv`, `clinic_id`) + simple Supabase query or PostHog dashboard. 30-minute build.

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902331028.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
