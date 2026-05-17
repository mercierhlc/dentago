-- Billion Dollar OS — founder strategic workspace (optional)
-- Applies when syncing personal strategic state to Postgres via Supabase auth.
--
-- Client today uses persist key `dentago-billion-dollar-os` locally; swap to row fetch/save once wired.

CREATE TABLE IF NOT EXISTS bdo_workspace (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bdo_workspace_updated_idx ON bdo_workspace (updated_at DESC);

ALTER TABLE bdo_workspace ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bdo_workspace_select_own" ON bdo_workspace
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bdo_workspace_insert_own" ON bdo_workspace
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bdo_workspace_update_own" ON bdo_workspace
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
