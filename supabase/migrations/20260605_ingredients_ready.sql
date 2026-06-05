-- Gate the submission "approved" notification on admin confirming ingredients
-- have been classified and reviewed.
ALTER TABLE products
  ADD COLUMN ingredients_ready boolean NOT NULL DEFAULT false;

-- All existing approved products are already processed — mark them ready so
-- existing submitters don't lose their notification.
UPDATE products SET ingredients_ready = true WHERE is_pending = false;
