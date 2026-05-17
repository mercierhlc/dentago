-- Workspace notes: every Obsidian note migrated into the OS
CREATE TABLE IF NOT EXISTS workspace_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  category text NOT NULL,
  subcategory text,
  source_path text NOT NULL UNIQUE,
  tags text[] DEFAULT '{}',
  word_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_notes_category ON workspace_notes(category);
CREATE INDEX IF NOT EXISTS workspace_notes_updated ON workspace_notes(updated_at DESC);

ALTER TABLE workspace_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_workspace" ON workspace_notes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
