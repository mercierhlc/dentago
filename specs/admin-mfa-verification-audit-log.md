# Admin MFA + verification audit log

**Source:** Dentago/CEO TODOs — 1 May 2026.md
**Type:** coding
**Priority:** P0

## Task

Require MFA for all admin accounts. Log every verification action (approved / rejected / who / when / timestamp).
Why: The admin verification dashboard has no stated access controls. A compromised admin account can approve fraudulent clinic registrations, giving bad actors access to live supplier pricing across all connected practices.
Shape: Supabase Auth MFA enforcement on admin role. Append-only audit log table: `verification_audit` (admin_user_id, clinic_id, action, timestamp, notes).

## Acceptance Criteria

- The task is fully complete with no partial work
- All changes are logged via `logEvent()` from `lib/events.ts`
- No type errors (`tsc --noEmit` passes)
- If outreach: exact count of messages sent is logged to OS
- If coding: feature works end-to-end, tested manually
- Write a summary to `.agent-runs/summary-1777902330898.md`

## Context

Read CLAUDE.md before starting. The north star is £50M revenue by end of Year 2.
Every action must move Dentago closer to that goal.
Log everything to the OS at the end: POST /api/os/log-context
