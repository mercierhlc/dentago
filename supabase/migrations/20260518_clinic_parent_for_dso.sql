-- DSO v0: optional parent clinic self-reference (one hub account, many sites later).
ALTER TABLE public.clinic_accounts
  ADD COLUMN IF NOT EXISTS parent_clinic_id uuid REFERENCES public.clinic_accounts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_accounts_parent_clinic_id
  ON public.clinic_accounts (parent_clinic_id)
  WHERE parent_clinic_id IS NOT NULL;
