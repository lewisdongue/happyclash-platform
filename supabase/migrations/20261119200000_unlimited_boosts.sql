-- Boosts are unlimited: one row per Boost, no daily cap. Own videos stay blocked by RLS.
alter table public.boosts drop constraint boosts_pkey;
alter table public.boosts add column id bigint generated always as identity primary key;

create or replace function public.apply_boost() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.entries set boosts_count = boosts_count + 1 where id = new.entry_id;
  return new;
end $$;
