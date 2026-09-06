create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.ai_request_limits (
  bucket_key text not null,
  window_start bigint not null,
  used integer not null check (used >= 0),
  expires_at bigint not null,
  primary key (bucket_key, window_start)
);
create index if not exists ai_request_limits_expiry on private.ai_request_limits (expires_at);
alter table private.ai_request_limits enable row level security;
revoke all on private.ai_request_limits from public, anon, authenticated;

-- Only the trusted API may supply an IP hash or reserve another user's budget.
create or replace function public.reserve_ai_request(p_user_id uuid, p_ip_hash text, p_endpoint text, p_image boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  stamp bigint := floor(extract(epoch from clock_timestamp()));
  minute_start bigint := (stamp / 60) * 60;
  day_start bigint := (stamp / 86400) * 86400;
  keys text[];
  starts bigint[];
  lengths integer[];
  caps integer[];
  charges integer[];
  model_calls integer;
  image_request boolean;
  existing integer;
  wait_seconds integer := 0;
  i integer;
  lock_key text;
begin
  if p_user_id is null or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$'
     or p_endpoint is null or p_endpoint not in ('assistant','suggest','recognize','lookup','knowledge') then
    raise exception 'Invalid reservation arguments' using errcode = '22023';
  end if;
  -- Worst-case model HTTP calls: retries are disabled; assistant has four steps;
  -- recognition may embed up to five foods after its generation call.
  model_calls := case p_endpoint when 'assistant' then 4 when 'recognize' then 6 else 1 end;
  image_request := p_endpoint = 'recognize' or (p_endpoint = 'assistant' and coalesce(p_image, false));
  keys := array['user-minute:' || p_user_id, 'ip-minute:' || p_ip_hash, 'user-day:' || p_user_id];
  starts := array[minute_start, minute_start, day_start];
  lengths := array[60, 60, 86400];
  caps := array[10, 60, 100];
  charges := array[1, 1, model_calls];
  if image_request then
    keys := keys || array['image-user-minute:' || p_user_id, 'image-ip-minute:' || p_ip_hash, 'image-user-day:' || p_user_id];
    starts := starts || array[minute_start, minute_start, day_start];
    lengths := lengths || array[60, 60, 86400];
    caps := caps || array[3, 10, 20];
    charges := charges || array[1, 1, 1];
  end if;
  -- Consistent ordering prevents deadlocks when users share or change IPs.
  for lock_key in select unnest(keys) order by 1 loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lock_key, 0));
  end loop;
  for i in 1..array_length(keys, 1) loop
    select used into existing from private.ai_request_limits
      where bucket_key = keys[i] and window_start = starts[i];
    if coalesce(existing, 0) + charges[i] > caps[i] then
      wait_seconds := greatest(wait_seconds, (starts[i] + lengths[i] - stamp)::integer);
    end if;
  end loop;
  if wait_seconds > 0 then
    return jsonb_build_object('allowed', false, 'retryAfter', wait_seconds);
  end if;
  for i in 1..array_length(keys, 1) loop
    insert into private.ai_request_limits as counters (bucket_key, window_start, used, expires_at)
      values (keys[i], starts[i], charges[i], starts[i] + lengths[i])
      on conflict (bucket_key, window_start) do update set used = counters.used + excluded.used;
  end loop;
  -- Bounded opportunistic cleanup stores no raw IP or request content.
  delete from private.ai_request_limits where ctid in (
    select ctid from private.ai_request_limits where expires_at < stamp - 86400 limit 200
  );
  return jsonb_build_object('allowed', true, 'retryAfter', 0);
end;
$$;
revoke all on function public.reserve_ai_request(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.reserve_ai_request(uuid, text, text, boolean) to service_role;
