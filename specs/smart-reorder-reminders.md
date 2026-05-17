# Smart reorder reminders

**Source:** Dentago/What We Need To Implement.md
**Type:** coding
**Priority:** P1

## Task

Pull order history, detect frequency per product, surface "You usually order [item] every 3 weeks — last ordered 22 days ago." This is one email trigger + one dashboard card. Not a complex build. Alara's "predictive ordering" sounds more sophisticated but this covers 80% of the value.

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902344777.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
