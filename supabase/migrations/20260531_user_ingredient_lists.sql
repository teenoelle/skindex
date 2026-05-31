-- User-created ingredient lists (avoid / want), synced across devices per Clerk user.
CREATE TABLE user_ingredient_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  name        text        NOT NULL,
  type        text        CHECK (type IN ('avoid', 'want')),
  items       text[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX ON user_ingredient_lists (user_id, created_at);
