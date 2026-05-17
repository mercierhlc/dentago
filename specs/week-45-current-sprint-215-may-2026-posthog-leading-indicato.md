# [Week 4–5 — Current Sprint (2–15 May 2026)] PostHog leading indicator dashboard: set up 4-metric dashboard — (1) daily signups, (2) verification rate, (3) days to first search from verification approval, (4) 14-day second-order rate

**Source:** Dentago/365-Day Plan.md
**Type:** research
**Priority:** P5

## Task

Context: **2. Admin MFA + Verification Audit Log** (S — half day) **3. SKU Matching Accuracy Threshold + Clinical Review Queue** (M — 2–3 days) ### P1 — Before 50-clinic milestone (end of May 2026) **4. Supplier GMV Tracking** (S — 2 hours) **5. Week-4 Leading Indicator Dashboard** (S — 2–3 hours PostHog setup)

Task: PostHog leading indicator dashboard: set up 4-metric dashboard — (1) daily signups, (2) verification rate, (3) days to first search from verification approval, (4) 14-day second-order rate

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902337123.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
