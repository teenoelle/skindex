-- Notifications sent to users when a product they flagged has been resolved.
CREATE TABLE product_notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  product_id  uuid        REFERENCES products(id) ON DELETE CASCADE,
  type        text        NOT NULL DEFAULT 'product_updated',
  seen_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON product_notifications (user_id, seen_at);
