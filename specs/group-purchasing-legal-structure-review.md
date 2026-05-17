# Group purchasing legal structure review

**Source:** Dentago/CEO TODOs — 1 May 2026.md
**Type:** research
**Priority:** P2

## Task

Before activating group purchasing rates at 200+ clinics, get a legal review of what Dentago becomes when it acts as the contracting party for negotiated supplier rates.
Why: Becoming the contracting party for group rates transitions Dentago from a marketplace into a GPO (Group Purchasing Organisation) — a different legal and regulatory category. This may have implications for liability, supplier contract structures, and potentially FCA-adjacent considerations if payment flows change.
**Gate:** Trigger at 150 active clinics — before the 200-clinic group purchasing milestone
**Effort:** M (legal counsel engagement)
**Priority:** P2 — do not block now, but do not skip
**Status:** [ ] Not started

---

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902331294.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
