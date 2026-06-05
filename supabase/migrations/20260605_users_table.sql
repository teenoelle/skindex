CREATE TABLE users (
  clerk_id        text        PRIMARY KEY,
  email           text,
  name            text,
  image_url       text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  synced_at       timestamptz DEFAULT now()
);

CREATE INDEX ON users (email);
