CREATE TABLE IF NOT EXISTS site_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'expired')),
  dismissible boolean NOT NULL DEFAULT true,
  expiry_mode text NOT NULL DEFAULT 'none' CHECK (expiry_mode IN ('none', 'datetime', 'on_next')),
  expires_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_banners_status ON site_banners (status);
