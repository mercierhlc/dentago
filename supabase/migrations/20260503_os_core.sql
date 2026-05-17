-- ============================================================
-- Dentago OS Core Tables
-- The OS is the single source of truth. All agents read this.
-- ============================================================

-- Context Log: every conversation, decision, and key output
-- This is how agents stay aware of what has happened across sessions
CREATE TABLE IF NOT EXISTS context_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  session_type text NOT NULL DEFAULT 'conversation', -- conversation | agent_run | cron_run
  summary text NOT NULL,                              -- what happened in this session
  decisions_made jsonb NOT NULL DEFAULT '[]',         -- array of { decision, rationale, outcome_expected }
  work_completed jsonb NOT NULL DEFAULT '[]',         -- array of { task, file_changed, result }
  open_loops jsonb NOT NULL DEFAULT '[]',             -- array of { task, blocker, next_action }
  goals_touched text[] DEFAULT '{}',                 -- goal IDs that were worked on
  outreach_count int DEFAULT 0,                       -- emails sent in this session
  source text DEFAULT 'claude_code',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE context_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_context_log" ON context_log FOR ALL TO anon USING (false);

-- Expand goals with metric-based completion and failure context
ALTER TABLE goals ADD COLUMN IF NOT EXISTS success_metric text;        -- measurable, binary: "reply rate >= 10%", "1 order placed"
ALTER TABLE goals ADD COLUMN IF NOT EXISTS failure_context jsonb NOT NULL DEFAULT '[]'; -- [{attempt, why_it_failed, context_at_time}]
ALTER TABLE goals ADD COLUMN IF NOT EXISTS metric_current numeric DEFAULT 0;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS metric_target numeric;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS priority int DEFAULT 5;     -- 1=critical, 10=low

-- OS State: structured business state that agents read
-- One row per category, upserted on every run
CREATE TABLE IF NOT EXISTS os_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text UNIQUE NOT NULL,  -- outreach | product | suppliers | kpis | strategy
  state jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE os_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_os_state" ON os_state FOR ALL TO anon USING (false);

-- Seed initial OS state
INSERT INTO os_state (category, state) VALUES
('outreach', '{
  "emails_sent_total": 4534,
  "batches_completed": 11,
  "current_reply_rate": 0,
  "target_reply_rate": 0.1,
  "domain_age_days": 10,
  "deliverability": "building - SPF/DKIM/DMARC passing",
  "current_subject": "Only open this if cutting supplies cost is a priority...",
  "next_action": "Send batch 12, monitor open rates, A/B test subject lines",
  "blockers": ["Domain reputation building - 10 day old domain", "Reply rate not yet measured"]
}'),
('product', '{
  "gmv": 0,
  "orders_placed": 0,
  "clinics_activated": 0,
  "known_bugs": [
    {"page": "/orders", "error": "Failed to load orders", "priority": "high"},
    {"page": "/clinic/suppliers", "error": "Styling does not match design system", "priority": "medium"}
  ],
  "features_needed": [
    "Demo CTA on /search for non-logged-in visitors",
    "Daily price refresh for supplier catalogue",
    "Comparison view showing 2+ suppliers per SKU"
  ],
  "suppliers_live": ["Henry Schein", "DD Group"],
  "next_action": "Fix /orders page, get first GMV"
}'),
('suppliers', '{
  "partnerships_signed": 0,
  "contacts_approached": {
    "Henry Schein": {"contact": "Victoria Goodall", "status": "emailed", "response": false},
    "Kent Express": {"contact": "Anthony Trombetta", "status": "emailed", "response": false},
    "DD Group": {"contact": "Jon Wiltshire", "status": "emailed", "response": false},
    "Trycare": {"contact": "Craig Cranfield", "status": "emailed", "response": false}
  },
  "next_action": "Follow up all 4 contacts, try LinkedIn DM if no email response"
}'),
('kpis', '{
  "clinics_total": 7,
  "clinics_verified": 2,
  "demos_held": 2,
  "demos_booked": 4,
  "gmv": 0,
  "outreach_total": 4534,
  "target_clinics_may": 50,
  "target_gmv_week": "any - first order is the goal"
}'),
('strategy', '{
  "mission": "£50M revenue by end of Year 2",
  "current_week": 3,
  "primary_focus": "outreach + first GMV",
  "rule": "When not building, do outreach. Always. Client acquisition is the default mode.",
  "closed_loop": "Every goal reviewed every 3 days. Failed goals get new approach using failure context.",
  "agent_instruction": "Read this table before doing anything. It is the source of truth."
}')
ON CONFLICT (category) DO UPDATE SET state = EXCLUDED.state, updated_at = now();

-- ============================================================
-- Operating Contract: enforce the human/agent division
-- Humans define: goals, constraints, priorities, acceptance criteria
-- Agents handle: decomposition, execution, iteration, reporting
-- ============================================================

-- Goals must have human-defined acceptance criteria
-- Agents cannot mark a goal done unless criteria is met
ALTER TABLE goals ADD COLUMN IF NOT EXISTS acceptance_criteria text;   -- human-written: exactly what "done" looks like
ALTER TABLE goals ADD COLUMN IF NOT EXISTS constraints jsonb DEFAULT '[]'; -- human-written: what agents cannot do
ALTER TABLE goals ADD COLUMN IF NOT EXISTS agent_decomposition jsonb DEFAULT '[]'; -- agent-written: subtasks derived from goal
ALTER TABLE goals ADD COLUMN IF NOT EXISTS agent_report text;           -- agent-written: last status report

-- Formal record of the operating contract
INSERT INTO os_state (category, state) VALUES
('operating_contract', '{
  "version": "1.0",
  "established": "2026-05-03",
  "human_defines": ["goals", "constraints", "priorities", "acceptance_criteria"],
  "agents_handle": ["decomposition", "execution", "iteration", "reporting"],
  "completion_rule": "A goal is done only when its acceptance_criteria is met — not when an agent thinks it is done",
  "failure_rule": "When a goal fails, agents capture failure_context and generate a new approach. Humans are notified only if a constraint is hit or human decision is required.",
  "escalation_triggers": ["supplier says no", "legal question", "product direction change", "budget decision", "hiring decision"],
  "default_mode": "When no build task is active, agents run outreach. Always."
}')
ON CONFLICT (category) DO UPDATE SET state = EXCLUDED.state, updated_at = now();
