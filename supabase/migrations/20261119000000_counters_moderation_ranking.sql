-- Scale, moderation and ranking.
--
-- 1. Counters live on the entry row, kept exact by triggers, so feeds read
--    one row per video instead of counting four tables per request.
-- 2. Talents report videos; five reports hide a video for everyone but its author.
-- 3. ranked_feed() orders the home feed: fresh and engaging videos first, new
--    and little-seen videos get a boost, videos the viewer already saw sink.
-- 4. Counter changes, comments and new videos are broadcast over Realtime.

-- ---------------------------------------------------------------------------
-- Counters
-- ---------------------------------------------------------------------------

alter table public.entries
  add column sparks_count integer not null default 0,
  add column comments_count integer not null default 0,
  add column views_count integer not null default 0,
  add column clash_backs_count integer not null default 0,
  add column reports_count integer not null default 0,
  add column hidden_at timestamptz;

update public.entries e set
  sparks_count = (select count(*) from public.sparks s where s.entry_id = e.id),
  comments_count = (select count(*) from public.comments c where c.entry_id = e.id),
  views_count = (select count(*) from public.entry_views v where v.entry_id = e.id),
  clash_backs_count = (select count(*) from public.entries a where a.answers_entry_id = e.id);

create function public.bump_entry_counter()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  target uuid;
begin
  if tg_table_name = 'entries' then
    target := coalesce(new.answers_entry_id, old.answers_entry_id);
    if target is null then return null; end if;
    update public.entries set clash_backs_count = greatest(0, clash_backs_count + delta) where id = target;
  else
    target := coalesce(new.entry_id, old.entry_id);
    if tg_table_name = 'sparks' then
      update public.entries set sparks_count = greatest(0, sparks_count + delta) where id = target;
    elsif tg_table_name = 'comments' then
      update public.entries set comments_count = greatest(0, comments_count + delta) where id = target;
    elsif tg_table_name = 'entry_views' then
      update public.entries set views_count = views_count + 1 where id = target;
    end if;
  end if;
  return null;
end;
$$;

create trigger sparks_bump after insert or delete on public.sparks for each row execute function public.bump_entry_counter();
create trigger comments_bump after insert or delete on public.comments for each row execute function public.bump_entry_counter();
create trigger entry_views_bump after insert on public.entry_views for each row execute function public.bump_entry_counter();
create trigger entries_bump_clash_backs after insert or delete on public.entries for each row execute function public.bump_entry_counter();

-- A signed-in viewer counts once per video per hour; replays do not inflate views.
create or replace function public.record_view(p_entry_id uuid, p_country text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.entry_views (entry_id, viewer_id, country)
  select p_entry_id, auth.uid(), case when p_country ~ '^[A-Z]{2}$' then p_country end
  where auth.uid() is null or not exists (
    select 1 from public.entry_views
    where entry_id = p_entry_id and viewer_id = auth.uid() and created_at > now() - interval '1 hour'
  );
$$;
create index entry_views_viewer_idx on public.entry_views (viewer_id, entry_id, created_at desc) where viewer_id is not null;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table public.reports (
  entry_id uuid not null references public.entries (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'nudity', 'violence', 'hate', 'harassment', 'copyright', 'minor_safety', 'other')),
  created_at timestamptz not null default now(),
  primary key (entry_id, reporter_id)
);

alter table public.reports enable row level security;
create policy "Users see their own reports" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy "Users report other talents' videos" on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and not exists (select 1 from public.entries e where e.id = entry_id and e.author_id = (select auth.uid()))
  );

-- Five distinct reports hide the video for everyone except its author.
create function public.apply_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.entries
  set reports_count = reports_count + 1,
      hidden_at = case when reports_count + 1 >= 5 and hidden_at is null then now() else hidden_at end
  where id = new.entry_id;
  return null;
end;
$$;
create trigger reports_apply after insert on public.reports for each row execute function public.apply_report();

grant select, insert on public.reports to authenticated;

drop policy "Entries are visible unless their Clash is closed to you" on public.entries;
create policy "Visible entries" on public.entries for select
  using (
    (hidden_at is null or author_id = (select auth.uid()))
    and (clash_id is null or public.can_view_clash(clash_id))
  );

-- ---------------------------------------------------------------------------
-- Feed view on the stored counters
-- ---------------------------------------------------------------------------

create or replace view public.entry_feed with (security_invoker = true) as
select
  e.id, e.author_id, e.caption, e.world_id, e.video_url, e.poster_url, e.width, e.height, e.duration_ms,
  e.answers_entry_id, e.created_at,
  p.handle as author_handle, p.display_name as author_name, p.country as author_country,
  p.verified as author_verified, p.avatar_url as author_avatar_url,
  e.sparks_count, e.comments_count, e.clash_backs_count, e.views_count,
  e.clash_id,
  e.hidden_at
from public.entries e
join public.profiles p on p.id = e.author_id;

create index entries_sparks_idx on public.entries (sparks_count desc, created_at);

-- ---------------------------------------------------------------------------
-- Ranked feed
-- ---------------------------------------------------------------------------

/**
 * Home feed order. Engagement (Clash Backs weigh most, then Sparks, comments,
 * views) decays with age; videos under six hours old and videos with few
 * views are boosted so newcomers get a chance; videos the viewer saw (by
 * account, or the ids the app remembers for guests) sink; a little noise
 * keeps the order alive between visits. `p_exclude` skips what is loaded.
 */
create function public.ranked_feed(p_limit integer default 20, p_exclude uuid[] default '{}', p_seen uuid[] default '{}')
returns setof public.entry_feed
language sql volatile security invoker set search_path = '' as $$
  select f.*
  from public.entry_feed f
  where f.answers_entry_id is null
    and f.hidden_at is null
    and not (f.id = any (p_exclude))
    and (f.created_at > now() - interval '90 days' or f.sparks_count >= 25)
  order by
    (f.clash_backs_count * 5 + f.sparks_count * 3 + f.comments_count * 2 + ln(f.views_count + 1) + 3)
    / power(extract(epoch from now() - f.created_at) / 3600 + 2, 1.15)
    * case when f.created_at > now() - interval '6 hours' then 2.5 else 1 end
    * case when f.views_count < 30 then 1.6 else 1 end
    * case
        when f.id = any (p_seen) then 0.2
        when exists (select 1 from public.entry_views v where v.entry_id = f.id and v.viewer_id = (select auth.uid())) then 0.2
        else 1
      end
    * (0.85 + random() * 0.3)
    desc
  limit least(greatest(p_limit, 1), 50);
$$;
grant execute on function public.ranked_feed(integer, uuid[], uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime broadcasts (public topics, read-only for clients)
-- ---------------------------------------------------------------------------

create function public.broadcast_entry_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.sparks_count, new.comments_count, new.views_count, new.clash_backs_count)
     is distinct from (old.sparks_count, old.comments_count, old.views_count, old.clash_backs_count) then
    perform realtime.send(
      jsonb_build_object('id', new.id, 'sparks', new.sparks_count, 'comments', new.comments_count,
                         'views', new.views_count, 'clashBacks', new.clash_backs_count),
      'counts', 'entry:' || new.id, false);
    if new.clash_id is not null then
      perform realtime.send(jsonb_build_object('id', new.id), 'changed', 'clash:' || new.clash_id, false);
    end if;
  end if;
  return null;
end;
$$;
create trigger entries_broadcast_counts after update on public.entries
  for each row execute function public.broadcast_entry_counts();

create function public.broadcast_new_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.clash_id is not null then
    perform realtime.send(jsonb_build_object('id', new.id), 'changed', 'clash:' || new.clash_id, false);
  elsif new.answers_entry_id is null then
    perform realtime.send(jsonb_build_object('id', new.id, 'worldId', new.world_id), 'new_entry', 'feed', false);
  end if;
  return null;
end;
$$;
create trigger entries_broadcast_new after insert on public.entries
  for each row execute function public.broadcast_new_entry();

create function public.broadcast_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('id', new.id), 'comment', 'entry:' || new.entry_id, false);
  return null;
end;
$$;
create trigger comments_broadcast after insert on public.comments
  for each row execute function public.broadcast_comment();

revoke execute on function public.bump_entry_counter(), public.apply_report(), public.broadcast_entry_counts(),
  public.broadcast_new_entry(), public.broadcast_comment() from public, anon, authenticated;
