-- Add GDC verification status to clinic_profiles
-- Values: NULL (not checked), 'queued', 'verified', 'failed'
ALTER TABLE public.clinic_profiles
  ADD COLUMN IF NOT EXISTS gdc_status text,
  ADD COLUMN IF NOT EXISTS gdc_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS gdc_verified_name text;

-- Index to make the cron queue query fast
CREATE INDEX IF NOT EXISTS idx_clinic_profiles_gdc_status ON public.clinic_profiles(gdc_status);
