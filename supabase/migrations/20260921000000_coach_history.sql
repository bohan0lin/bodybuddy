-- Persist conversation history and proposal state without granting direct writes.
create table if not exists public.coach_messages (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  sequence bigint generated always as identity,
  role text not null check (role in ('user','assistant')),
  body jsonb not null,
  reply_to uuid,
  created_at timestamptz not null default now(),
  primary key (user_id,id),
  foreign key (user_id,reply_to) references public.coach_messages(user_id,id),
  unique (user_id,reply_to),
  check ((role = 'user' and reply_to is null) or (role = 'assistant' and reply_to is not null))
);
create index if not exists coach_messages_history on public.coach_messages(user_id,sequence desc);
create table if not exists public.coach_proposals (
  user_id uuid not null,
  action_id uuid not null,
  message_id uuid not null,
  payload jsonb not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  primary key (user_id,action_id),
  foreign key (user_id,message_id) references public.coach_messages(user_id,id) on delete cascade
);
alter table public.coach_messages enable row level security;
alter table public.coach_proposals enable row level security;
revoke all on public.coach_messages, public.coach_proposals from public, anon, authenticated;
grant select on public.coach_messages, public.coach_proposals to authenticated;
drop policy if exists "read own coach messages" on public.coach_messages;
create policy "read own coach messages" on public.coach_messages for select to authenticated using (user_id = auth.uid());
drop policy if exists "read own coach proposals" on public.coach_proposals;
create policy "read own coach proposals" on public.coach_proposals for select to authenticated using (user_id = auth.uid());

create or replace function public.append_coach_message(p_owner uuid, p_id uuid, p_role text, p_body jsonb, p_reply_to uuid default null, p_proposals jsonb default '[]')
returns void language plpgsql security definer set search_path = '' as $$
declare
  previous public.coach_messages%rowtype;
  proposal jsonb;
  receipt public.agent_actions%rowtype;
begin
  if auth.uid() is null or p_owner is distinct from auth.uid() then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_id is null or p_role is null or p_role not in ('user','assistant')
    or jsonb_typeof(p_body) is distinct from 'object' or (p_body - array['text','image']) <> '{}'::jsonb
    or jsonb_typeof(p_body->'text') is distinct from 'string' or length(p_body->>'text') > 16000
    or (p_body ? 'image' and (jsonb_typeof(p_body->'image') is distinct from 'string' or length(p_body->>'image') > 500000 or (p_body->>'image') !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$'))
    or jsonb_typeof(p_proposals) is distinct from 'array' or jsonb_array_length(p_proposals) > 12
    or (p_role = 'user' and (p_reply_to is not null or p_proposals <> '[]'::jsonb))
    or (p_role = 'assistant' and p_reply_to is null) then
    raise exception 'Invalid message' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text || p_id::text,0));
  select * into previous from public.coach_messages where user_id=p_owner and id=p_id;
  if found then
    if previous.role <> p_role or previous.body <> p_body or previous.reply_to is distinct from p_reply_to then
      raise exception 'Message content conflict' using errcode='PT409';
    end if;
    -- A retry never replaces newer proposal content or terminal states.
    return;
  end if;
  if p_role = 'assistant' and not exists(select 1 from public.coach_messages where user_id=p_owner and id=p_reply_to and role='user') then
    raise exception 'User message missing' using errcode='22023';
  end if;
  insert into public.coach_messages(user_id,id,role,body,reply_to) values(p_owner,p_id,p_role,p_body,p_reply_to);
  -- Stable ordering avoids lock inversion when multiple proposals are registered.
  for proposal in select value from jsonb_array_elements(p_proposals) order by value->>'actionId' loop
    if jsonb_typeof(proposal) <> 'object' or (proposal - array['actionId','date','action']) <> '{}'::jsonb
      or proposal->>'actionId' is null or jsonb_typeof(proposal->'action') is distinct from 'object'
      or coalesce(proposal->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Invalid proposal' using errcode='22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text || (proposal->>'actionId'),0));
    select * into receipt from public.agent_actions where user_id=p_owner and action_id=(proposal->>'actionId')::uuid;
    if found and receipt.payload <> proposal - 'actionId' then raise exception 'Action content conflict' using errcode='PT409'; end if;
    insert into public.coach_proposals(user_id,action_id,message_id,payload,status)
      values(p_owner,(proposal->>'actionId')::uuid,p_id,proposal-'actionId',case when receipt.action_id is null then 'pending' else 'confirmed' end);
  end loop;
end;
$$;

-- Keep legacy clients working, but never let them bypass a persisted proposal.
do $$ begin
  if to_regprocedure('public.execute_agent_action(uuid,jsonb)') is null then
    alter function public.confirm_agent_action(uuid,jsonb) rename to execute_agent_action;
  end if;
end $$;
revoke all on function public.execute_agent_action(uuid,jsonb) from public,anon,authenticated;
create or replace function public.confirm_agent_action(p_action_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || p_action_id::text,0));
  if exists(select 1 from public.coach_proposals where user_id=auth.uid() and action_id=p_action_id) then
    raise exception 'Use versioned proposal confirmation' using errcode='PT409';
  end if;
  return public.execute_agent_action(p_action_id,p_payload);
end;
$$;

create or replace function public.transition_coach_proposal(p_owner uuid,p_action_id uuid,p_version integer,p_operation text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  proposal public.coach_proposals%rowtype;
begin
  if auth.uid() is null or p_owner is distinct from auth.uid() then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_operation is null or p_operation not in ('edit','cancel','confirm') then raise exception 'Invalid operation' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text || p_action_id::text,0));
  select * into proposal from public.coach_proposals where user_id=p_owner and action_id=p_action_id for update;
  if not found then raise exception 'Proposal missing' using errcode='PT409'; end if;
  if (p_operation='confirm' and proposal.status='confirmed' and proposal.payload=p_payload)
    or (p_operation='cancel' and proposal.status='cancelled') then return to_jsonb(proposal); end if;
  if proposal.status <> 'pending' then raise exception 'Proposal is terminal' using errcode='PT409'; end if;
  if proposal.expires_at <= now() then raise exception 'Proposal expired' using errcode='PT410'; end if;
  -- An identical edit retry after a lost response does not increment the version.
  if p_operation='edit' and proposal.payload=p_payload then return to_jsonb(proposal); end if;
  if p_version is distinct from proposal.version then raise exception 'Stale proposal version' using errcode='PT409'; end if;
  if p_operation <> 'cancel' then
    if jsonb_typeof(p_payload) is distinct from 'object' or (p_payload-array['date','action']) <> '{}'::jsonb
      or jsonb_typeof(p_payload->'action') is distinct from 'object' or pg_column_size(p_payload)>20000
      or coalesce(p_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Invalid proposal payload' using errcode='22023';
    end if;
  end if;
  if p_operation='confirm' then
    -- Receipt, business record and terminal state commit or roll back together.
    perform public.execute_agent_action(p_action_id,p_payload);
  end if;
  update public.coach_proposals set
    payload=case when p_operation='cancel' then payload else p_payload end,
    status=case p_operation when 'confirm' then 'confirmed' when 'cancel' then 'cancelled' else 'pending' end,
    version=version+1
    where user_id=p_owner and action_id=p_action_id returning * into proposal;
  return to_jsonb(proposal);
end;
$$;
revoke all on function public.append_coach_message(uuid,uuid,text,jsonb,uuid,jsonb) from public,anon;
revoke all on function public.transition_coach_proposal(uuid,uuid,integer,text,jsonb) from public,anon;
revoke all on function public.confirm_agent_action(uuid,jsonb) from public,anon;
grant execute on function public.append_coach_message(uuid,uuid,text,jsonb,uuid,jsonb) to authenticated;
grant execute on function public.transition_coach_proposal(uuid,uuid,integer,text,jsonb) to authenticated;
grant execute on function public.confirm_agent_action(uuid,jsonb) to authenticated;
