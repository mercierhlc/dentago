-- ============================================================
-- Agent Task Queue
-- Central task queue for all autonomous agents.
-- Workers claim tasks atomically to prevent double-execution.
-- Everything is logged back to the OS events table.
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  source_file text NOT NULL,          -- Which Obsidian/spec file this came from
  source_type text NOT NULL,          -- 'obsidian_todo' | 'ceo_todo' | '365_plan' | 'manual'

  -- Task definition
  title text NOT NULL,
  description text NOT NULL,
  worker_type text NOT NULL,          -- 'coding' | 'outreach' | 'general' | 'research'
  priority int NOT NULL DEFAULT 5,    -- 0=P0 critical, 1=P1, 2=P2, 5=normal

  -- Status (atomic claiming prevents double-execution)
  status text NOT NULL DEFAULT 'pending',  -- pending | claimed | in_progress | qa_review | done | failed
  claimed_by text,                    -- agent ID that claimed this task
  claimed_at timestamptz,

  -- Execution
  spec_file text,                     -- path to specs/*.md if generated
  started_at timestamptz,
  completed_at timestamptz,

  -- Output
  output_summary text,                -- agent's summary of what it did
  qa_score int,                       -- 0-100 quality score from QA agent
  qa_notes text,                      -- QA agent's review notes
  qa_passed boolean,                  -- true = done, false = needs rework

  -- Tracking
  attempt_count int NOT NULL DEFAULT 0,
  failure_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Atomic claim: only one worker can claim a pending task
-- Workers run: UPDATE agent_tasks SET status='claimed', claimed_by=<id>, claimed_at=now()
--              WHERE id = (SELECT id FROM agent_tasks WHERE status='pending' ORDER BY priority, created_at LIMIT 1)
--              RETURNING *;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks (status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_worker_type ON agent_tasks (worker_type, status);

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
-- Service role only (agents use service role key)
CREATE POLICY "service_role_agent_tasks" ON agent_tasks FOR ALL TO service_role USING (true);

-- KPI snapshots for agent system
CREATE TABLE IF NOT EXISTS agent_kpi_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at timestamptz NOT NULL DEFAULT now(),

  -- Task throughput
  tasks_total int DEFAULT 0,
  tasks_done int DEFAULT 0,
  tasks_failed int DEFAULT 0,
  tasks_in_progress int DEFAULT 0,
  tasks_pending int DEFAULT 0,

  -- Quality
  avg_qa_score numeric DEFAULT 0,
  qa_pass_rate numeric DEFAULT 0,

  -- Outreach (logged separately but aggregated here)
  outreach_sent_session int DEFAULT 0,
  outreach_replies_received int DEFAULT 0,
  reply_rate numeric DEFAULT 0,

  -- Business KPIs (read from OS state)
  clinics_total int DEFAULT 0,
  clinics_verified int DEFAULT 0,
  gmv numeric DEFAULT 0,

  -- KPI health vs targets
  kpi_status jsonb DEFAULT '{}',      -- { metric: { value, target, status: 'on_track'|'at_risk'|'critical' } }
  drift_alerts jsonb DEFAULT '[]',    -- any KPIs that have drifted from £50M path

  notes text
);

ALTER TABLE agent_kpi_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_agent_kpi_log" ON agent_kpi_log FOR ALL TO service_role USING (true);
