CREATE TABLE product_watch (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          text        NOT NULL,
  product_id       uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unreviewed_names text[]      NOT NULL DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX ON product_watch (product_id);
