INSERT INTO product_types (name, body_area)
VALUES ('Hair Styler', 'Hair')
ON CONFLICT (name) DO NOTHING;
