-- Lists no longer carry a type; include/exclude mode is set at browse time via listModes.
ALTER TABLE user_ingredient_lists DROP COLUMN IF EXISTS type;
