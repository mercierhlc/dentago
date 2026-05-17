# Supplier portal v1

**Source:** Dentago/What We Need To Implement.md
**Type:** coding
**Priority:** P2

## Task

Suppliers need to see orders placed through Dentago and manage their catalog. Without this, no supplier will formalise a relationship. Build a read-only order dashboard first, then add catalog management. This is what converts the informal scraping relationship into a formal partnership.

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902344919.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
