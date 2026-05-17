-- Persist Get Started procurement survey (dashboard /dashboard/onboarding)
ALTER TABLE public.clinic_accounts
  ADD COLUMN IF NOT EXISTS onboarding_survey jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_survey_at timestamptz;

COMMENT ON COLUMN public.clinic_accounts.onboarding_survey IS 'JSON: spend (string), pains (string[]), suppliers (string[]), chairs (string).';
COMMENT ON COLUMN public.clinic_accounts.onboarding_survey_at IS 'When onboarding_survey was last saved.';
