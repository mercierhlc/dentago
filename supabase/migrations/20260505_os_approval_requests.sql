-- Queued questions / approvals for founder review from the /os dashboard.

CREATE TABLE IF NOT EXISTS os_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  question_text text NOT NULL,
  proposed_action text,
  context_json jsonb NOT NULL DEFAULT '{}',
  created_by text NOT NULL DEFAULT 'agent',
  status text NOT NULL DEFAULT 'pending',
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT os_approval_requests_status_chk CHECK (
    status IN ('pending', 'approved', 'rejected', 'resolved')
  )
);

CREATE INDEX IF NOT EXISTS idx_os_approval_requests_status_created
  ON os_approval_requests (status, created_at DESC);

COMMENT ON TABLE os_approval_requests IS 'Founder approval queue for agents — /os Approvals tab';

ALTER TABLE os_approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_os_approval_requests" ON os_approval_requests;
CREATE POLICY "deny_all_os_approval_requests" ON os_approval_requests
  FOR ALL TO anon USING (false);
