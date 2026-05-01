-- Run once in Supabase SQL editor:
-- https://app.supabase.com/project/wybqjycfpauwlcrqgtfb/sql

CREATE TABLE IF NOT EXISTS leads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  practice    text        NOT NULL,
  email       text        NOT NULL,
  phone       text,
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookup by email
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (email);

-- RLS: no anon/authenticated policies — inserts only via API (service_role bypasses RLS).
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON leads;
