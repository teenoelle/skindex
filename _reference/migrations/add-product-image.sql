-- Run in: Supabase Dashboard → SQL Editor → New query
-- Adds image_url column to products table for storing product images.

alter table products
  add column if not exists image_url text;
