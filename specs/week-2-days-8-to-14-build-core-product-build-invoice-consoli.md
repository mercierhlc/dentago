# [WEEK 2 — Days 8 to 14: Build Core Product] Build invoice consolidation: clinics receive one Dentago invoice covering all their supplier orders, paid by GoCardless direct debit

**Source:** Dentago/365-Day Plan.md
**Type:** coding
**Priority:** P5

## Task

Context: **Goal: 1,000+ clinics, £3M+ monthly GMV, £45K+ MRR from supplier fees** Phase 4 is the execution of the seed round capital. Two hires are now active, paid acquisition is running, the BDA partnership is generating inbound, and your job shifts from doing everything yourself to building systems that scale without you doing every task manually. The year ends with 1,000+ active UK clinics and a clear path to the UK scale figure of £6–7M ARR at 1,000 clinics (Year 3–4). ### Days 271–300: New Team Velocity **Days 271–285: Handoff to New Hires** **Days 286–300: Product Phase 2 Features**

Task: Build invoice consolidation: clinics receive one Dentago invoice covering all their supplier orders, paid by GoCardless direct debit

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902335177.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
