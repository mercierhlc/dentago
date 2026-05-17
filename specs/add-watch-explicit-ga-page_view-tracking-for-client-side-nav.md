# Add /watch explicit GA page_view tracking for client-side navigation

**Source:** Dentago/Reports/Analytics — 4 Apr to 1 May 2026.md
**Type:** coding
**Priority:** P1

## Task

Add /watch explicit GA page_view tracking for client-side navigation

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902346117.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
