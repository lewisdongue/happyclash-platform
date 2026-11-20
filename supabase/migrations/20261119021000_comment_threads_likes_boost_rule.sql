-- Comments get replies (one level) and likes; authors and video owners can delete.
alter table public.comments
  add column parent_id uuid references public.comments (id) on delete cascade,
  add column likes_count integer not null default 0,
  add column replies_count integer not null default 0;
create index comments_parent_idx on public.comments (parent_id, created_at) where parent_id is not null;

create function public.validate_comment_parent()
returns trigger language plpgsql set search_path = '' as $$
declare
  parent record;
begin
  if new.parent_id is null then return new; end if;
  select entry_id, parent_id into parent from public.comments where id = new.parent_id;
  if parent is null or parent.entry_id <> new.entry_id then raise exception 'Reply to a comment of the same video'; end if;
  -- Replies to a reply attach to the thread's top comment, so threads stay one level deep.
  if parent.parent_id is not null then new.parent_id := parent.parent_id; end if;
  return new;
end;
$$;
create trigger comments_validate_parent before insert on public.comments
  for each row execute function public.validate_comment_parent();

create table public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_likes_user_idx on public.comment_likes (user_id);
alter table public.comment_likes enable row level security;
create policy "Comment likes are public" on public.comment_likes for select using (true);
create policy "Users like as themselves" on public.comment_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users unlike their likes" on public.comment_likes for delete to authenticated using (user_id = (select auth.uid()));
grant select on public.comment_likes to anon, authenticated;
grant insert, delete on public.comment_likes to authenticated;

create function public.bump_comment_counters()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  entry uuid;
begin
  if tg_table_name = 'comment_likes' then
    update public.comments set likes_count = greatest(0, likes_count + delta)
    where id = coalesce(new.comment_id, old.comment_id)
    returning entry_id into entry;
  else
    if coalesce(new.parent_id, old.parent_id) is not null then
      update public.comments set replies_count = greatest(0, replies_count + delta) where id = coalesce(new.parent_id, old.parent_id);
    end if;
    entry := coalesce(new.entry_id, old.entry_id);
  end if;
  if entry is not null then
    perform realtime.send(jsonb_build_object('id', coalesce(new.comment_id, old.comment_id, new.id, old.id)), 'comment', 'entry:' || entry, false);
  end if;
  return null;
end;
$$;
create trigger comment_likes_bump after insert or delete on public.comment_likes
  for each row execute function public.bump_comment_counters();
create trigger comments_bump_replies after insert or delete on public.comments
  for each row execute function public.bump_comment_counters();
revoke execute on function public.bump_comment_counters(), public.validate_comment_parent() from public, anon, authenticated;

-- The comment broadcast now comes from bump_comment_counters for inserts and deletes.
drop trigger comments_broadcast on public.comments;
drop function public.broadcast_comment();

drop policy if exists "Users delete their own comments" on public.comments;
create policy "Authors and video owners delete comments" on public.comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (select 1 from public.entries e where e.id = entry_id and e.author_id = (select auth.uid()))
  );
grant delete on public.comments to authenticated;

-- Nobody boosts their own video.
drop policy "Users boost as themselves" on public.boosts;
create policy "Users boost other talents" on public.boosts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and day = (now() at time zone 'utc')::date
    and not exists (select 1 from public.entries e where e.id = entry_id and e.author_id = (select auth.uid()))
  );
