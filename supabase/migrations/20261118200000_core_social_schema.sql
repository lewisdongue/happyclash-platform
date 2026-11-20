-- Core social graph: profiles, entries (videos), sparks, follows, comments, views.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  display_name text not null,
  bio text not null default '',
  country text check (country ~ '^[A-Z]{2}$'),
  avatar_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_handle_key on public.profiles (lower(handle));

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  caption text not null default '',
  world_id text not null check (world_id in ('music','dance','sport','comedy','art','tech','lifestyle','innovation')),
  video_url text not null,
  poster_url text,
  width integer,
  height integer,
  duration_ms integer,
  answers_entry_id uuid references public.entries (id) on delete set null,
  created_at timestamptz not null default now()
);
create index entries_author_idx on public.entries (author_id, created_at desc);
create index entries_answers_idx on public.entries (answers_entry_id) where answers_entry_id is not null;
create index entries_created_idx on public.entries (created_at desc);

create table public.sparks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);
create index sparks_entry_idx on public.sparks (entry_id);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_entry_idx on public.comments (entry_id, created_at desc);

-- Views are written only through record_view(), never directly.
create table public.entry_views (
  id bigint generated always as identity primary key,
  entry_id uuid not null references public.entries (id) on delete cascade,
  viewer_id uuid references public.profiles (id) on delete set null,
  country text check (country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now()
);
create index entry_views_entry_idx on public.entry_views (entry_id);

-- Row level security: everything is publicly readable, writes belong to their owner.
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.sparks enable row level security;
alter table public.follows enable row level security;
alter table public.comments enable row level security;
alter table public.entry_views enable row level security;

create policy "Profiles are public" on public.profiles for select using (true);
create policy "Users edit their own profile" on public.profiles for update using ((select auth.uid()) = id);
create policy "Entries are public" on public.entries for select using (true);
create policy "Users post their own entries" on public.entries for insert with check ((select auth.uid()) = author_id);
create policy "Users delete their own entries" on public.entries for delete using ((select auth.uid()) = author_id);
create policy "Sparks are public" on public.sparks for select using (true);
create policy "Users spark as themselves" on public.sparks for insert with check ((select auth.uid()) = user_id);
create policy "Users remove their own sparks" on public.sparks for delete using ((select auth.uid()) = user_id);
create policy "Follows are public" on public.follows for select using (true);
create policy "Users follow as themselves" on public.follows for insert with check ((select auth.uid()) = follower_id);
create policy "Users unfollow as themselves" on public.follows for delete using ((select auth.uid()) = follower_id);
create policy "Comments are public" on public.comments for select using (true);
create policy "Users comment as themselves" on public.comments for insert with check ((select auth.uid()) = author_id);
create policy "Users delete their own comments" on public.comments for delete using ((select auth.uid()) = author_id);
create policy "View counts are public" on public.entry_views for select using (true);

-- Feed rows with their live counters.
create view public.entry_feed with (security_invoker = true) as
select
  e.*,
  p.handle as author_handle,
  p.display_name as author_name,
  p.country as author_country,
  p.verified as author_verified,
  p.avatar_url as author_avatar_url,
  (select count(*) from public.sparks s where s.entry_id = e.id)::int as sparks_count,
  (select count(*) from public.comments c where c.entry_id = e.id)::int as comments_count,
  (select count(*) from public.entries a where a.answers_entry_id = e.id)::int as clash_backs_count,
  (select count(*) from public.entry_views v where v.entry_id = e.id)::int as views_count
from public.entries e
join public.profiles p on p.id = e.author_id;

create function public.record_view(p_entry_id uuid, p_country text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.entry_views (entry_id, viewer_id, country)
  values (p_entry_id, auth.uid(), case when p_country ~ '^[A-Z]{2}$' then p_country end);
$$;
grant execute on function public.record_view(uuid, text) to anon, authenticated;

-- Everything the profile page shows, computed from real activity.
create function public.profile_stats(p_profile_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with mine as (select id, world_id, created_at from public.entries where author_id = p_profile_id)
  select jsonb_build_object(
    'followers', (select count(*) from public.follows where followee_id = p_profile_id),
    'following', (select count(*) from public.follows where follower_id = p_profile_id),
    'videos', (select count(*) from mine),
    'sparks_received', (select count(*) from public.sparks s join mine m on m.id = s.entry_id),
    'clash_backs_received', (select count(*) from public.entries a join mine m on m.id = a.answers_entry_id),
    'views', (select count(*) from public.entry_views v join mine m on m.id = v.entry_id),
    'countries_reached', (select count(distinct v.country) from public.entry_views v join mine m on m.id = v.entry_id where v.country is not null),
    'worlds', coalesce((select jsonb_object_agg(world_id, n) from (select world_id, count(*) n from mine group by world_id) w), '{}'::jsonb),
    'active_days', coalesce((select jsonb_agg(d order by d) from (select distinct (created_at at time zone 'utc')::date d from mine where created_at > now() - interval '84 days') days), '[]'::jsonb)
  );
$$;
grant execute on function public.profile_stats(uuid) to anon, authenticated;

-- Every new account gets a profile. Handle and name come from sign-up metadata.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'handle', split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;
