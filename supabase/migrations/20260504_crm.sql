-- ============================================================
-- Dentago CRM — Unified Communications Layer
-- Every contact, every message, every channel in one place.
-- Email (Resend), WhatsApp (Twilio/360dialog), SMS, LinkedIn
-- ============================================================

-- contacts: one row per person, unified across all channels
CREATE TABLE IF NOT EXISTS contacts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  email            text        UNIQUE,
  name             text,
  practice_name    text,
  phone            text,
  whatsapp_id      text,         -- WhatsApp number in E.164 format: +447700900000
  linkedin_url     text,

  -- Classification
  type             text        NOT NULL DEFAULT 'lead',   -- lead | clinic | supplier | prospect | journalist | investor
  status           text        NOT NULL DEFAULT 'cold',   -- cold | warm | interested | demo_booked | client | unsubscribed | do_not_contact
  tags             text[]      DEFAULT '{}',

  -- Activity tracking
  last_contacted_at  timestamptz,
  last_replied_at    timestamptz,
  last_message_preview text,
  total_messages_sent  int DEFAULT 0,
  total_replies_received int DEFAULT 0,

  -- Context
  source           text,        -- 'outreach_batch_1' | 'google_maps' | 'companies_house' | 'manual' | 'demo_booking'
  notes            text,
  location         text,        -- city / region
  gdc_number       text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts (email);
CREATE INDEX IF NOT EXISTS contacts_status_idx ON contacts (status);
CREATE INDEX IF NOT EXISTS contacts_type_idx ON contacts (type);
CREATE INDEX IF NOT EXISTS contacts_last_contacted_idx ON contacts (last_contacted_at DESC NULLS LAST);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_contacts" ON contacts FOR ALL TO service_role USING (true);

-- messages: every single message sent or received, any channel
CREATE TABLE IF NOT EXISTS messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       uuid        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Channel + direction
  channel          text        NOT NULL,  -- email | whatsapp | sms | linkedin | note | call
  direction        text        NOT NULL,  -- outbound | inbound

  -- Content
  subject          text,
  body             text        NOT NULL,
  body_html        text,

  -- Status lifecycle
  status           text        NOT NULL DEFAULT 'sent',  -- sent | delivered | opened | clicked | replied | failed | received | read

  -- AI classification (inbound only)
  classification   text,       -- INTERESTED | NOT_NOW | WRONG_PERSON | UNSUBSCRIBE | QUESTION
  classification_confidence numeric,
  suggested_response text,

  -- Provider metadata (resend_id, whatsapp_message_id, etc.)
  metadata         jsonb       DEFAULT '{}',

  -- Timestamps
  sent_at          timestamptz DEFAULT now(),
  opened_at        timestamptz,
  replied_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_contact_id_idx ON messages (contact_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS messages_channel_idx ON messages (channel);
CREATE INDEX IF NOT EXISTS messages_direction_idx ON messages (direction);
CREATE INDEX IF NOT EXISTS messages_classification_idx ON messages (classification);
CREATE INDEX IF NOT EXISTS messages_sent_at_idx ON messages (sent_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_messages" ON messages FOR ALL TO service_role USING (true);

-- Backfill: pull existing outreach events → contacts + messages
-- Run this after creating tables to seed from existing event data

-- Step 1: Create contacts from existing outreach_reply_received events
INSERT INTO contacts (email, type, status, source, last_replied_at, created_at)
SELECT DISTINCT
  payload->>'from_email' as email,
  'lead' as type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM events e2
      WHERE e2.event_type = 'outreach_classified'
      AND e2.payload->>'from_email' = e.payload->>'from_email'
      AND e2.payload->>'classification' = 'INTERESTED'
    ) THEN 'interested'
    WHEN EXISTS (
      SELECT 1 FROM events e2
      WHERE e2.event_type = 'outreach_classified'
      AND e2.payload->>'from_email' = e.payload->>'from_email'
      AND e2.payload->>'classification' = 'UNSUBSCRIBE'
    ) THEN 'unsubscribed'
    ELSE 'warm'
  END as status,
  'resend_inbound' as source,
  MAX(e.created_at) as last_replied_at,
  MIN(e.created_at) as created_at
FROM events e
WHERE e.event_type = 'outreach_reply_received'
  AND e.payload->>'from_email' IS NOT NULL
  AND e.payload->>'from_email' != ''
GROUP BY e.payload->>'from_email'
ON CONFLICT (email) DO UPDATE SET
  last_replied_at = EXCLUDED.last_replied_at,
  status = CASE
    WHEN contacts.status = 'unsubscribed' THEN 'unsubscribed'
    ELSE EXCLUDED.status
  END;

-- Step 2: Backfill inbound messages from reply events
INSERT INTO messages (contact_id, channel, direction, subject, body, status, classification, classification_confidence, suggested_response, metadata, sent_at, created_at)
SELECT
  c.id as contact_id,
  'email' as channel,
  'inbound' as direction,
  e.payload->>'subject' as subject,
  COALESCE(e.payload->>'body_preview', '') as body,
  'received' as status,
  (SELECT e2.payload->>'classification' FROM events e2
   WHERE e2.event_type = 'outreach_classified'
   AND e2.payload->>'from_email' = e.payload->>'from_email'
   ORDER BY e2.created_at DESC LIMIT 1) as classification,
  (SELECT (e2.payload->>'confidence')::numeric FROM events e2
   WHERE e2.event_type = 'outreach_classified'
   AND e2.payload->>'from_email' = e.payload->>'from_email'
   ORDER BY e2.created_at DESC LIMIT 1) as classification_confidence,
  (SELECT e2.payload->>'suggested_response' FROM events e2
   WHERE e2.event_type = 'outreach_classified'
   AND e2.payload->>'from_email' = e.payload->>'from_email'
   ORDER BY e2.created_at DESC LIMIT 1) as suggested_response,
  jsonb_build_object('event_id', e.id, 'from', e.payload->>'from') as metadata,
  e.created_at as sent_at,
  e.created_at as created_at
FROM events e
JOIN contacts c ON c.email = e.payload->>'from_email'
WHERE e.event_type = 'outreach_reply_received'
ON CONFLICT DO NOTHING;
