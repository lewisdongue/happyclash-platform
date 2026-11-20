-- Clashes judged by their creator store the chosen winner.
alter table public.clashes add column winner_entry_id uuid references public.entries (id) on delete set null;

create function public.validate_clash_winner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.winner_entry_id is distinct from old.winner_entry_id and new.winner_entry_id is not null then
    if new.judging <> 'creator' then raise exception 'Sparks pick the winner of this Clash'; end if;
    if now() < new.ends_at then raise exception 'Pick the winner once the Clash has ended'; end if;
    if not exists (select 1 from public.entries where id = new.winner_entry_id and clash_id = new.id) then
      raise exception 'The winner must be an entry of this Clash';
    end if;
  end if;
  return new;
end;
$$;
create trigger clashes_validate_winner before update on public.clashes
  for each row execute function public.validate_clash_winner();
revoke execute on function public.validate_clash_winner() from public, anon, authenticated;

create or replace view public.clash_feed with (security_invoker = true) as
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
  exists (select 1 from public.clash_invites i where i.clash_id = c.id and i.invitee_id = (select auth.uid())) as invited,
  c.winner_entry_id
from public.clashes c
join public.profiles p on p.id = c.creator_id
left join public.groups g on g.id = c.group_id
left join public.groups r on r.id = c.rival_group_id;
