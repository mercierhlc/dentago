# [Week 4–5 — Current Sprint (2–15 May 2026)] SKU matching confidence threshold + clinical review queue: define fuzzy match score above X% = auto-approved, Y–X% = manual clinical review queue, below Y% = not matched

**Source:** Dentago/365-Day Plan.md
**Type:** research
**Priority:** P5

## Task

Context: ### Current Status — 2 May 2026 (Completed) ### P0 — Must complete before next clinic cohort **1. Onboarding Activation Checklist** (S — 1 day) **2. Admin MFA + Verification Audit Log** (S — half day) **3. SKU Matching Accuracy Threshold + Clinical Review Queue** (M — 2–3 days)

Task: SKU matching confidence threshold + clinical review queue: define fuzzy match score above X% = auto-approved, Y–X% = manual clinical review queue, below Y% = not matched

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902336840.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
