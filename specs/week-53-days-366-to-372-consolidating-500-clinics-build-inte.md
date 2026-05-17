# [WEEK 53 — Days 366 to 372: Consolidating 500+ Clinics] Build internal tracker: which suppliers have agreed group rates, what %, effective date

**Source:** Dentago/365-Day Plan.md
**Type:** coding
**Priority:** P5

## Task

Context: **DAY 366 | Year 2 Begins** **DAY 367 | Clinic Activation Push** **DAY 368 | Group Purchasing Activation — Legal Gate Check** **Days 369–372: Supplier Negotiated Rates**

Task: Build internal tracker: which suppliers have agreed group rates, what %, effective date

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902339122.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
