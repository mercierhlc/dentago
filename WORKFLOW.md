# Dentago Agent Workflow — Baseline Standard

## The Rule: Work Week by Week, In Order

Every agent — coding, outreach, research, general — works through goals and tasks in strict week order.  
**Week 1 before Week 2. Week 2 before Week 3. Never skip ahead.**

This is non-negotiable. The weekly plan was built for a reason. Each week's work unlocks the next week's work. Jumping to Week 10 tasks when Week 3 isn't done creates orphaned features, untested flows, and compounding debt.

---

## Why This Matters

- Week 1–4 = foundation (product live, first clinics, first supplier)
- Week 5–12 = traction (50 clinics, first GMV, reply rate ≥10%)
- Week 13–26 = growth (paid acquisition, supplier partnerships signed)
- Week 27–52 = scale (£100k/month, team, Series A)
- Week 53–65 = £50M (UK market leader, European expansion)

If Week 3 tasks aren't done, Week 10 tasks are meaningless.

---

## Agent Claiming Rules

1. **Always claim the lowest-week pending task available for your type**
2. **Complete it fully before moving on** — no partial work, no skipping
3. **If a task can't be completed** (missing credentials, blocked by another task), mark it failed with a clear reason and move to the next one
4. **Log everything** — every action, every file touched, every API called → `POST /api/os/log-context`
5. **QA bar is 70/100** — if your output scores below 70, it comes back to you with rework instructions

---

## What "Complete" Means

A task is complete when:
- [ ] The deliverable exists (code shipped, email sent, research written)
- [ ] It has been tested (feature works, email delivered, data verified)
- [ ] It is logged to the OS (`POST /api/os/log-context` with work_completed)
- [ ] No regressions — `tsc --noEmit` passes if you touched code
- [ ] A summary is written to `.agent-runs/summary-{task-id}.md`

Partial work = failed task. Do it properly or don't start it.

---

## The Queue

Tasks and goals are stored in Supabase with `priority = week number`.  
The orchestrator always claims `ORDER BY priority ASC` — so week 1 runs before week 2.

To check current state:
```bash
npx tsx scripts/check-tasks.ts
```

To restart agents:
```bash
cd ~/dentago && npx tsx scripts/agent-orchestrator.ts --parallel 3
```

To keep running continuously:
```bash
cd ~/dentago && while true; do npx tsx scripts/agent-orchestrator.ts --parallel 3; sleep 10; done
```

---

## OS Integration (Required for Every Task)

Every agent reads the OS at the start of its session:
```
GET https://www.dentago.co.uk/api/os/state
```

Every agent logs at the end:
```bash
curl -X POST https://www.dentago.co.uk/api/os/log-context \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "What you did in one sentence",
    "decisions_made": [{"decision": "...", "rationale": "..."}],
    "work_completed": [{"task": "task title", "result": "what was built/sent/written"}],
    "open_loops": [{"task": "...", "blocker": "...", "next_action": "..."}],
    "outreach_count": 0
  }'
```

The OS is the single source of truth. If it's not in the OS, it didn't happen.

---

## North Star

**£50M revenue by end of Year 2.**

Every task is evaluated against this. If completing a task doesn't move Dentago toward £50M, it should not be in the queue. QA agents score every output on `£50M alignment` — tasks that don't move the needle fail regardless of technical quality.

Current state (Week 3–4):
- ~7 clinics signed, ~2 verified
- £0 GMV — first order is the #1 priority
- Reply rate ~0% — target ≥10%
- Domain warming in progress

---

## Strategic Objectives (Non-Negotiable)

These are the objectives every agent works towards. Every task must serve at least one of these.

### Yearly (Year 1)
1. 1,000 verified clinics on Dentago
2. £6M ARR projected for Year 2 (must be on track by end of Year 1)
3. £3M/month GMV run rate

### Quarterly (Q2 2026)
1. 100 verified clinics signed
2. £50K GMV — first real revenue
3. 3 supplier partnerships signed with commission agreements

### Monthly (May 2026)
1. 50 verified clinics — minimum viable distribution
2. First paying order placed (any value)
3. Reply rate ≥ 10% on cold outreach

### This Week (Week 3–4)
1. Fix clinic activation flow end-to-end
2. Send 500+ targeted outreach emails
3. Book 2 more demos

---

## The OS Mandate

**EVERYTHING must go through the OS. No exceptions.**

- Every action taken → `POST /api/os/log-context`
- Every file created → log it
- Every email sent → log it with count
- Every decision made → log it with rationale
- If it's not in the OS, it didn't happen

The OS is at: `https://www.dentago.co.uk/api/os/log-context`

---

## Attempt Limit

Agents try a task **maximum 2 times**. If it fails twice:
- Mark `status = 'failed'` with a clear `failure_reason`
- Do NOT retry — flag it for human review
- Move to the next task

This prevents agents burning through tokens on unwinnable tasks.

---

*This file is the baseline. All agents read it. All agents follow it. No exceptions.*
