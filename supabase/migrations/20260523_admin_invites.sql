CREATE TABLE IF NOT EXISTS admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_by text NOT NULL,
  expires_at timestamptz NOT NULL,
  claimed_by text,
  claimed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_invites_code ON admin_invites (code);
CREATE INDEX IF NOT EXISTS idx_admin_invites_expires ON admin_invites (expires_at);
