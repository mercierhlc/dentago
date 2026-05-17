-- Explicit cold-marketing suppression (admin + automation). Queryable in /os CRM.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS marketing_opt_out boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS contacts_marketing_opt_out_idx ON contacts (marketing_opt_out) WHERE marketing_opt_out = true;
