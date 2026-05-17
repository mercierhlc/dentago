-- Dentago Free vs Pro — drives sidebar gates + onboarding Pro track
ALTER TABLE public.clinic_accounts
  ADD COLUMN IF NOT EXISTS product_plan text NOT NULL DEFAULT 'free';

COMMENT ON COLUMN public.clinic_accounts.product_plan IS
  'free | pro — clinic product tier for feature gating. Default free; pro for paid tier.';
