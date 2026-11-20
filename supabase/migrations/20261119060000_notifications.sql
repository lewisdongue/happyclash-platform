-- Activity: notifications for everything that happens around a talent.
--
-- Rows are written only by triggers (social actions) and by a cron job
-- (Clash reminders); clients read, mark as read and dismiss their own.
-- Each new row pings the recipient on the Realtime topic `notify:<user id>`.
-- The ping carries no data: the client reads its rows again through RLS.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'follow', 'spark', 'comment', 'reply', 'comment_like',
    'clash_back', 'clash_entry', 'clash_invite', 'group_join',
    'clash_starting', 'clash_open', 'clash_ended'
  )),
  entry_id uuid references public.entries (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  clash_id uuid references public.clashes (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- The same event never notifies twice (a Spark taken back and given again, a reminder run twice).
create unique index notifications_once_idx on public.notifications
  (recipient_id, kind, actor_id, entry_id, comment_id, clash_id, group_id) nulls not distinct;
create index notifications_inbox_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;
grant select, delete on public.notifications to authenticated;
create policy "Users read their own notifications" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy "Users dismiss their own notifications" on public.notifications
  for delete to authenticated using (recipient_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Writing and reading
-- ---------------------------------------------------------------------------

create function public.notify(
  p_recipient uuid, p_actor uuid, p_kind text,
  p_entry uuid default null, p_comment uuid default null, p_clash uuid default null, p_group uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_recipient is null or p_recipient = p_actor then return; end if;
  insert into public.notifications (recipient_id, actor_id, kind, entry_id, comment_id, clash_id, group_id)
  values (p_recipient, p_actor, p_kind, p_entry, p_comment, p_clash, p_group)
  on conflict do nothing;
  if found then
    perform realtime.send('{}'::jsonb, 'new', 'notify:' || p_recipient, false);
  end if;
end;
$$;
revoke execute on function public.notify(uuid, uuid, text, uuid, uuid, uuid, uuid) from public, anon, authenticated;

create function public.mark_notifications_read()
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where recipient_id = (select auth.uid()) and read_at is null;
$$;
revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Social triggers
-- ---------------------------------------------------------------------------

create function public.notify_on_social()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
  parent_author uuid;
  video uuid;
begin
  if tg_table_name = 'follows' then
    perform public.notify(new.followee_id, new.follower_id, 'follow');

  elsif tg_table_name = 'sparks' then
    select author_id into owner from public.entries where id = new.entry_id;
    perform public.notify(owner, new.user_id, 'spark', new.entry_id);

  elsif tg_table_name = 'comment_likes' then
    select author_id, entry_id into owner, video from public.comments where id = new.comment_id;
    perform public.notify(owner, new.user_id, 'comment_like', video, new.comment_id);

  elsif tg_table_name = 'comments' then
    select author_id into owner from public.entries where id = new.entry_id;
    if new.parent_id is not null then
      select author_id into parent_author from public.comments where id = new.parent_id;
      perform public.notify(parent_author, new.author_id, 'reply', new.entry_id, new.id);
    end if;
    if owner is distinct from parent_author then
      perform public.notify(owner, new.author_id, 'comment', new.entry_id, new.id);
    end if;

  elsif tg_table_name = 'entries' then
    if new.answers_entry_id is not null then
      select author_id into owner from public.entries where id = new.answers_entry_id;
      perform public.notify(owner, new.author_id, 'clash_back', new.answers_entry_id);
    end if;
    if new.clash_id is not null then
      select creator_id into owner from public.clashes where id = new.clash_id;
      perform public.notify(owner, new.author_id, 'clash_entry', new.id, null, new.clash_id);
    end if;

  elsif tg_table_name = 'clash_invites' then
    perform public.notify(new.invitee_id, new.invited_by, 'clash_invite', null, null, new.clash_id);

  elsif tg_table_name = 'group_members' then
    select owner_id into owner from public.groups where id = new.group_id;
    perform public.notify(owner, new.user_id, 'group_join', null, null, null, new.group_id);
  end if;
  return null;
end;
$$;

create trigger follows_notify after insert on public.follows for each row execute function public.notify_on_social();
create trigger sparks_notify after insert on public.sparks for each row execute function public.notify_on_social();
create trigger comment_likes_notify after insert on public.comment_likes for each row execute function public.notify_on_social();
create trigger comments_notify after insert on public.comments for each row execute function public.notify_on_social();
create trigger entries_notify after insert on public.entries for each row execute function public.notify_on_social();
create trigger clash_invites_notify after insert on public.clash_invites for each row execute function public.notify_on_social();
create trigger group_members_notify after insert on public.group_members for each row execute function public.notify_on_social();

-- Taking back a Spark, a like or a follow also takes back its unread notification.
create function public.unnotify_on_social()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'follows' then
    delete from public.notifications
    where kind = 'follow' and recipient_id = old.followee_id and actor_id = old.follower_id and read_at is null;
  elsif tg_table_name = 'sparks' then
    delete from public.notifications
    where kind = 'spark' and entry_id = old.entry_id and actor_id = old.user_id and read_at is null;
  elsif tg_table_name = 'comment_likes' then
    delete from public.notifications
    where kind = 'comment_like' and comment_id = old.comment_id and actor_id = old.user_id and read_at is null;
  end if;
  return null;
end;
$$;

create trigger follows_unnotify after delete on public.follows for each row execute function public.unnotify_on_social();
create trigger sparks_unnotify after delete on public.sparks for each row execute function public.unnotify_on_social();
create trigger comment_likes_unnotify after delete on public.comment_likes for each row execute function public.unnotify_on_social();

-- ---------------------------------------------------------------------------
-- Clash reminders (every five minutes)
-- ---------------------------------------------------------------------------

-- Everyone a Clash concerns: its creator, invited talents and members of both groups.
create function public.clash_audience(p_clash_id uuid)
returns table (user_id uuid) language sql stable security definer set search_path = '' as $$
  select c.creator_id from public.clashes c where c.id = p_clash_id
  union
  select i.invitee_id from public.clash_invites i where i.clash_id = p_clash_id
  union
  select m.user_id from public.clashes c
    join public.group_members m on m.group_id in (c.group_id, c.rival_group_id)
  where c.id = p_clash_id
$$;

create function public.send_clash_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare
  clash record;
  person record;
begin
  -- Starts within 15 minutes: only for Clashes scheduled ahead of time.
  for clash in
    select id, creator_id from public.clashes
    where starts_at > now() and starts_at <= now() + interval '15 minutes'
      and starts_at - created_at > interval '20 minutes'
  loop
    for person in select user_id from public.clash_audience(clash.id) loop
      perform public.notify(person.user_id, null, 'clash_starting', null, null, clash.id);
    end loop;
  end loop;

  -- Opened in the last 15 minutes: scheduled Clashes that just went live.
  for clash in
    select id from public.clashes
    where starts_at <= now() and starts_at > now() - interval '15 minutes'
      and starts_at - created_at > interval '5 minutes'
  loop
    for person in select user_id from public.clash_audience(clash.id) loop
      perform public.notify(person.user_id, null, 'clash_open', null, null, clash.id);
    end loop;
  end loop;

  -- Ended in the last day: the audience and every talent who entered.
  for clash in
    select id from public.clashes where ends_at <= now() and ends_at > now() - interval '1 day'
  loop
    for person in
      select user_id from public.clash_audience(clash.id)
      union
      select author_id from public.entries where clash_id = clash.id
    loop
      perform public.notify(person.user_id, null, 'clash_ended', null, null, clash.id);
    end loop;
  end loop;
end;
$$;
revoke execute on function public.send_clash_reminders() from public, anon, authenticated;
revoke execute on function public.clash_audience(uuid) from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('clash-reminders', '*/5 * * * *', 'select public.send_clash_reminders()');

-- Trigger functions run only from their triggers.
revoke execute on function public.notify_on_social() from public, anon, authenticated;
revoke execute on function public.unnotify_on_social() from public, anon, authenticated;
