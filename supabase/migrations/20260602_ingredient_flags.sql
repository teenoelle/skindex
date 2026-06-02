CREATE TABLE ingredient_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  flagged_by_user_id TEXT,        -- Clerk user ID; null = anonymous
  reason TEXT,                    -- Optional free-text reason from the user
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,        -- NULL = pending admin review
  review_action TEXT              -- 'reclassify' | 'regenerate' | 'dismiss'
);

CREATE INDEX idx_ingredient_flags_ingredient ON ingredient_flags(ingredient_id);
CREATE INDEX idx_ingredient_flags_pending ON ingredient_flags(created_at DESC)
  WHERE reviewed_at IS NULL;
