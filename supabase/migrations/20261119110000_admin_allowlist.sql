-- Public copy: the production admin e-mail addresses are replaced by admin@example.com.
-- The Admin Console is reserved to three accounts. Nobody else can be given
-- a role, even by an owner.

create function public.admins_allowlist()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from auth.users
    where id = new.user_id
      and lower(email) in ('admin@example.com')
  ) then
    raise exception 'not_allowed' using hint = 'Only the HappyClash team accounts can access the Admin Console.';
  end if;
  return new;
end;
$$;
revoke execute on function public.admins_allowlist() from public, anon, authenticated;

create trigger admins_allowlist before insert or update on public.admins
  for each row execute function public.admins_allowlist();

-- Anything outside the list is removed.
delete from public.admins a
where not exists (
  select 1 from auth.users u
  where u.id = a.user_id and lower(u.email) in ('admin@example.com')
);
