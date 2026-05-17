# Supplier account connection flow

**Source:** Dentago/What We Need To Implement.md
**Type:** coding
**Priority:** P0

## Task

Build the UI and backend for clinics to connect their existing supplier accounts. Start with Henry Schein (largest UK supplier). Even a simple credential store + manual price sync is better than nothing. This changes savings data from estimated to real. Without this, the savings calculator is a liability.

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902344580.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
