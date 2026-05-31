-- Fix "1,2-Hexanediol" that was split into "1" + "2-Hexanediol" by the old comma parser.
--
-- Correct ingredient id: d27ded49-1518-47ea-bbbb-826f9bd7b62f  (1,2-Hexanediol)
-- Bogus ingredient ids:  f08c6a10-f7fb-42ab-aade-c8f7d9529ec3  (2-Hexanediol)
--                        eb675c2b-0ac2-4fff-b501-047b80bdacdb  (2 -Hexanediol)

-- 1. Fix the 5 products whose stored ingredient_list text has "1, 2-Hexanediol" (with space)
UPDATE products
SET ingredient_list = replace(ingredient_list, '1, 2-Hexanediol', '1,2-Hexanediol')
WHERE ingredient_list ILIKE '%1, 2-Hexanediol%';

-- 2. Drop bogus product_ingredients rows that would conflict with an already-correct link
DELETE FROM product_ingredients
WHERE ingredient_id IN (
    'f08c6a10-f7fb-42ab-aade-c8f7d9529ec3',
    'eb675c2b-0ac2-4fff-b501-047b80bdacdb'
  )
  AND product_id IN (
    SELECT product_id
    FROM product_ingredients
    WHERE ingredient_id = 'd27ded49-1518-47ea-bbbb-826f9bd7b62f'
  );

-- 3. Re-point remaining bogus rows to the correct 1,2-Hexanediol ingredient
UPDATE product_ingredients
SET ingredient_id = 'd27ded49-1518-47ea-bbbb-826f9bd7b62f'
WHERE ingredient_id IN (
    'f08c6a10-f7fb-42ab-aade-c8f7d9529ec3',
    'eb675c2b-0ac2-4fff-b501-047b80bdacdb'
  );

-- 4. Delete the bogus ingredient entries now that nothing references them
DELETE FROM ingredients
WHERE id IN (
    'f08c6a10-f7fb-42ab-aade-c8f7d9529ec3',
    'eb675c2b-0ac2-4fff-b501-047b80bdacdb'
  );
