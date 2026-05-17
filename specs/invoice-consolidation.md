# Invoice consolidation

**Source:** Dentago/What We Need To Implement.md
**Type:** coding
**Priority:** P2

## Task

Dentago pays all suppliers, clinics pay Dentago once. This is the feature that makes Dentago genuinely indispensable and is the natural unlock for monetisation via float/credit. Wellplaece does this. It is a P2 build but a P0 commercial priority for supplier partnership conversations.

---

## 6. Where Dentago genuinely has an edge (be honest about what it is and isn't)

**Real edge:**
- GDC verification is built and works. US competitors do not do this. UK suppliers care about it.
- UK-native from day one. Alara cannot serve UK clinics. That window is open *right now* and will not stay open forever.
- The My Savings history page is a differentiator if the underlying data becomes trustworthy.

**Claimed edge that is not yet real:**
- DSO suite — does not exist
- AI procurement layer — does

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902345022.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
