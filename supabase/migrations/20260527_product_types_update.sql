-- Fix Lips → Lip typo
UPDATE product_types SET body_area = 'Lip' WHERE body_area = 'Lips';

-- Rename Sun Screen → Sunscreen Face (keep under Face)
UPDATE product_types SET name = 'Sunscreen Face' WHERE name = 'Sun Screen';

-- Add new Face types
INSERT INTO product_types (name, body_area) VALUES
  ('Neck Cream', 'Face')
ON CONFLICT (name) DO NOTHING;

-- Add new Body types (leave-on split for formula order)
INSERT INTO product_types (name, body_area) VALUES
  ('Body Oil',     'Body'),
  ('Body Serum',   'Body'),
  ('Sunscreen Body', 'Body')
ON CONFLICT (name) DO NOTHING;

-- New Hands body area
INSERT INTO product_types (name, body_area) VALUES
  ('Hand Cream',     'Hands'),
  ('Hand Sanitizer', 'Hands')
ON CONFLICT (name) DO NOTHING;

-- Move existing Hand Cream from Body → Hands
UPDATE product_types SET body_area = 'Hands' WHERE name = 'Hand Cream';

-- New Lips types
INSERT INTO product_types (name, body_area) VALUES
  ('Lip Scrub',     'Lip'),
  ('Sunscreen Lip', 'Lip')
ON CONFLICT (name) DO NOTHING;

-- New Nails body area
INSERT INTO product_types (name, body_area) VALUES
  ('Nail Treatment', 'Nails'),
  ('Nail Polish',    'Nails')
ON CONFLICT (name) DO NOTHING;

-- Dry Shampoo: move from Hair (Shampoo group) to Scalp Treatment group
-- It's already seeded as part of Hair — we just update the name if it exists,
-- or insert it pointing to Hair body area under Scalp Treatment type grouping.
-- Dry Shampoo is a new type (wasn't in the original seed).
INSERT INTO product_types (name, body_area) VALUES
  ('Dry Shampoo', 'Hair')
ON CONFLICT (name) DO NOTHING;
