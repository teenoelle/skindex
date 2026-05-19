-- Fix ingredient_list entries that captured INCIDecoder UI chrome
-- 1. Strip "Read more on how to read an ingredient list >>" suffix (and anything after it)
UPDATE products
SET ingredient_list = trim(
  regexp_replace(
    ingredient_list,
    '\s*Read\s+more\s+on\s+how\s+to\s+read\s+an\s+ingredient\s+list\s*>>.*$',
    '',
    'gi'
  )
)
WHERE ingredient_list ~* 'Read\s+more\s+on\s+how\s+to\s+read\s+an\s+ingredient\s+list';

-- 2. Strip usage-directions preamble before "Ingredients :" label
-- Only applies when "Ingredients:" appears after non-ingredient text (no commas before it)
UPDATE products
SET ingredient_list = trim(
  regexp_replace(
    ingredient_list,
    '^[^,]*?\bIngredients?\s*[:\-]\s*',
    '',
    'i'
  )
)
WHERE ingredient_list ~* '^[^,]*\bIngredients?\s*[:\-]';
