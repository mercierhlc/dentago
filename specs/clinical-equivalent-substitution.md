# Clinical equivalent substitution

**Source:** Dentago/What We Need To Implement.md
**Type:** general
**Priority:** P1

## Task

When a product is out of stock or unavailable, suggest alternatives in the same category with matching specs. The product DB already has categories. Start with a simple rule: same category + similar price range = suggested equivalent. Alara does this with AI; we can start with rules.

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902344873.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
