alter table public.foods add column if not exists brand text;
alter table public.foods add column if not exists preparation text;
alter table public.foods add column if not exists source text not null default 'legacy-unverified';

create or replace function public.find_foods_exact(p_query text, p_brand text default null, p_preparation text default null, p_unit text default null)
returns table(id uuid, name text, name_en text, unit text, base_amount numeric, protein numeric, carbs numeric, fat numeric, calories numeric, distance float, source text)
language sql stable security invoker set search_path = '' as $$
  select f.id,f.name,f.name_en,f.unit,f.base_amount,f.protein,f.carbs,f.fat,f.calories,0::float,f.source
  from public.foods f
  where exists (select 1 from unnest(array[f.name,f.name_en] || string_to_array(coalesce(f.aliases,''),',')) n
    where lower(trim(n)) = lower(trim(p_query)))
    and (p_brand is null or lower(trim(f.brand)) = lower(trim(p_brand)))
    and (p_preparation is null or lower(trim(f.preparation)) = lower(trim(p_preparation)))
    and (p_unit is null or f.unit = p_unit)
  order by f.id limit 3;
$$;

create or replace function public.find_foods_semantic(p_embedding vector(768), p_brand text default null, p_preparation text default null, p_unit text default null)
returns table(id uuid, name text, name_en text, unit text, base_amount numeric, protein numeric, carbs numeric, fat numeric, calories numeric, distance float, source text)
language sql stable security invoker set search_path = public, extensions as $$
  select f.id,f.name,f.name_en,f.unit,f.base_amount,f.protein,f.carbs,f.fat,f.calories,(f.embedding <=> p_embedding)::float,f.source
  from public.foods f where f.embedding is not null
    and (p_brand is null or lower(trim(f.brand)) = lower(trim(p_brand)))
    and (p_preparation is null or lower(trim(f.preparation)) = lower(trim(p_preparation)))
    and (p_unit is null or f.unit = p_unit)
  order by f.embedding <=> p_embedding limit 3;
$$;
revoke all on function public.find_foods_exact(text,text,text,text) from public;
revoke all on function public.find_foods_semantic(vector,text,text,text) from public;
grant execute on function public.find_foods_exact(text,text,text,text) to anon, authenticated;
grant execute on function public.find_foods_semantic(vector,text,text,text) to anon, authenticated;
