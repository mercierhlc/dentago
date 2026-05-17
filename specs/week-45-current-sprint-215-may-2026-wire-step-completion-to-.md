# [Week 4–5 — Current Sprint (2–15 May 2026)] Wire step completion to real platform actions (supplier connected, first search run, savings shown)

**Source:** Dentago/365-Day Plan.md
**Type:** coding
**Priority:** P5

## Task

Context: **Status: 6-7 verified clinics live, 2 API/EDI integrations live, Henry Schein meeting 8 May** This section details the immediate sprint, updated from the CEO Review on 1 May 2026. ### Current Status — 2 May 2026 (Completed) ### P0 — Must complete before next clinic cohort **1. Onboarding Activation Checklist** (S — 1 day)

Task: Wire step completion to real platform actions (supplier connected, first search run, savings shown)

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902336651.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
