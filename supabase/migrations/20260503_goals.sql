-- Goals table — closed loop goal engine
-- Every goal is reviewed every 3 days, new approach generated if not achieved

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL, -- outreach | supplier | product | seo | distribution | ai
  status text NOT NULL DEFAULT 'active', -- active | done | abandoned
  target_outcome text NOT NULL, -- what success looks like (measurable)
  approaches jsonb NOT NULL DEFAULT '[]', -- array of approach strings tried
  last_reviewed_at timestamptz,
  next_review_at timestamptz DEFAULT now() + interval '3 days',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_goals" ON goals FOR ALL TO anon USING (false);

-- Seed initial goals
INSERT INTO goals (title, category, target_outcome, next_review_at) VALUES
-- Outreach
('Send 5000+ cold emails per day', 'outreach', '5000+ emails sent in a single day, reply rate ≥10%', now()),
('BDA (British Dental Association) partnership or mention', 'outreach', 'Featured in BDA newsletter or directory — reaches 20k+ dentists', now()),
('Dentistry.co.uk feature or guest post', 'outreach', 'Published article or directory listing on Dentistry.co.uk', now()),
('Dentinal Tubules newsletter mention', 'outreach', 'Mentioned in Dentinal Tubules newsletter (60k registered dentists)', now()),
('Amo (Smile Works) demo booked', 'outreach', 'Amo books and attends a Dentago demo', now()),

-- Supplier partnerships
('Henry Schein UK — Victoria Goodall response', 'supplier', 'Response from Victoria Goodall or Henry Schein commercial team', now()),
('Kent Express — Anthony Trombetta response', 'supplier', 'Response from Anthony Trombetta or Kent Express commercial team', now()),
('DD Group — Jon Wiltshire response', 'supplier', 'Response from Jon Wiltshire (CCO) or DD Group commercial team', now()),
('Trycare — Craig Cranfield response', 'supplier', 'Response from Craig Cranfield (GM) or Trycare commercial team', now()),
('First supplier partnership agreement signed', 'supplier', 'At least one supplier has signed a commission or partnership agreement', now()),

-- Product
('First GMV — any order placed', 'product', 'At least one real order placed and paid through Dentago', now()),
('Activate 3 clinics (full funnel)', 'product', '3 clinics have: supplier connected + search performed + order placed', now()),
('Fix /orders page — Failed to load orders', 'product', '/orders page loads correctly for all authenticated clinics', now()),
('Fix /clinic/suppliers page styling', 'product', '/clinic/suppliers matches site design system', now()),
('Open rate tracking on outreach emails', 'product', 'Open rate visible per batch in OS dashboard', now()),
('Demo CTA on search page', 'product', 'Prominent book-a-demo CTA visible on /search for non-logged-in visitors', now()),
('Fix comparison — ensure multiple suppliers per SKU', 'product', 'Products show prices from 2+ suppliers where available', now()),
('Daily refresh for supplier pricing', 'product', 'Supplier prices refresh automatically every 24h', now()),

-- SEO & Distribution
('G2 listing live', 'seo', 'Dentago listed on G2 under Dental Software or Procurement Software', now()),
('Capterra listing live', 'seo', 'Dentago listed on Capterra under Dental Software', now()),
('HealthTech UK directory listing', 'seo', 'Dentago listed in HealthTech UK startup directory', now()),
('6th blog post published', 'seo', 'Blog post published targeting NHS dental procurement keyword', now()),
('3 blog posts indexed in Google Search Console', 'seo', 'At least 3 blog posts showing impressions in Search Console', now()),

-- Distribution
('Instantly.ai domain warm-up started', 'distribution', 'Dentago.co.uk warming profile active in Instantly.ai', now()),
('Google Postmaster Tools set up', 'distribution', 'Postmaster Tools showing domain reputation data for dentago.co.uk', now())
ON CONFLICT DO NOTHING;
