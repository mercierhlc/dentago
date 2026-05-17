# Autonomous reordering engine

**Source:** Dentago/CEO TODOs — 1 May 2026.md
**Type:** coding
**Priority:** P1

## Task

Build pattern detection on order history to surface one-tap reorder confirmations, progressing to fully automated placement with notification only.
Why: This is the retention moat. Once a clinic has 3 months of order history and autonomous reordering running, they cannot leave without rebuilding their procurement system from scratch.
**Gate:** Two hard prerequisites before building:
1. Order placement must be live (cannot automate what you cannot execute manually)
2. Smart Reorder Reminders (P1 feature) must be live and showing engagement data
Shape: Cron job reading `order_items` history → pattern detection (minimum order count + frequency threshold + SKU consistency) → notification queue → one-tap confirm → auto-place

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902331345.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
