-- Idempotent Resend→CRM sync: one row per Resend outbound email ID
ALTER TABLE messages ADD COLUMN IF NOT EXISTS resend_email_id text;
CREATE UNIQUE INDEX IF NOT EXISTS messages_resend_email_id_key
  ON messages (resend_email_id)
  WHERE resend_email_id IS NOT NULL;
