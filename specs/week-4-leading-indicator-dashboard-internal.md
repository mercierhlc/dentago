# Week-4 leading indicator dashboard (internal)

**Source:** Dentago/CEO TODOs — 1 May 2026.md
**Type:** research
**Priority:** P1

## Task

A simple internal PostHog dashboard tracking four metrics from day one of real users:
Why: The PRD's KPIs (D60 retention, NPS, active clinics at M3) are lagging indicators. By the time you know you've failed them, you've lost 60+ days. These four numbers tell you within 30 days whether the acquisition and activation machine is working. If metric 4 is below 50%, something is broken — you need to know in week 4, not at the D60 checkpoint.
**Effort:** S (2–3 hours PostHog setup)
**Priority:** P1 — must be running from first real user
**Status:** [ ] Not started

---

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902331092.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
