-- Boosts: each talent can push three videos a day higher in the feed.
alter table public.entries add column boosts_count integer not null default 0;

create table public.boosts (
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id, day)
);
create index boosts_user_day_idx on public.boosts (user_id, day);

alter table public.boosts enable row level security;
create policy "Users see their own boosts" on public.boosts for select to authenticated using (user_id = (select auth.uid()));
create policy "Users boost as themselves" on public.boosts for insert to authenticated
  with check (user_id = (select auth.uid()) and day = (now() at time zone 'utc')::date);
grant select, insert on public.boosts to authenticated;

create function public.apply_boost()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.boosts where user_id = new.user_id and day = new.day) > 3 then
    raise exception 'daily_boost_limit' using hint = 'Three Boosts a day';
  end if;
  update public.entries set boosts_count = boosts_count + 1 where id = new.entry_id;
  return null;
end;
$$;
create trigger boosts_apply after insert on public.boosts for each row execute function public.apply_boost();
revoke execute on function public.apply_boost() from public, anon, authenticated;

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
    (e.boosts_count * 6 + f.clash_backs_count * 5 + f.sparks_count * 3 + f.comments_count * 2 + ln(f.views_count + 1) + 3)
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
