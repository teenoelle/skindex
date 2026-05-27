-- Add Home body area with Laundry Detergent and Fabric Softener
-- Add Dish Soap under Hands body area
INSERT INTO product_types (name, body_area, is_rinse_off) VALUES
  ('Dish Soap',          'Hands', true),
  ('Laundry Detergent',  'Home',  false),
  ('Fabric Softener',    'Home',  false)
ON CONFLICT (name) DO NOTHING;
