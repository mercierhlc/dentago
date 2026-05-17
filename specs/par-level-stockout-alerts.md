# Par level + stockout alerts

**Source:** Dentago/What We Need To Implement.md
**Type:** general
**Priority:** P1

## Task

Let clinics set a par level per product. Alert them when an order hasn't been placed within their normal cycle. This is the inventory management feature that makes Dentago sticky — once a clinic is relying on Dentago to tell them when to reorder, they will not leave.

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902344824.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
