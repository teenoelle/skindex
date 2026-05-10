-- Junction table linking products to their recognized DB ingredients.
-- Enables efficient reverse queries: "find products by ingredient."
-- Only DB-recognized ingredients are linked; unreviewed tokens are skipped.
--
-- Run this in the Supabase SQL editor, then:
--   node scripts/populate-product-ingredients.mjs

CREATE TABLE IF NOT EXISTS product_ingredients (
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  position      integer, -- 1-based position in the ingredient list
  PRIMARY KEY (product_id, ingredient_id)
);

-- Fast reverse lookup: "which products contain ingredient X?"
CREATE INDEX IF NOT EXISTS product_ingredients_ingredient_idx
  ON product_ingredients (ingredient_id);
