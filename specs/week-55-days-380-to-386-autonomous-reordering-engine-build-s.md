# [WEEK 55 — Days 380 to 386: Autonomous Reordering Engine Build] Set up the `reorder_suggestions` table: clinic_id, sku_id, suggested_date, confidence_score, status

**Source:** Dentago/365-Day Plan.md
**Type:** general
**Priority:** P5

## Task

Context: **DAY 380 | Reordering Engine — Architecture**

Task: Set up the `reorder_suggestions` table: clinic_id, sku_id, suggested_date, confidence_score, status

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902339886.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
