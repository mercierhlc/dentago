# [Week 4–5 — Current Sprint (2–15 May 2026)] Test with known GDC numbers before deploying to live signups

**Source:** Dentago/365-Day Plan.md
**Type:** coding
**Priority:** P5

## Task

Context: **3. SKU Matching Accuracy Threshold + Clinical Review Queue** (M — 2–3 days) ### P1 — Before 50-clinic milestone (end of May 2026) **4. Supplier GMV Tracking** (S — 2 hours) **5. Week-4 Leading Indicator Dashboard** (S — 2–3 hours PostHog setup) **6. GDC Auto-Verification** (M — 2–3 days)

Task: Test with known GDC numbers before deploying to live signups

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902337401.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
