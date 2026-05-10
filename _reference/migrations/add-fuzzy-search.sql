-- Run in: Supabase Dashboard → SQL Editor → New query
-- Enables typo-tolerant, partial-name product search.

create extension if not exists pg_trgm;

-- Combined fuzzy search: token match + trigram similarity.
-- Token match handles partial names and word reordering.
-- Trigram handles typos and abbreviations.
create or replace function search_products_fuzzy(q text)
returns table (
  id uuid,
  name text,
  brand text,
  type text,
  ingredient_list text,
  activity_tags text[],
  activity_note text
)
language sql stable as $$
  with tokens as (
    select t as token
    from unnest(regexp_split_to_array(lower(trim(q)), '\s+')) as t
    where length(t) >= 3
  ),
  scored as (
    select
      p.id, p.name, p.brand, p.type, p.ingredient_list, p.activity_tags, p.activity_note,
      coalesce(
        (select count(*)::float from tokens t
         where lower(p.name) like '%' || t.token || '%'
            or lower(coalesce(p.brand, '')) like '%' || t.token || '%'
        ) / nullif((select count(*) from tokens), 0),
        0
      ) as token_score,
      greatest(
        similarity(lower(p.name), lower(q)),
        similarity(lower(coalesce(p.brand, '') || ' ' || p.name), lower(q))
      ) as trgm_score
    from products p
    where p.ingredient_list is not null
  )
  select id, name, brand, type, ingredient_list, activity_tags, activity_note
  from scored
  where token_score >= 0.4 or trgm_score >= 0.15
  order by greatest(token_score, trgm_score) desc
  limit 5;
$$;

grant execute on function search_products_fuzzy(text) to anon, authenticated;
