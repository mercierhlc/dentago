-- Live OS markdown: served via GET /api/os/live-doc/[slug] so founder/agents can update
-- copy in Supabase without redeploying Next.js. Code in app/os still ships with deploys.

CREATE TABLE IF NOT EXISTS os_live_documents (
  slug text PRIMARY KEY,
  body_md text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE os_live_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_os_live_documents" ON os_live_documents FOR ALL TO anon USING (false);

COMMENT ON TABLE os_live_documents IS 'Live markdown for /os (doctrine, notices). Empty row = API falls back to public/os/*.md in bundle.';
