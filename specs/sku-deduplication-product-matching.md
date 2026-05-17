# SKU deduplication / product matching

**Source:** Dentago/What We Need To Implement.md
**Type:** general
**Priority:** P0

## Task

The same nitrile gloves appear under different product IDs for different suppliers. Until these are matched, the comparison table (cheapest vs. most expensive) does not work correctly and savings calculations are wrong.

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902344680.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
