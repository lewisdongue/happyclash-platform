-- Groups rank by the Sparks their members earned in the period.
create function public.group_ranking(p_since timestamptz default '-infinity', p_limit integer default 50)
returns table (group_id uuid, name text, world_id text, members bigint, sparks bigint)
language sql stable security invoker set search_path = '' as $$
  select g.id, g.name, g.world_id,
         (select count(*) from public.group_members m where m.group_id = g.id) as members,
         coalesce((
           select sum(e.sparks_count) from public.entries e
           join public.group_members m on m.user_id = e.author_id and m.group_id = g.id
           where e.created_at >= p_since and e.hidden_at is null
         ), 0)::bigint as sparks
  from public.groups g
  where g.visibility = 'public'
  order by sparks desc, members desc, g.created_at
  limit p_limit;
$$;
grant execute on function public.group_ranking(timestamptz, integer) to anon, authenticated;
