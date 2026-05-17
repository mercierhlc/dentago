# [Week 4–5 — Current Sprint (2–15 May 2026)] Build onboarding activation checklist: 3-step dashboard progress tracker visible to every newly verified clinic until all three steps are complete: (1) Connect your supplier accounts, (2) Search your first product, (3) See your savings

**Source:** Dentago/365-Day Plan.md
**Type:** coding
**Priority:** P5

## Task

Context: **Status: 6-7 verified clinics live, 2 API/EDI integrations live, Henry Schein meeting 8 May** This section details the immediate sprint, updated from the CEO Review on 1 May 2026. ### Current Status — 2 May 2026 (Completed) ### P0 — Must complete before next clinic cohort **1. Onboarding Activation Checklist** (S — 1 day)

Task: Build onboarding activation checklist: 3-step dashboard progress tracker visible to every newly verified clinic until all three steps are complete: (1) Connect your supplier accounts, (2) Search your first product, (3) See your savings

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902336560.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
