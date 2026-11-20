-- Live Clashes on Cloudflare Realtime.
--
-- The Clash creator hosts the room. Viewers watch without camera or
-- microphone; they ask to join the stage, and the host (or a moderator)
-- grants the camera and the microphone separately and can take either back
-- at any time. Media flows through Cloudflare Realtime: the `live` Edge
-- Function holds the Cloudflare token and only lets a participant publish
-- what this table allows. Nothing is recorded.

create table public.live_rooms (
  clash_id uuid primary key references public.clashes (id) on delete cascade,
  status text not null default 'idle' check (status in ('idle', 'live', 'ended')),
  started_at timestamptz,
  ended_at timestamptz
);

create table public.live_participants (
  clash_id uuid not null references public.clashes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'viewer' check (role in ('host', 'moderator', 'viewer')),
  stage text not null default 'audience' check (stage in ('audience', 'requested', 'on_stage')),
  cam_allowed boolean not null default false,
  mic_allowed boolean not null default false,
  -- Cloudflare session and the tracks it publishes ({ mid, trackName, kind }).
  session_id text,
  tracks jsonb not null default '[]',
  present boolean not null default true,
  requested_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (clash_id, user_id)
);
create index live_participants_user_idx on public.live_participants (user_id);

alter table public.live_rooms enable row level security;
alter table public.live_participants enable row level security;
grant select on public.live_rooms, public.live_participants to anon, authenticated;
create policy "Live rooms follow their Clash" on public.live_rooms for select using (public.can_view_clash(clash_id));
create policy "Live participants follow their Clash" on public.live_participants for select using (public.can_view_clash(clash_id));

-- Any change in a room pings `live:<clash id>`; clients read the room again.
create function public.ping_live_room()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send('{}'::jsonb, 'changed', 'live:' || coalesce(new.clash_id, old.clash_id), false);
  return null;
end;
$$;
revoke execute on function public.ping_live_room() from public, anon, authenticated;
create trigger live_rooms_ping after insert or update on public.live_rooms for each row execute function public.ping_live_room();
create trigger live_participants_ping after insert or update or delete on public.live_participants for each row execute function public.ping_live_room();

-- The caller's role in a room: host for the creator, then their stored role.
create function public.live_role(p_clash uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.clashes where id = p_clash and creator_id = (select auth.uid())) then 'host'
    else (select role from public.live_participants where clash_id = p_clash and user_id = (select auth.uid()))
  end
$$;

create function public.require_live_staff(p_clash uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if public.live_role(p_clash) not in ('host', 'moderator') or public.live_role(p_clash) is null then
    raise exception 'not_allowed';
  end if;
  return (select auth.uid());
end;
$$;
revoke execute on function public.require_live_staff(uuid) from public, anon, authenticated;

-- Enter the room (or come back after a refresh). The creator enters as host, on stage.
create function public.live_join(p_clash uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  is_host boolean;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not public.can_view_clash(p_clash) then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.clashes where id = p_clash and format = 'live') then raise exception 'not_live'; end if;
  is_host := exists (select 1 from public.clashes where id = p_clash and creator_id = me);

  insert into public.live_rooms (clash_id) values (p_clash) on conflict do nothing;
  insert into public.live_participants (clash_id, user_id, role, stage, cam_allowed, mic_allowed)
  values (p_clash, me, case when is_host then 'host' else 'viewer' end,
          case when is_host then 'on_stage' else 'audience' end, is_host, is_host)
  on conflict (clash_id, user_id) do update set present = true, updated_at = now();
end;
$$;

create function public.live_leave(p_clash uuid)
returns void language sql security definer set search_path = '' as $$
  update public.live_participants
  set present = false, session_id = null, tracks = '[]',
      stage = case when role = 'host' then stage else 'audience' end,
      cam_allowed = case when role = 'host' then cam_allowed else false end,
      mic_allowed = case when role = 'host' then mic_allowed else false end,
      updated_at = now()
  where clash_id = p_clash and user_id = (select auth.uid());
$$;

create function public.live_set_status(p_clash uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.live_role(p_clash) is distinct from 'host' then raise exception 'not_allowed'; end if;
  if p_status not in ('live', 'ended') then raise exception 'invalid_status'; end if;
  update public.live_rooms
  set status = p_status,
      started_at = case when p_status = 'live' then coalesce(started_at, now()) else started_at end,
      ended_at = case when p_status = 'ended' then now() else null end
  where clash_id = p_clash;
  if p_status = 'ended' then
    update public.live_participants
    set stage = case when role = 'host' then stage else 'audience' end, cam_allowed = role = 'host', mic_allowed = role = 'host'
    where clash_id = p_clash;
  end if;
end;
$$;

-- A viewer raises their hand, or lowers it.
create function public.live_request_stage(p_clash uuid, p_request boolean)
returns void language sql security definer set search_path = '' as $$
  update public.live_participants
  set stage = case when p_request then 'requested' else 'audience' end,
      requested_at = case when p_request then now() else null end,
      updated_at = now()
  where clash_id = p_clash and user_id = (select auth.uid()) and stage <> 'on_stage';
$$;

-- Host and moderators decide who is on stage and with what.
create function public.live_set_permissions(p_clash uuid, p_user uuid, p_cam boolean, p_mic boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_live_staff(p_clash);
  update public.live_participants
  set cam_allowed = p_cam, mic_allowed = p_mic,
      stage = case when p_cam or p_mic then 'on_stage' when stage = 'on_stage' then 'audience' else stage end,
      requested_at = case when p_cam or p_mic then null else requested_at end,
      updated_at = now()
  where clash_id = p_clash and user_id = p_user and role <> 'host';
end;
$$;

create function public.live_set_moderator(p_clash uuid, p_user uuid, p_moderator boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.live_role(p_clash) is distinct from 'host' then raise exception 'not_allowed'; end if;
  update public.live_participants
  set role = case when p_moderator then 'moderator' else 'viewer' end, updated_at = now()
  where clash_id = p_clash and user_id = p_user and role <> 'host';
end;
$$;

-- An on-stage talent leaves the stage and goes back to watching.
create function public.live_step_down(p_clash uuid)
returns void language sql security definer set search_path = '' as $$
  update public.live_participants
  set stage = 'audience', cam_allowed = false, mic_allowed = false, updated_at = now()
  where clash_id = p_clash and user_id = (select auth.uid()) and role <> 'host';
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'live_join(uuid)', 'live_leave(uuid)', 'live_set_status(uuid, text)', 'live_request_stage(uuid, boolean)',
    'live_set_permissions(uuid, uuid, boolean, boolean)', 'live_set_moderator(uuid, uuid, boolean)', 'live_step_down(uuid)',
    'live_role(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
