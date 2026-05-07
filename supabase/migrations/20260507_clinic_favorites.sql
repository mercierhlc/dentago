-- Clinic product favorites: one-tap reorder starting point
CREATE TABLE IF NOT EXISTS clinic_favorites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL REFERENCES clinic_accounts(id) ON DELETE CASCADE,
  product_id      integer NOT NULL REFERENCES dentago_products(id) ON DELETE CASCADE,
  preferred_supplier_name text,          -- last supplier used / preferred
  preferred_price numeric(10,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, product_id)
);

CREATE INDEX IF NOT EXISTS clinic_favorites_clinic_idx ON clinic_favorites(clinic_id);

ALTER TABLE clinic_favorites ENABLE ROW LEVEL SECURITY;

-- Clinics can only see/modify their own favorites
CREATE POLICY "clinic_favorites_self" ON clinic_favorites
  USING (
    clinic_id = (
      SELECT id FROM clinic_accounts
      WHERE auth_user_id = auth.uid()
    )
  );
