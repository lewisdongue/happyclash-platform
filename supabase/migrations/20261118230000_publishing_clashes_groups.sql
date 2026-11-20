-- Publishing, Clashes and groups.
--
-- Videos are uploaded by their author into the public `media` bucket,
-- under a folder named after their user id. A Clash is a time-boxed
-- challenge; who may see and enter it depends on its access mode.

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload into their own media folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Entries may only point at media served by this app.
alter table public.entries add constraint entries_media_origin check (
  video_url ~ '^(/media/|https://bqovxstyagxytqxswcgb\.supabase\.co/storage/v1/object/public/media/)'
  and (poster_url is null or poster_url ~ '^(/media/|https://bqovxstyagxytqxswcgb\.supabase\.co/storage/v1/object/public/media/)')
);
alter table public.entries add constraint entries_caption_length check (char_length(caption) <= 300);

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  description text not null default '' check (char_length(description) <= 280),
  world_id text not null check (world_id in ('music', 'dance', 'sport', 'comedy', 'art', 'tech', 'lifestyle', 'innovation')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  invite_code text not null unique default encode(extensions.gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- Security definer so policies on group_members can ask about membership
-- without recursing into themselves.
create function public.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = (select auth.uid())
  );
$$;

create function public.add_group_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger groups_add_owner after insert on public.groups
  for each row execute function public.add_group_owner();

/** Joins a private group from its invite link. Returns the group id. */
create function public.join_group_with_code(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to join a group'; end if;
  select id into target from public.groups where invite_code = p_code;
  if target is null then raise exception 'This invite link is not valid'; end if;
  insert into public.group_members (group_id, user_id) values (target, (select auth.uid()))
  on conflict do nothing;
  return target;
end;
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "Public groups and your own groups are visible" on public.groups for select
  using (visibility = 'public' or public.is_group_member(id));
create policy "Users create groups they own" on public.groups for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owners edit their group" on public.groups for update to authenticated
  using (owner_id = (select auth.uid()));
create policy "Owners delete their group" on public.groups for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Members of visible groups are visible" on public.group_members for select
  using (exists (select 1 from public.groups g where g.id = group_id));
create policy "Users join public groups" on public.group_members for insert to authenticated
  with check (
    user_id = (select auth.uid()) and role = 'member'
    and exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'public')
  );
create policy "Users leave groups, owners remove members" on public.group_members for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role = 'member')
    or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = (select auth.uid()) and role = 'member')
  );

create view public.group_feed with (security_invoker = true) as
select
  g.id, g.owner_id, g.name, g.description, g.world_id, g.visibility, g.created_at,
  o.handle as owner_handle,
  (select count(*) from public.group_members m where m.group_id = g.id)::integer as members_count,
  public.is_group_member(g.id) as is_member,
  case when public.is_group_member(g.id) then g.invite_code end as invite_code
from public.groups g
join public.profiles o on o.id = g.owner_id;

-- ---------------------------------------------------------------------------
-- Clashes
-- ---------------------------------------------------------------------------

create table public.clashes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 500),
  world_id text not null check (world_id in ('music', 'dance', 'sport', 'comedy', 'art', 'tech', 'lifestyle', 'innovation')),
  access text not null check (access in ('public', 'private', 'group')),
  format text not null default 'video' check (format in ('video', 'live')),
  group_id uuid references public.groups (id) on delete cascade,
  rival_group_id uuid references public.groups (id) on delete cascade,
  -- Experience Builder
  prize text not null default '' check (char_length(prize) <= 120),
  rules text not null default '' check (char_length(rules) <= 500),
  max_seconds integer not null default 60 check (max_seconds between 10 and 180),
  judging text not null default 'community' check (judging in ('community', 'creator')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint clashes_window check (ends_at > starts_at and ends_at <= starts_at + interval '30 days'),
  constraint clashes_group_access check ((access = 'group') = (group_id is not null)),
  constraint clashes_rival check (rival_group_id is null or (access = 'group' and rival_group_id <> group_id))
);
create index clashes_ends_at_idx on public.clashes (ends_at);

create table public.clash_invites (
  clash_id uuid not null references public.clashes (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clash_id, invitee_id)
);
create index clash_invites_invitee_idx on public.clash_invites (invitee_id);

create function public.can_view_clash(p_clash_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clashes c
    where c.id = p_clash_id and (
      c.access = 'public'
      or c.creator_id = (select auth.uid())
      or (c.access = 'private' and exists (
        select 1 from public.clash_invites i where i.clash_id = c.id and i.invitee_id = (select auth.uid())))
      or (c.access = 'group' and exists (
        select 1 from public.group_members m
        where m.user_id = (select auth.uid()) and m.group_id in (c.group_id, c.rival_group_id)))
    )
  );
$$;

/** True while the Clash takes entries and the signed-in user may enter it. */
create function public.can_enter_clash(p_clash_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_view_clash(p_clash_id) and exists (
    select 1 from public.clashes c
    where c.id = p_clash_id and c.format = 'video' and now() >= c.starts_at and now() < c.ends_at
  );
$$;

create function public.validate_clash_groups()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.group_id is not null and not exists (
    select 1 from public.group_members where group_id = new.group_id and user_id = new.creator_id
  ) then
    raise exception 'You can only start a group Clash for a group you belong to';
  end if;
  if new.rival_group_id is not null and not exists (select 1 from public.groups where id = new.rival_group_id) then
    raise exception 'The rival group does not exist';
  end if;
  return new;
end;
$$;
create trigger clashes_validate_groups before insert or update on public.clashes
  for each row execute function public.validate_clash_groups();

alter table public.clashes enable row level security;
alter table public.clash_invites enable row level security;

create policy "Clashes are visible to the people they are for" on public.clashes for select
  using (public.can_view_clash(id));
create policy "Users start their own Clashes" on public.clashes for insert to authenticated
  with check (creator_id = (select auth.uid()));
create policy "Creators edit their Clashes" on public.clashes for update to authenticated
  using (creator_id = (select auth.uid()));
create policy "Creators delete their Clashes" on public.clashes for delete to authenticated
  using (creator_id = (select auth.uid()));

create policy "Invitees and creators see invites" on public.clash_invites for select to authenticated
  using (
    invitee_id = (select auth.uid())
    or exists (select 1 from public.clashes c where c.id = clash_id and c.creator_id = (select auth.uid()))
  );
create policy "Creators invite to their Clashes" on public.clash_invites for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and exists (select 1 from public.clashes c where c.id = clash_id and c.creator_id = (select auth.uid()))
  );
create policy "Creators withdraw invites" on public.clash_invites for delete to authenticated
  using (exists (select 1 from public.clashes c where c.id = clash_id and c.creator_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Entries inside Clashes
-- ---------------------------------------------------------------------------

alter table public.entries add column clash_id uuid references public.clashes (id) on delete set null;
create unique index entries_one_per_clash on public.entries (clash_id, author_id) where clash_id is not null;

-- An entry takes the world of its Clash, and a Clash Back stays outside Clashes.
create function public.align_entry_with_clash()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.clash_id is not null then
    if new.answers_entry_id is not null then
      raise exception 'A Clash Back cannot also be a Clash entry';
    end if;
    select world_id into new.world_id from public.clashes where id = new.clash_id;
  end if;
  return new;
end;
$$;
create trigger entries_align_with_clash before insert on public.entries
  for each row execute function public.align_entry_with_clash();

drop policy "Entries are public" on public.entries;
create policy "Entries are visible unless their Clash is closed to you" on public.entries for select
  using (clash_id is null or public.can_view_clash(clash_id));

drop policy "Users post their own entries" on public.entries;
create policy "Users post their own entries" on public.entries for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and (clash_id is null or public.can_enter_clash(clash_id))
  );

create or replace view public.entry_feed with (security_invoker = true) as
select
  e.id, e.author_id, e.caption, e.world_id, e.video_url, e.poster_url, e.width, e.height, e.duration_ms,
  e.answers_entry_id, e.created_at,
  p.handle as author_handle, p.display_name as author_name, p.country as author_country,
  p.verified as author_verified, p.avatar_url as author_avatar_url,
  (select count(*) from public.sparks s where s.entry_id = e.id)::integer as sparks_count,
  (select count(*) from public.comments c where c.entry_id = e.id)::integer as comments_count,
  (select count(*) from public.entries a where a.answers_entry_id = e.id)::integer as clash_backs_count,
  (select count(*) from public.entry_views v where v.entry_id = e.id)::integer as views_count,
  e.clash_id
from public.entries e
join public.profiles p on p.id = e.author_id;

create view public.clash_feed with (security_invoker = true) as
select
  c.id, c.creator_id, c.title, c.description, c.world_id, c.access, c.format,
  c.group_id, g.name as group_name, c.rival_group_id, r.name as rival_group_name,
  c.prize, c.rules, c.max_seconds, c.judging, c.starts_at, c.ends_at, c.created_at,
  p.handle as creator_handle, p.display_name as creator_name,
  case when now() < c.starts_at then 'scheduled' when now() < c.ends_at then 'open' else 'ended' end as status,
  (select count(*) from public.entries e where e.clash_id = c.id)::integer as entries_count,
  (select e.poster_url from public.entries e
    where e.clash_id = c.id and e.poster_url is not null
    order by (select count(*) from public.sparks s where s.entry_id = e.id) desc, e.created_at
    limit 1) as cover_url,
  exists (select 1 from public.clash_invites i where i.clash_id = c.id and i.invitee_id = (select auth.uid())) as invited
from public.clashes c
join public.profiles p on p.id = c.creator_id
left join public.groups g on g.id = c.group_id
left join public.groups r on r.id = c.rival_group_id;

/** Sparks earned by each side of a group Clash. */
create function public.clash_group_scores(p_clash_id uuid)
returns table (group_id uuid, name text, points integer)
language sql stable security invoker set search_path = '' as $$
  select g.id, g.name,
    coalesce((
      select count(*)::integer from public.sparks s
      join public.entries e on e.id = s.entry_id
      join public.group_members m on m.user_id = e.author_id and m.group_id = g.id
      where e.clash_id = c.id
    ), 0)
  from public.clashes c
  join public.groups g on g.id in (c.group_id, c.rival_group_id)
  where c.id = p_clash_id;
$$;

-- ---------------------------------------------------------------------------
-- API grants
-- ---------------------------------------------------------------------------

grant select on public.groups, public.group_members, public.group_feed, public.clashes, public.clash_feed to anon, authenticated;
grant select, insert, delete on public.clash_invites to authenticated;
-- Anonymous readers need the grant for clash_feed.invited; policies still show them no rows.
grant select on public.clash_invites to anon;
grant insert, update, delete on public.groups, public.clashes to authenticated;
grant insert, delete on public.group_members to authenticated;
grant select on public.entry_feed to anon, authenticated;

revoke execute on function public.add_group_owner(), public.validate_clash_groups() from public, anon, authenticated;
revoke execute on function public.join_group_with_code(text) from public, anon;
grant execute on function public.join_group_with_code(text) to authenticated;
grant execute on function public.is_group_member(uuid), public.can_view_clash(uuid), public.can_enter_clash(uuid),
  public.clash_group_scores(uuid) to anon, authenticated;
