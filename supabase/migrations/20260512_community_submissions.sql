-- Track who submitted community products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS submitted_by text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- Reports table for "Inaccurate Info" submissions
CREATE TABLE IF NOT EXISTS product_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);
