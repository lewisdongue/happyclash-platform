-- Safety: blocking, reports with a case number, and rate limits.
--
-- 1. Blocking works both ways and needs no report: neither talent sees the
--    other's videos or comments, and neither can follow, spark, comment,
--    invite or Clash Back the other. Blocking also removes follows both ways.
-- 2. Every report (video, talent, Clash, group, comment) opens a case with a
--    public number such as HC-000042 that the reporter can follow in the
--    Safety Center. Video reports still count towards automatic hiding.
-- 3. Rate limits stop bots and vote farming at the database, whatever the client.

-- ---------------------------------------------------------------------------
-- Blocking
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
grant select, insert, delete on public.blocks to authenticated;
create policy "Users see who they blocked" on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy "Users block as themselves" on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "Users unblock as themselves" on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));

-- True when either talent blocked the other.
create function public.blocked_between(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  )
$$;

-- True when the signed-in talent and p_other blocked each other in either direction.
create function public.is_blocked_with(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.blocked_between((select auth.uid()), p_other)
$$;
-- Policies cannot see a blocked talent's rows (RLS hides them), so these look past it.
create function public.blocked_with_entry_author(p_entry_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.is_blocked_with(e.author_id) from public.entries e where e.id = p_entry_id), false)
$$;

create function public.blocked_with_comment_author(p_comment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.is_blocked_with(c.author_id) from public.comments c where c.id = p_comment_id), false)
$$;

revoke execute on function public.blocked_between(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.blocked_with_entry_author(uuid) from public, anon;
revoke execute on function public.blocked_with_comment_author(uuid) from public, anon;
grant execute on function public.blocked_with_entry_author(uuid) to authenticated;
grant execute on function public.blocked_with_comment_author(uuid) to authenticated;
revoke execute on function public.is_blocked_with(uuid) from public;
grant execute on function public.is_blocked_with(uuid) to anon, authenticated;

create function public.drop_follows_on_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return null;
end;
$$;
revoke execute on function public.drop_follows_on_block() from public, anon, authenticated;
create trigger blocks_drop_follows after insert on public.blocks for each row execute function public.drop_follows_on_block();

-- Reading: blocked talents' videos and comments disappear for each other.
drop policy "Visible entries" on public.entries;
create policy "Visible entries" on public.entries for select using (
  (hidden_at is null or author_id = (select auth.uid()))
  and (clash_id is null or public.can_view_clash(clash_id))
  and not public.is_blocked_with(author_id)
);

drop policy "Comments are public" on public.comments;
create policy "Comments are public" on public.comments for select using (not public.is_blocked_with(author_id));

-- Writing: no interaction across a block.
drop policy "Users follow as themselves" on public.follows;
create policy "Users follow as themselves" on public.follows for insert with check (
  (select auth.uid()) = follower_id and not public.is_blocked_with(followee_id)
);

drop policy "Users spark as themselves" on public.sparks;
create policy "Users spark as themselves" on public.sparks for insert with check (
  (select auth.uid()) = user_id
  and not public.blocked_with_entry_author(entry_id)
);

drop policy "Users comment as themselves" on public.comments;
create policy "Users comment as themselves" on public.comments for insert with check (
  (select auth.uid()) = author_id
  and not public.blocked_with_entry_author(entry_id)
  and (parent_id is null or not public.blocked_with_comment_author(parent_id))
);

drop policy "Creators invite to their Clashes" on public.clash_invites;
create policy "Creators invite to their Clashes" on public.clash_invites for insert with check (
  invited_by = (select auth.uid())
  and exists (select 1 from public.clashes c where c.id = clash_id and c.creator_id = (select auth.uid()))
  and not public.is_blocked_with(invitee_id)
);

drop policy "Users post their own entries" on public.entries;
create policy "Users post their own entries" on public.entries for insert to authenticated with check (
  (select auth.uid()) = author_id
  and (clash_id is null or public.can_enter_clash(clash_id))
  and (answers_entry_id is null or not public.blocked_with_entry_author(answers_entry_id))
);

-- ---------------------------------------------------------------------------
-- Reports with a case number
-- ---------------------------------------------------------------------------

create table public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  case_number bigint generated always as identity (start with 1001),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('entry', 'user', 'clash', 'group', 'comment')),
  entry_id uuid references public.entries (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  clash_id uuid references public.clashes (id) on delete set null,
  group_id uuid references public.groups (id) on delete set null,
  comment_id uuid references public.comments (id) on delete set null,
  target_label text not null,
  reason text not null check (reason in ('spam', 'nudity', 'violence', 'hate', 'harassment', 'copyright', 'minor_safety', 'impersonation', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index safety_reports_case_idx on public.safety_reports (case_number);
create unique index safety_reports_once_idx on public.safety_reports
  (reporter_id, target_type, entry_id, profile_id, clash_id, group_id, comment_id) nulls not distinct;
create index safety_reports_queue_idx on public.safety_reports (status, created_at);

alter table public.safety_reports enable row level security;
grant select on public.safety_reports to authenticated;
create policy "Reporters follow their own cases" on public.safety_reports
  for select to authenticated using (reporter_id = (select auth.uid()));

/**
 * Files a report and returns its case number. Reporting the same thing twice
 * returns the existing case. Video reports also feed automatic hiding.
 */
create function public.submit_report(
  p_target_type text, p_target_id uuid, p_reason text, p_details text default null
)
returns table (case_number bigint, already_reported boolean)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  label text;
  owner uuid;
  existing bigint;
  created bigint;
begin
  if me is null then raise exception 'not_signed_in'; end if;

  if p_target_type = 'entry' then
    select e.author_id, coalesce(nullif(e.caption, ''), 'Video') into owner, label from public.entries e where e.id = p_target_id;
  elsif p_target_type = 'user' then
    select p.id, '@' || p.handle into owner, label from public.profiles p where p.id = p_target_id;
  elsif p_target_type = 'clash' then
    select c.creator_id, c.title into owner, label from public.clashes c where c.id = p_target_id;
  elsif p_target_type = 'group' then
    select g.owner_id, g.name into owner, label from public.groups g where g.id = p_target_id;
  elsif p_target_type = 'comment' then
    select c.author_id, left(c.body, 120) into owner, label from public.comments c where c.id = p_target_id;
  else
    raise exception 'invalid_target';
  end if;

  if label is null then raise exception 'not_found'; end if;
  if owner = me then raise exception 'own_content'; end if;

  select r.case_number into existing from public.safety_reports r
  where r.reporter_id = me and r.target_type = p_target_type
    and coalesce(r.entry_id, r.profile_id, r.clash_id, r.group_id, r.comment_id) = p_target_id;
  if existing is not null then
    return query select existing, true;
    return;
  end if;

  insert into public.safety_reports (reporter_id, target_type, entry_id, profile_id, clash_id, group_id, comment_id, target_label, reason, details)
  values (
    me, p_target_type,
    case when p_target_type = 'entry' then p_target_id end,
    case when p_target_type = 'user' then p_target_id end,
    case when p_target_type = 'clash' then p_target_id end,
    case when p_target_type = 'group' then p_target_id end,
    case when p_target_type = 'comment' then p_target_id end,
    label, p_reason, nullif(trim(p_details), '')
  )
  returning safety_reports.case_number into created;

  if p_target_type = 'entry' and p_reason <> 'impersonation' then
    insert into public.reports (entry_id, reporter_id, reason) values (p_target_id, me, p_reason) on conflict do nothing;
  end if;

  return query select created, false;
end;
$$;
revoke execute on function public.submit_report(text, uuid, text, text) from public, anon;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Rate limits
-- ---------------------------------------------------------------------------

create function public.enforce_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  recent integer;
  max_count integer;
  window_size interval;
begin
  if tg_table_name = 'comments' then
    actor := new.author_id; max_count := 12; window_size := interval '1 minute';
    select count(*) into recent from public.comments where author_id = actor and created_at > now() - window_size;
  elsif tg_table_name = 'sparks' then
    actor := new.user_id; max_count := 90; window_size := interval '1 minute';
    select count(*) into recent from public.sparks where user_id = actor and created_at > now() - window_size;
  elsif tg_table_name = 'follows' then
    actor := new.follower_id; max_count := 40; window_size := interval '1 minute';
    select count(*) into recent from public.follows where follower_id = actor and created_at > now() - window_size;
  elsif tg_table_name = 'duel_votes' then
    actor := new.voter_id; max_count := 40; window_size := interval '1 minute';
    select count(*) into recent from public.duel_votes where voter_id = actor and created_at > now() - window_size;
  elsif tg_table_name = 'entries' then
    actor := new.author_id; max_count := 20; window_size := interval '1 hour';
    select count(*) into recent from public.entries where author_id = actor and created_at > now() - window_size;
  elsif tg_table_name = 'safety_reports' then
    actor := new.reporter_id; max_count := 20; window_size := interval '1 hour';
    select count(*) into recent from public.safety_reports where reporter_id = actor and created_at > now() - window_size;
  else
    return new;
  end if;

  if recent >= max_count then
    raise exception 'rate_limited' using hint = 'Slow down a little and try again in a moment.';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_rate_limit() from public, anon, authenticated;

create trigger comments_rate_limit before insert on public.comments for each row execute function public.enforce_rate_limit();
create trigger sparks_rate_limit before insert on public.sparks for each row execute function public.enforce_rate_limit();
create trigger follows_rate_limit before insert on public.follows for each row execute function public.enforce_rate_limit();
create trigger duel_votes_rate_limit before insert on public.duel_votes for each row execute function public.enforce_rate_limit();
create trigger entries_rate_limit before insert on public.entries for each row execute function public.enforce_rate_limit();
create trigger safety_reports_rate_limit before insert on public.safety_reports for each row execute function public.enforce_rate_limit();

create index if not exists comments_author_recent_idx on public.comments (author_id, created_at);
create index if not exists sparks_user_recent_idx on public.sparks (user_id, created_at);
create index if not exists follows_follower_recent_idx on public.follows (follower_id, created_at);
create index if not exists duel_votes_voter_recent_idx on public.duel_votes (voter_id, created_at);
create index if not exists entries_author_recent_idx on public.entries (author_id, created_at);
