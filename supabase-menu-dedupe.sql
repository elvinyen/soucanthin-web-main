-- Preview duplicate menu items before changing data.
-- Duplicates are checked by item_code and by normalized Chinese/default name.

with duplicate_groups as (
  select
    'item_code' as duplicate_type,
    trim(item_code) as duplicate_key,
    count(*) as duplicate_count,
    array_agg(id order by id) as ids,
    array_agg(name order by id) as names,
    array_agg(active order by id) as active_flags
  from public.menu_items
  where nullif(trim(item_code), '') is not null
  group by trim(item_code)
  having count(*) > 1

  union all

  select
    'name' as duplicate_type,
    lower(trim(name)) as duplicate_key,
    count(*) as duplicate_count,
    array_agg(id order by id) as ids,
    array_agg(name order by id) as names,
    array_agg(active order by id) as active_flags
  from public.menu_items
  group by lower(trim(name))
  having count(*) > 1
)
select *
from duplicate_groups
order by duplicate_type, duplicate_key;

-- Soft-delete duplicate rows while keeping the smallest id in each duplicate group.
-- This does not hard-delete menu rows or affect historical order_items.
-- It also disambiguates inactive duplicate item_code/name values so unique indexes remain valid.

with duplicate_candidates as (
  select
    id,
    'item_code' as duplicate_type,
    row_number() over (partition by trim(item_code) order by id) as duplicate_rank
  from public.menu_items
  where nullif(trim(item_code), '') is not null

  union all

  select
    id,
    'name' as duplicate_type,
    row_number() over (partition by lower(trim(name)) order by id) as duplicate_rank
  from public.menu_items
),
duplicates_to_archive as (
  select
    id,
    bool_or(duplicate_type = 'item_code') as has_duplicate_code,
    bool_or(duplicate_type = 'name') as has_duplicate_name
  from duplicate_candidates
  where duplicate_rank > 1
  group by id
)
update public.menu_items as item
set
  active = false,
  item_code = case
    when duplicates_to_archive.has_duplicate_code and nullif(trim(item.item_code), '') is not null
      then item.item_code || '-DUP-' || item.id::text
    else item.item_code
  end,
  name = case
    when duplicates_to_archive.has_duplicate_name
      then item.name || ' (重复下架 #' || item.id::text || ')'
    else item.name
  end,
  updated_at = now()
from duplicates_to_archive
where item.id = duplicates_to_archive.id
returning item.id, item.item_code, item.name, item.active;
