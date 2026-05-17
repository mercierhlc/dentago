# [WEEK 2 — Days 8 to 14: Build Core Product] Build the full spend analytics dashboard: monthly spend trend (12 months), spend by supplier, spend by category, savings vs estimated market rate, top 10 products

**Source:** Dentago/365-Day Plan.md
**Type:** coding
**Priority:** P5

## Task

Context: Phase 2 is where Dentago stops being a soft-launch experiment and becomes a genuine UK business. You are running a proven playbook now — the product works, the value proposition is validated, and you have proof. Your job is to multiply what is already working, nail the BDA deal, close the Henry Schein commercial agreement, and build the story that raises your seed round. ### Days 91–120: UK-Wide Expansion Push **Days 91–100: Systematise Outreach** **Days 101–110: Revenue & Growth Together** **Days 111–120: Build the Analytics Layer**

Task: Build the full spend analytics dashboard: monthly spend trend (12 months), spend by supplier, spend by category, savings vs estimated market rate, top 10 products

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902332037.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
