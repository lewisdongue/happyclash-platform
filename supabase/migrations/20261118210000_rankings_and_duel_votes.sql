-- Talent and country rankings, and blind duel votes.

create function public.talent_ranking(p_since timestamptz default '-infinity', p_limit int default 50)
returns table (profile_id uuid, handle text, display_name text, country text, avatar_url text, sparks bigint, videos bigint)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.handle, p.display_name, p.country, p.avatar_url, count(s.user_id), count(distinct e.id)
  from public.profiles p
  join public.entries e on e.author_id = p.id and e.created_at >= p_since
  left join public.sparks s on s.entry_id = e.id
  group by p.id
  order by 6 desc, 7 desc, p.created_at
  limit p_limit;
$$;

create function public.country_ranking(p_since timestamptz default '-infinity', p_limit int default 50)
returns table (country text, talents bigint, sparks bigint, videos bigint)
language sql stable security invoker set search_path = '' as $$
  select p.country, count(distinct p.id), count(s.user_id), count(distinct e.id)
  from public.profiles p
  join public.entries e on e.author_id = p.id and e.created_at >= p_since
  left join public.sparks s on s.entry_id = e.id
  where p.country is not null
  group by p.country
  order by 3 desc, 4 desc
  limit p_limit;
$$;

grant execute on function public.talent_ranking(timestamptz, int) to anon, authenticated;
grant execute on function public.country_ranking(timestamptz, int) to anon, authenticated;

create table public.duel_votes (
  voter_id uuid not null references public.profiles (id) on delete cascade,
  original_id uuid not null references public.entries (id) on delete cascade,
  answer_id uuid not null references public.entries (id) on delete cascade,
  choice text not null check (choice in ('original', 'answer')),
  created_at timestamptz not null default now(),
  primary key (voter_id, original_id, answer_id)
);
alter table public.duel_votes enable row level security;
create policy "Duel votes are public" on public.duel_votes for select using (true);
create policy "Users vote as themselves" on public.duel_votes for insert with check ((select auth.uid()) = voter_id);

-- Table privileges for the API roles. Row level security still decides which rows each user can touch.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.entries, public.sparks, public.follows, public.comments, public.entry_views, public.duel_votes, public.entry_feed to anon, authenticated;
grant update (display_name, bio, country, avatar_url) on public.profiles to authenticated;
grant insert, delete on public.entries, public.sparks, public.follows, public.comments to authenticated;
grant insert on public.duel_votes to authenticated;
grant execute on function public.profile_stats(uuid), public.talent_ranking(timestamptz, int), public.country_ranking(timestamptz, int) to anon, authenticated;
