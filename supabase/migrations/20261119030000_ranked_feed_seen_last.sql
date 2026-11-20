-- Videos the viewer already watched come only after every unseen one.
create or replace function public.ranked_feed(p_limit integer default 20, p_exclude uuid[] default '{}', p_seen uuid[] default '{}')
returns setof public.entry_feed
language sql volatile security invoker set search_path = '' as $$
  select f.*
  from public.entry_feed f
  join public.entries e on e.id = f.id
  where f.answers_entry_id is null
    and f.hidden_at is null
    and not (f.id = any (p_exclude))
    and (f.created_at > now() - interval '90 days' or f.sparks_count >= 25)
  order by
    (f.id = any (p_seen)
      or exists (select 1 from public.entry_views v where v.entry_id = f.id and v.viewer_id = (select auth.uid()))) asc,
    (e.boosts_count * 6 + f.clash_backs_count * 5 + f.sparks_count * 3 + f.comments_count * 2 + ln(f.views_count + 1) + 3)
    / power(extract(epoch from now() - f.created_at) / 3600 + 2, 1.15)
    * case when f.created_at > now() - interval '6 hours' then 2.5 else 1 end
    * case when f.views_count < 30 then 1.6 else 1 end
    * (0.85 + random() * 0.3)
    desc
  limit least(greatest(p_limit, 1), 50);
$$;
