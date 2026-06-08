CREATE TABLE suspected_duplicates (
  product_a_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_b_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  similarity float NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_a_id, product_b_id),
  CONSTRAINT ordered_ids CHECK (product_a_id < product_b_id)
);

CREATE INDEX ON suspected_duplicates (status);
CREATE INDEX ON suspected_duplicates (product_b_id);

-- Finds same-brand products with Jaccard ingredient similarity >= 0.85 and
-- upserts them into suspected_duplicates. Call after product_ingredients are linked.
-- Does not overwrite the status of previously dismissed pairs.
CREATE OR REPLACE FUNCTION find_duplicates_for_product(target_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  target_brand text;
  target_size  bigint;
BEGIN
  -- Only run for approved, non-archived products
  IF NOT EXISTS (
    SELECT 1 FROM products
    WHERE id = target_id
      AND (is_pending  IS NULL OR is_pending  = false)
      AND (is_archived IS NULL OR is_archived = false)
  ) THEN
    RETURN;
  END IF;

  SELECT brand INTO target_brand FROM products WHERE id = target_id;
  SELECT COUNT(*) INTO target_size FROM product_ingredients WHERE product_id = target_id;

  IF target_brand IS NULL OR target_size = 0 THEN
    RETURN;
  END IF;

  INSERT INTO suspected_duplicates (product_a_id, product_b_id, similarity)
  SELECT
    LEAST(target_id,    candidate_id),
    GREATEST(target_id, candidate_id),
    intersection_size::float / (target_size + candidate_size - intersection_size)
  FROM (
    SELECT
      p.id AS candidate_id,
      COUNT(shared.ingredient_id)                                  AS intersection_size,
      (SELECT COUNT(*) FROM product_ingredients WHERE product_id = p.id) AS candidate_size
    FROM products p
    JOIN product_ingredients shared
      ON  shared.product_id   = p.id
      AND shared.ingredient_id IN (
            SELECT ingredient_id FROM product_ingredients WHERE product_id = target_id
          )
    WHERE p.brand   = target_brand
      AND p.id     != target_id
      AND (p.is_archived IS NULL OR p.is_archived = false)
      AND (p.is_pending  IS NULL OR p.is_pending  = false)
    GROUP BY p.id
  ) candidates
  WHERE intersection_size::float / (target_size + candidate_size - intersection_size) >= 0.85
  ON CONFLICT (product_a_id, product_b_id)
  DO UPDATE SET
    similarity = EXCLUDED.similarity,
    created_at = now();
    -- status intentionally not updated: dismissed pairs stay dismissed
END;
$$;
