-- Enable supplier basket push on every clinic by default.
--
-- Rollout decision (2026-05-08): the push-to-supplier-basket flow is no
-- longer behind a per-clinic gate. We keep the column so future supplier
-- requests / abuse reports can let us turn it off for a single clinic
-- without redeploying, but the default is now true and every existing
-- clinic gets opted in.
--
-- The API route in app/api/clinic/push-to-basket/route.ts already gates on
-- both this column and the global PUSH_TO_BASKET_ENABLED env var. With this
-- migration applied, flipping that env var is the only thing left.

ALTER TABLE clinic_accounts
  ADD COLUMN IF NOT EXISTS basket_push_enabled boolean NOT NULL DEFAULT true;

-- Backfill: any rows that pre-date the column existing pick up the default,
-- but if the column existed before with a different default we still want
-- every existing clinic enabled. UPDATE is idempotent.
UPDATE clinic_accounts
SET basket_push_enabled = true
WHERE basket_push_enabled IS DISTINCT FROM true;

COMMENT ON COLUMN clinic_accounts.basket_push_enabled IS
  'When true, /api/clinic/push-to-basket is permitted for this clinic. Default true; flip false to revoke for a single clinic without redeploying.';
