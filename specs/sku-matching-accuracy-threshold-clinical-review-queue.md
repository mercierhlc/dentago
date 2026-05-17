# SKU matching accuracy threshold + clinical review queue

**Source:** Dentago/CEO TODOs — 1 May 2026.md
**Type:** research
**Priority:** P0

## Task

Define a confidence threshold for product matching. Matches below threshold go to a manual review queue before appearing in savings comparisons.
Why: A wrong SKU match shows a practice "savings" on what turns out to be a different product. At minimum this erodes trust. At worst it contributes to a clinical incident (wrong material, wrong specification ordered).
Shape: - Fuzzy match score above X% = auto-approved, shown in search
- Match score between Y–X% = queued for manual clinical review
- Below Y% = not matched, shown as separate products
- Admin panel: simple review queue with approve/reject + reason

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902330961.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
