-- Admin Console.
--
-- Roles: owner > admin > moderator. Moderators handle reports, hide videos
-- and remove comments. Admins also end Clashes, revoke verifications and
-- suspend talents. Owners manage the team.
-- Critical actions (suspending a talent, deleting a video or a group) follow
-- the four-eyes rule: one admin requests, a different admin approves.
-- Every action lands in the audit log. Admin reads and writes go through
-- security-definer functions that check the caller's role first.

-- ---------------------------------------------------------------------------
-- Team, suspension, audit
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'moderator')),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

alter table public.profiles
  add column suspended_at timestamptz,
  add column suspended_reason text;

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  target_label text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_events_recent_idx on public.audit_events (created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_id);
alter table public.audit_events enable row level security;

create table public.admin_approvals (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('suspend_user', 'delete_entry', 'delete_group')),
  target_id uuid not null,
  target_label text not null,
  reason text not null check (char_length(reason) between 3 and 500),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);
create index admin_approvals_pending_idx on public.admin_approvals (status, requested_at desc);
create index admin_approvals_requested_by_idx on public.admin_approvals (requested_by);
create index admin_approvals_decided_by_idx on public.admin_approvals (decided_by);
alter table public.admin_approvals enable row level security;

-- Reporters hear back when their case is closed.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'follow', 'spark', 'comment', 'reply', 'comment_like',
  'clash_back', 'clash_entry', 'clash_invite', 'group_join',
  'clash_starting', 'clash_open', 'clash_ended', 'report_update'
));
alter table public.notifications add column report_case bigint;
drop index public.notifications_once_idx;
create unique index notifications_once_idx on public.notifications
  (recipient_id, kind, actor_id, entry_id, comment_id, clash_id, group_id, report_case) nulls not distinct;

alter table public.safety_reports
  add column moderator_note text,
  add column handled_by uuid references public.profiles (id) on delete set null;
create index safety_reports_handled_by_idx on public.safety_reports (handled_by);

-- ---------------------------------------------------------------------------
-- Role checks
-- ---------------------------------------------------------------------------

create function public.admin_rank(p_role text)
returns integer language sql immutable set search_path = '' as $$
  select case p_role when 'owner' then 3 when 'admin' then 2 when 'moderator' then 1 else 0 end
$$;

create function public.my_admin_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.admins where user_id = (select auth.uid())
$$;
revoke execute on function public.my_admin_role() from public, anon;
grant execute on function public.my_admin_role() to authenticated;

-- Raises unless the caller holds at least p_min_role. Returns the caller's id.
create function public.require_admin(p_min_role text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  role text;
begin
  select a.role into role from public.admins a where a.user_id = me;
  if public.admin_rank(role) < public.admin_rank(p_min_role) then
    raise exception 'not_allowed';
  end if;
  return me;
end;
$$;

create function public.audit(p_actor uuid, p_action text, p_target_type text, p_target_id text, p_target_label text, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_events (actor_id, action, target_type, target_id, target_label, details)
  values (p_actor, p_action, p_target_type, p_target_id, p_target_label, coalesce(p_details, '{}'));
$$;

revoke execute on function public.require_admin(text) from public, anon, authenticated;
revoke execute on function public.audit(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Suspended talents cannot act
-- ---------------------------------------------------------------------------

create function public.refuse_suspended()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = (select auth.uid()) and suspended_at is not null) then
    raise exception 'suspended' using hint = 'This account is suspended.';
  end if;
  return new;
end;
$$;
revoke execute on function public.refuse_suspended() from public, anon, authenticated;

create trigger entries_refuse_suspended before insert on public.entries for each row execute function public.refuse_suspended();
create trigger comments_refuse_suspended before insert on public.comments for each row execute function public.refuse_suspended();
create trigger sparks_refuse_suspended before insert on public.sparks for each row execute function public.refuse_suspended();
create trigger follows_refuse_suspended before insert on public.follows for each row execute function public.refuse_suspended();
create trigger clashes_refuse_suspended before insert on public.clashes for each row execute function public.refuse_suspended();
create trigger groups_refuse_suspended before insert on public.groups for each row execute function public.refuse_suspended();
create trigger group_members_refuse_suspended before insert on public.group_members for each row execute function public.refuse_suspended();
create trigger clash_invites_refuse_suspended before insert on public.clash_invites for each row execute function public.refuse_suspended();
create trigger comment_likes_refuse_suspended before insert on public.comment_likes for each row execute function public.refuse_suspended();
create trigger duel_votes_refuse_suspended before insert on public.duel_votes for each row execute function public.refuse_suspended();

-- ---------------------------------------------------------------------------
-- Overview
-- ---------------------------------------------------------------------------

create function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin('moderator');
  return jsonb_build_object(
    'talents', (select count(*) from public.profiles),
    'talents_today', (select count(*) from public.profiles where created_at > now() - interval '1 day'),
    'talents_week', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'videos', (select count(*) from public.entries),
    'videos_today', (select count(*) from public.entries where created_at > now() - interval '1 day'),
    'views_today', (select count(*) from public.entry_views where created_at > now() - interval '1 day'),
    'sparks_today', (select count(*) from public.sparks where created_at > now() - interval '1 day'),
    'comments_today', (select count(*) from public.comments where created_at > now() - interval '1 day'),
    'clashes_open', (select count(*) from public.clashes where now() between starts_at and ends_at),
    'clashes_scheduled', (select count(*) from public.clashes where starts_at > now()),
    'groups', (select count(*) from public.groups),
    'verified', (select count(*) from public.profiles where verified),
    'suspended', (select count(*) from public.profiles where suspended_at is not null),
    'hidden_videos', (select count(*) from public.entries where hidden_at is not null),
    'reports_open', (select count(*) from public.safety_reports where status in ('open', 'reviewing')),
    'reports_child_safety', (select count(*) from public.safety_reports where status in ('open', 'reviewing') and reason = 'minor_safety'),
    'approvals_pending', (select count(*) from public.admin_approvals where status = 'pending')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create function public.admin_reports(p_status text)
returns table (
  case_number bigint, status text, reason text, details text, target_type text, target_label text,
  entry_id uuid, profile_id uuid, clash_id uuid, group_id uuid, comment_id uuid,
  target_handle text, reporter_handle text, moderator_note text, created_at timestamptz, same_target_reports bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin('moderator');
  return query
  select r.case_number, r.status, r.reason, r.details, r.target_type, r.target_label,
    r.entry_id, r.profile_id, r.clash_id, r.group_id, r.comment_id,
    coalesce(tp.handle, ep.handle, cp.handle) as target_handle,
    rp.handle as reporter_handle, r.moderator_note, r.created_at,
    (select count(*) from public.safety_reports o
      where o.target_type = r.target_type
        and coalesce(o.entry_id, o.profile_id, o.clash_id, o.group_id, o.comment_id) = coalesce(r.entry_id, r.profile_id, r.clash_id, r.group_id, r.comment_id)) as same_target_reports
  from public.safety_reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles tp on tp.id = r.profile_id
  left join public.entries e on e.id = r.entry_id
  left join public.profiles ep on ep.id = e.author_id
  left join public.comments c on c.id = r.comment_id
  left join public.profiles cp on cp.id = c.author_id
  where (p_status = 'active' and r.status in ('open', 'reviewing')) or (p_status = 'closed' and r.status in ('actioned', 'dismissed'))
  -- A child at risk always comes first.
  order by (r.reason = 'minor_safety') desc, r.created_at asc
  limit 200;
end;
$$;

create function public.admin_set_report_status(p_case bigint, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin('moderator');
  report public.safety_reports;
begin
  if p_status not in ('open', 'reviewing', 'actioned', 'dismissed') then raise exception 'invalid_status'; end if;
  update public.safety_reports
  set status = p_status, moderator_note = coalesce(nullif(trim(p_note), ''), moderator_note), handled_by = me, updated_at = now()
  where case_number = p_case
  returning * into report;
  if report.id is null then raise exception 'not_found'; end if;

  perform public.audit(me, 'report_' || p_status, 'report', 'HC-' || lpad(p_case::text, 6, '0'), report.target_label, jsonb_build_object('note', p_note));

  if p_status in ('actioned', 'dismissed') then
    insert into public.notifications (recipient_id, kind, report_case) values (report.reporter_id, 'report_update', p_case)
    on conflict do nothing;
    perform realtime.send('{}'::jsonb, 'new', 'notify:' || report.reporter_id, false);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------

create function public.admin_entries(p_filter text)
returns table (
  id uuid, caption text, world_id text, poster_url text, video_url text, author_handle text,
  reports_count integer, sparks_count integer, views_count integer, hidden_at timestamptz, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin('moderator');
  return query
  select e.id, e.caption, e.world_id, e.poster_url, e.video_url, p.handle, e.reports_count, e.sparks_count, e.views_count, e.hidden_at, e.created_at
  from public.entries e join public.profiles p on p.id = e.author_id
  where (p_filter = 'reported' and e.reports_count > 0)
     or (p_filter = 'hidden' and e.hidden_at is not null)
     or (p_filter = 'recent')
  order by case when p_filter = 'reported' then e.reports_count else 0 end desc, e.created_at desc
  limit 120;
end;
$$;

create function public.admin_set_entry_hidden(p_entry uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin('moderator');
  label text;
begin
  update public.entries set hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end
  where id = p_entry returning coalesce(nullif(caption, ''), 'Video') into label;
  if label is null then raise exception 'not_found'; end if;
  perform public.audit(me, case when p_hidden then 'hide_video' else 'unhide_video' end, 'entry', p_entry::text, label);
end;
$$;

create function public.admin_delete_comment(p_comment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin('moderator');
  label text;
begin
  delete from public.comments where id = p_comment returning left(body, 120) into label;
  if label is null then raise exception 'not_found'; end if;
  perform public.audit(me, 'delete_comment', 'comment', p_comment::text, label);
end;
$$;

-- ---------------------------------------------------------------------------
-- Talents
-- ---------------------------------------------------------------------------

create function public.admin_users(p_search text)
returns table (
  id uuid, handle text, display_name text, avatar_url text, email text, country text,
  verified boolean, verified_url text, suspended_at timestamptz, suspended_reason text, role text,
  videos bigint, followers bigint, reports_against bigint, created_at timestamptz, last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  term text := '%' || lower(coalesce(trim(p_search), '')) || '%';
begin
  perform public.require_admin('moderator');
  return query
  select p.id, p.handle, p.display_name, p.avatar_url, u.email::text, p.country,
    p.verified, p.verified_url, p.suspended_at, p.suspended_reason, a.role,
    (select count(*) from public.entries e where e.author_id = p.id),
    (select count(*) from public.follows f where f.followee_id = p.id),
    (select count(*) from public.safety_reports r where r.profile_id = p.id),
    p.created_at, u.last_sign_in_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.admins a on a.user_id = p.id
  where lower(p.handle) like term or lower(p.display_name) like term or lower(coalesce(u.email::text, '')) like term
  order by p.created_at desc
  limit 100;
end;
$$;

create function public.admin_unsuspend(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin('admin');
  label text;
begin
  update public.profiles set suspended_at = null, suspended_reason = null where id = p_user returning '@' || handle into label;
  if label is null then raise exception 'not_found'; end if;
  perform public.audit(me, 'unsuspend_user', 'user', p_user::text, label);
end;
$$;

create function public.admin_revoke_verification(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin('admin');
  label text;
  link text;
begin
  select '@' || handle, verified_url into label, link from public.profiles where id = p_user;
  if label is null then raise exception 'not_found'; end if;
  update public.profiles set verified = false, verified_platform = null, verified_url = null, verified_at = null where id = p_user;
  perform public.audit(me, 'revoke_verification', 'user', p_user::text, label, jsonb_build_object('link', link));
end;
$$;

create function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin('owner');
  label text;
begin
  select '@' || handle into label from public.profiles where id = p_user;
  if label is null then raise exception 'not_found'; end if;
  if p_user = me then raise exception 'not_allowed'; end if;
  if p_role is null then
    delete from public.admins where user_id = p_user;
  elsif p_role in ('owner', 'admin', 'moderator') then
    insert into public.admins (user_id, role, added_by) values (p_user, p_role, me)
    on conflict (user_id) do update set role = excluded.role;
  else
    raise exception 'invalid_role';
  end if;
  perform public.audit(me, 'set_role', 'user', p_user::text, label, jsonb_build_object('role', p_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- Clashes and groups
-- ---------------------------------------------------------------------------

create function public.admin_clashes()
returns table (
  id uuid, title text, world_id text, access text, format text, creator_handle text,
  starts_at timestamptz, ends_at timestamptz, entries bigint, status text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin('moderator');
  return query
  select c.id, c.title, c.world_id, c.access, c.format, p.handle, c.starts_at, c.ends_at,
    (select count(*) from public.entries e where e.clash_id = c.id),
    case when now() < c.starts_at then 'scheduled' when now() < c.ends_at then 'open' else 'ended' end,
    c.created_at
  from public.clashes c join public.profiles p on p.id = c.creator_id
  order by c.created_at desc
  limit 200;
end;
$$;

create function public.admin_end_clash(p_clash uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin('admin');
  label text;
begin
  update public.clashes
  set starts_at = least(starts_at, now() - interval '1 second'), ends_at = now()
  where id = p_clash and ends_at > now()
  returning title into label;
  if label is null then raise exception 'not_found'; end if;
  perform public.audit(me, 'end_clash', 'clash', p_clash::text, label);
end;
$$;

create function public.admin_groups()
returns table (id uuid, name text, world_id text, visibility text, owner_handle text, members bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin('moderator');
  return query
  select g.id, g.name, g.world_id, g.visibility, p.handle,
    (select count(*) from public.group_members m where m.group_id = g.id), g.created_at
  from public.groups g join public.profiles p on p.id = g.owner_id
  order by g.created_at desc
  limit 200;
end;
$$;

-- ---------------------------------------------------------------------------
-- Four-eyes approvals
-- ---------------------------------------------------------------------------

create function public.admin_request(p_action text, p_target uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin('admin');
  label text;
  request_id uuid;
begin
  if p_action = 'suspend_user' then
    select '@' || handle into label from public.profiles where id = p_target;
    if p_target = me then raise exception 'not_allowed'; end if;
  elsif p_action = 'delete_entry' then
    select coalesce(nullif(caption, ''), 'Video') || ' by @' || p.handle into label
    from public.entries e join public.profiles p on p.id = e.author_id where e.id = p_target;
  elsif p_action = 'delete_group' then
    select name into label from public.groups where id = p_target;
  else
    raise exception 'invalid_action';
  end if;
  if label is null then raise exception 'not_found'; end if;
  if exists (select 1 from public.admin_approvals where action = p_action and target_id = p_target and status = 'pending') then
    raise exception 'already_requested';
  end if;

  insert into public.admin_approvals (action, target_id, target_label, reason, requested_by)
  values (p_action, p_target, label, trim(p_reason), me)
  returning id into request_id;
  perform public.audit(me, 'request_' || p_action, 'approval', request_id::text, label, jsonb_build_object('reason', p_reason));
  return request_id;
end;
$$;

create function public.admin_decide(p_request uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.require_admin('admin');
  request public.admin_approvals;
begin
  select * into request from public.admin_approvals where id = p_request and status = 'pending' for update;
  if request.id is null then raise exception 'not_found'; end if;
  -- Four eyes: whoever asked cannot approve.
  if p_approve and request.requested_by = me then raise exception 'second_admin_required'; end if;

  if p_approve then
    if request.action = 'suspend_user' then
      update public.profiles set suspended_at = now(), suspended_reason = request.reason where id = request.target_id;
    elsif request.action = 'delete_entry' then
      delete from public.entries where id = request.target_id;
    elsif request.action = 'delete_group' then
      delete from public.groups where id = request.target_id;
    end if;
  end if;

  update public.admin_approvals
  set status = case when p_approve then 'approved' else 'rejected' end, decided_by = me, decided_at = now()
  where id = p_request;
  perform public.audit(me, case when p_approve then 'approve_' else 'reject_' end || request.action, 'approval', p_request::text, request.target_label);
end;
$$;

create function public.admin_approvals_list()
returns table (
  id uuid, action text, target_id uuid, target_label text, reason text, status text,
  requested_by_handle text, requested_at timestamptz, decided_by_handle text, decided_at timestamptz, mine boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.require_admin('moderator');
begin
  return query
  select a.id, a.action, a.target_id, a.target_label, a.reason, a.status,
    rq.handle, a.requested_at, dc.handle, a.decided_at, a.requested_by = me
  from public.admin_approvals a
  left join public.profiles rq on rq.id = a.requested_by
  left join public.profiles dc on dc.id = a.decided_by
  order by (a.status = 'pending') desc, a.requested_at desc
  limit 100;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log and team
-- ---------------------------------------------------------------------------

create function public.admin_audit_log()
returns table (id bigint, actor_handle text, action text, target_type text, target_id text, target_label text, details jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin('admin');
  return query
  select e.id, p.handle, e.action, e.target_type, e.target_id, e.target_label, e.details, e.created_at
  from public.audit_events e left join public.profiles p on p.id = e.actor_id
  order by e.created_at desc
  limit 200;
end;
$$;

create function public.admin_team()
returns table (user_id uuid, handle text, display_name text, avatar_url text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin('moderator');
  return query
  select a.user_id, p.handle, p.display_name, p.avatar_url, a.role, a.created_at
  from public.admins a join public.profiles p on p.id = a.user_id
  order by public.admin_rank(a.role) desc, a.created_at;
end;
$$;

-- Every admin function is callable by signed-in users and checks the role itself.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_overview()', 'admin_reports(text)', 'admin_set_report_status(bigint, text, text)',
    'admin_entries(text)', 'admin_set_entry_hidden(uuid, boolean)', 'admin_delete_comment(uuid)',
    'admin_users(text)', 'admin_unsuspend(uuid)', 'admin_revoke_verification(uuid)', 'admin_set_role(uuid, text)',
    'admin_clashes()', 'admin_end_clash(uuid)', 'admin_groups()',
    'admin_request(text, uuid, text)', 'admin_decide(uuid, boolean)', 'admin_approvals_list()',
    'admin_audit_log()', 'admin_team()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;

-- The first team: the client's account and the builder's accounts.
insert into public.admins (user_id, role)
select id, 'owner' from public.profiles where handle in ('happy', 'lewis8', 'bryan')
on conflict do nothing;
