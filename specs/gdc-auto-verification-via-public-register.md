# GDC auto-verification via public register

**Source:** Dentago/CEO TODOs — 1 May 2026.md
**Type:** outreach
**Priority:** P1

## Task

Automate clinic verification by checking submitted GDC registration numbers against the GDC public register. Auto-approve on match. Route to manual queue only on no-match or ambiguous results.
Why: Manual admin review of every new signup is fine at 10/week. At 50–100/week it becomes a full-time job and creates delays that destroy the onboarding experience. A clinic that signs up, uploads docs, and waits more than 24 hours for verification is a clinic that churns before ever using the product.
Shape: - On document submission, trigger a GDC register lookup by registration number
- Match found → auto-approve, send welcome email, grant full access
- No match → flag for manual review, notify admin, send "under review" email to clinic with 24hr SLA

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902331162.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
