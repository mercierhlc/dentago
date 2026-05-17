# [WEEK 2 — Days 8 to 14: Build Core Product] Build an email sequence for every new clinic that signs up but does not book a demo: Day 1 "Welcome — here's your setup guide", Day 3 "Common first questions", Day 5 "Have you placed your first order?"

**Source:** Dentago/365-Day Plan.md
**Type:** coding
**Priority:** P5

## Task

Context: ## Phase 2 — UK-Wide Traction (Days 91–180) **Goal: 350 clinics, £1M+ monthly GMV, BDA deal signed, Henry Schein deal closed** Phase 2 is where Dentago stops being a soft-launch experiment and becomes a genuine UK business. You are running a proven playbook now — the product works, the value proposition is validated, and you have proof. Your job is to multiply what is already working, nail the BDA deal, close the Henry Schein commercial agreement, and build the story that raises your seed round. ### Days 91–120: UK-Wide Expansion Push **Days 91–100: Systematise Outreach**

Task: Build an email sequence for every new clinic that signs up but does not book a demo: Day 1 "Welcome — here's your setup guide", Day 3 "Common first questions", Day 5 "Have you placed your first order?"

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902331642.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
