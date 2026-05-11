-- Upgrade OBF image URLs: thumbnail (.400.jpg) → full resolution (.full.jpg)
UPDATE products
SET image_url = regexp_replace(image_url, '\.\d+\.jpg$', '.full.jpg')
WHERE image_url ~ 'openbeautyfacts\.org'
  AND image_url ~ '\.\d+\.jpg$';

-- Upgrade iHerb Cloudinary URLs: small variant (/s/) → large variant (/l/)
UPDATE products
SET image_url = regexp_replace(image_url, '/s/([0-9]+\.[a-z]+)$', '/l/\1')
WHERE image_url ~ 'cloudinary\.images-iherb\.com'
  AND image_url ~ '/s/[0-9]+\.[a-z]+$';
