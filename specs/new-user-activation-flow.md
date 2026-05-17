# New user activation flow

**Source:** Dentago/CEO TODOs — 1 May 2026.md
**Type:** coding
**Priority:** P0

## Task

Design and build an onboarding checklist for newly verified clinics. The dashboard currently shows nothing on first login — no order history, no savings, no guidance.
Why: This is the activation moment. Without direction, clinics sign up, get verified, log in, see an empty screen, and leave. The 10-minute onboarding promise breaks at the final step.
Shape: Three-step progress tracker visible on the dashboard until complete:
1. Connect your supplier accounts
2. Search your first product
3. See your savings

Progress-tracked. Dismissible once all three are done.

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902330762.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
