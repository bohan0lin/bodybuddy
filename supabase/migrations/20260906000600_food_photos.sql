alter table public.saved_items add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-photos', 'food-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "read own food photos" on storage.objects;
create policy "read own food photos" on storage.objects for select to authenticated
using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "upload own food photos" on storage.objects;
create policy "upload own food photos" on storage.objects for insert to authenticated
with check (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Save the meal and its optional favorite together. Stable IDs make retries safe.
-- Images are immutable and shared by reference; deleting a meal never deletes a favorite's cover.
create or replace function public.record_food_entry(p_id uuid, p_meal jsonb, p_favorite boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  photo text := nullif(p_meal->>'photoUrl', '');
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if photo is not null and photo not like owner_id::text || '/%' then
    raise exception 'Invalid photo owner' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_meal->>'name')), 0) not between 1 and 200
    or coalesce((p_meal->>'amount')::numeric, 0) <= 0
    or coalesce(p_meal->>'type', '') not in ('breakfast', 'lunch', 'dinner', 'snack')
    or coalesce(length(trim(p_meal->>'unit')), 0) not between 1 and 30
    or not (coalesce((p_meal->>'protein')::numeric, -1) between 0 and 2000)
    or not (coalesce((p_meal->>'carbs')::numeric, -1) between 0 and 2000)
    or not (coalesce((p_meal->>'fat')::numeric, -1) between 0 and 2000)
    or not (coalesce((p_meal->>'calories')::numeric, -1) between 0 and 20000) then
    raise exception 'Invalid meal' using errcode = '22023';
  end if;
  insert into public.meals (id, user_id, date, type, name, brand, amount, unit, protein, carbs, fat, calories, photo_url)
  values (p_id, owner_id, (p_meal->>'date')::date, p_meal->>'type', trim(p_meal->>'name'),
    nullif(p_meal->>'brand', ''), (p_meal->>'amount')::numeric, p_meal->>'unit',
    (p_meal->>'protein')::numeric, (p_meal->>'carbs')::numeric, (p_meal->>'fat')::numeric,
    (p_meal->>'calories')::numeric, photo)
  on conflict (id) do update set name = excluded.name, brand = excluded.brand,
    amount = excluded.amount, unit = excluded.unit, protein = excluded.protein, carbs = excluded.carbs,
    fat = excluded.fat, calories = excluded.calories, type = excluded.type, photo_url = excluded.photo_url;
  if p_favorite then
    -- Preserve the first cover when the same food is saved again.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
    if not exists (select 1 from public.saved_items where user_id = owner_id and kind = 'food'
      and name = trim(p_meal->>'name') and coalesce(brand, '') = coalesce(p_meal->>'brand', '')) then
      insert into public.saved_items (user_id, kind, name, brand, unit, base_amount, protein, carbs, fat, calories, photo_url)
      values (owner_id, 'food', trim(p_meal->>'name'), nullif(p_meal->>'brand', ''), p_meal->>'unit',
        (p_meal->>'amount')::numeric, (p_meal->>'protein')::numeric, (p_meal->>'carbs')::numeric,
        (p_meal->>'fat')::numeric, (p_meal->>'calories')::numeric, photo);
    end if;
  end if;
end;
$$;
revoke all on function public.record_food_entry(uuid, jsonb, boolean) from public, anon;
grant execute on function public.record_food_entry(uuid, jsonb, boolean) to authenticated;
