# Catalog depth — minimum 2,000 priced products

**Source:** Dentago/What We Need To Implement.md
**Type:** coding
**Priority:** P0

## Task

The DS scraper got 570 real-priced products. We need to fix the scraper (the 10,407 failures are likely products with `price: 0` or nested configurable products with no base price). Aim for 2,000+ real-priced SKUs before the next demo.

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902344632.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
