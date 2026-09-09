-- An immutable receipt and its user record commit in the same transaction.
create table if not exists public.agent_actions (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid not null,
  payload jsonb not null,
  record_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, action_id)
);
alter table public.agent_actions enable row level security;
revoke all on public.agent_actions from public, anon, authenticated;
grant select on public.agent_actions to authenticated;
drop policy if exists "read own action receipts" on public.agent_actions;
create policy "read own action receipts" on public.agent_actions for select to authenticated
using (user_id = auth.uid());

create or replace function public.confirm_agent_action(p_action_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  a jsonb := p_payload->'action';
  kind text := a->>'type';
  field text;
  previous public.agent_actions%rowtype;
  entry_date date;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_action_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(a) is distinct from 'object'
    or (p_payload - array['date','action']) <> '{}'::jsonb
    or coalesce(p_payload->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or kind is null or kind not in ('log','save','workout') then
    raise exception 'Invalid proposal' using errcode = '22023';
  end if;
  entry_date := (p_payload->>'date')::date;
  if kind = 'workout' then
    if (a - array['type','workoutType','note','durationMin','calories']) <> '{}'::jsonb
      or coalesce(a->>'workoutType','') not in ('strength','run','hiit','cycling','ball','swim','walk','yoga','other')
      or jsonb_typeof(a->'durationMin') is distinct from 'number'
      or not ((a->>'durationMin')::numeric > 0 and (a->>'durationMin')::numeric <= 1440)
      or (a ? 'note' and (jsonb_typeof(a->'note') <> 'string' or length(a->>'note') > 1000)) then
      raise exception 'Invalid workout' using errcode = '22023';
    end if;
  else
    if jsonb_typeof(a->'name') is distinct from 'string' or length(trim(a->>'name')) not between 1 and 200
      or (a ? 'brand' and (jsonb_typeof(a->'brand') <> 'string' or length(trim(a->>'brand')) not between 1 and 200))
      or (a ? 'unit' and (jsonb_typeof(a->'unit') <> 'string' or length(trim(a->>'unit')) not between 1 and 30)) then
      raise exception 'Invalid food' using errcode = '22023';
    end if;
    if kind = 'log' then
      if (a - array['type','name','brand','amount','unit','mealType','protein','carbs','fat','calories']) <> '{}'::jsonb
        or coalesce(a->>'mealType','') not in ('breakfast','lunch','dinner','snack')
        or (a ? 'amount' and (jsonb_typeof(a->'amount') <> 'number' or not ((a->>'amount')::numeric > 0 and (a->>'amount')::numeric <= 20000))) then
        raise exception 'Invalid meal' using errcode = '22023';
      end if;
    else
      if (a - array['type','kind','name','brand','unit','baseAmount','protein','carbs','fat','calories']) <> '{}'::jsonb
        or coalesce(a->>'kind','') not in ('food','meal') or not (a ? 'unit')
        or jsonb_typeof(a->'baseAmount') is distinct from 'number'
        or not ((a->>'baseAmount')::numeric > 0 and (a->>'baseAmount')::numeric <= 20000) then
        raise exception 'Invalid favorite' using errcode = '22023';
      end if;
    end if;
    foreach field in array array['protein','carbs','fat'] loop
      if jsonb_typeof(a->field) is distinct from 'number' or not ((a->>field)::numeric between 0 and 2000) then
        raise exception 'Invalid nutrition' using errcode = '22023';
      end if;
    end loop;
  end if;
  if jsonb_typeof(a->'calories') is distinct from 'number' or not ((a->>'calories')::numeric between 0 and 20000) then
    raise exception 'Invalid calories' using errcode = '22023';
  end if;

  -- The unique constraint serializes concurrent retries, including different payloads.
  insert into public.agent_actions(user_id, action_id, payload, record_id)
  values (owner_id, p_action_id, p_payload, p_action_id)
  on conflict (user_id, action_id) do nothing;
  if not found then
    select * into strict previous from public.agent_actions where user_id = owner_id and action_id = p_action_id;
    if previous.payload <> p_payload then
      raise exception 'Action already confirmed with different content' using errcode = 'PT409';
    end if;
    return jsonb_build_object('recordId', previous.record_id, 'replayed', true);
  end if;
  if kind = 'log' then
    insert into public.meals(id, user_id, date, type, name, brand, amount, unit, protein, carbs, fat, calories)
    values (p_action_id, owner_id, entry_date, a->>'mealType', trim(a->>'name'), a->>'brand',
      (a->>'amount')::numeric, coalesce(a->>'unit','g'), (a->>'protein')::numeric,
      (a->>'carbs')::numeric, (a->>'fat')::numeric, (a->>'calories')::numeric);
  elsif kind = 'save' then
    insert into public.saved_items(id, user_id, kind, name, brand, unit, base_amount, protein, carbs, fat, calories)
    values (p_action_id, owner_id, a->>'kind', trim(a->>'name'), a->>'brand', a->>'unit',
      (a->>'baseAmount')::numeric, (a->>'protein')::numeric, (a->>'carbs')::numeric, (a->>'fat')::numeric, (a->>'calories')::numeric);
  else
    insert into public.workouts(id, user_id, date, type, note, duration_min, calories)
    values (p_action_id, owner_id, entry_date, a->>'workoutType', a->>'note', (a->>'durationMin')::numeric, (a->>'calories')::numeric);
  end if;
  return jsonb_build_object('recordId', p_action_id, 'replayed', false);
end;
$$;
revoke all on function public.confirm_agent_action(uuid,jsonb) from public, anon;
grant execute on function public.confirm_agent_action(uuid,jsonb) to authenticated;
