-- Profile stats and rankings read the stored counters instead of counting rows.
-- Hidden videos never count in public rankings.

create or replace function public.profile_stats(p_profile_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  with mine as (
    select id, world_id, created_at, sparks_count, views_count, clash_backs_count
    from public.entries where author_id = p_profile_id
  )
  select jsonb_build_object(
    'followers', (select count(*) from public.follows where followee_id = p_profile_id),
    'following', (select count(*) from public.follows where follower_id = p_profile_id),
    'videos', (select count(*) from mine),
    'sparks_received', (select coalesce(sum(sparks_count), 0) from mine),
    'clash_backs_received', (select coalesce(sum(clash_backs_count), 0) from mine),
    'views', (select coalesce(sum(views_count), 0) from mine),
    'countries_reached', (select count(distinct v.country) from public.entry_views v join mine m on m.id = v.entry_id where v.country is not null),
    'worlds', coalesce((select jsonb_object_agg(world_id, n) from (select world_id, count(*) n from mine group by world_id) w), '{}'::jsonb),
    'active_days', coalesce((select jsonb_agg(d order by d) from (select distinct (created_at at time zone 'utc')::date d from mine where created_at > now() - interval '84 days') days), '[]'::jsonb)
  );
$$;

create or replace function public.talent_ranking(p_since timestamptz default '-infinity', p_limit integer default 50)
returns table (profile_id uuid, handle text, display_name text, country text, avatar_url text, sparks bigint, videos bigint)
language sql stable set search_path = '' as $$
  select p.id, p.handle, p.display_name, p.country, p.avatar_url,
         sum(e.sparks_count)::bigint as sparks,
         count(e.id) as videos
  from public.profiles p
  join public.entries e on e.author_id = p.id and e.created_at >= p_since and e.hidden_at is null
  group by p.id
  order by sparks desc, videos desc, p.created_at
  limit p_limit;
$$;

create or replace function public.country_ranking(p_since timestamptz default '-infinity', p_limit integer default 50)
returns table (country text, talents bigint, sparks bigint, videos bigint)
language sql stable set search_path = '' as $$
  select p.country,
         count(distinct p.id) as talents,
         sum(e.sparks_count)::bigint as sparks,
         count(e.id) as videos
  from public.profiles p
  join public.entries e on e.author_id = p.id and e.created_at >= p_since and e.hidden_at is null
  where p.country is not null
  group by p.country
  order by sparks desc, videos desc
  limit p_limit;
$$;
