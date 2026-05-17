# SKU deduplication — same product from multiple suppliers resolves to one card with a comparison table

**Source:** Dentago/Reports/2026-04 April Monthly Report.md
**Type:** general
**Priority:** P1

## Task

SKU deduplication — same product from multiple suppliers resolves to one card with a comparison table

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902345131.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
