# Spend analytics dashboard

**Source:** Dentago/What We Need To Implement.md
**Type:** coding
**Priority:** P1

## Task

Currently listed as P1 in the PRD but it needs to move to P0. Alara has it. It is one of the first things a practice manager will ask about: "Can I see what I've spent?" Build month-over-month spend chart, category breakdown, top products. The data is already in `dentago_orders`.

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902344729.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
