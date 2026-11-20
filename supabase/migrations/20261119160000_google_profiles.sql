-- Google sign-in: take the real name and photo from Google, and a clean handle.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text := lower(regexp_replace(coalesce(meta ->> 'handle', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g'));
begin
  if base = '' then base := 'talent'; end if;
  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    case when meta ? 'handle' then meta ->> 'handle' else left(base, 20) || '_' || substr(new.id::text, 1, 4) end,
    coalesce(meta ->> 'display_name', meta ->> 'full_name', meta ->> 'name', split_part(new.email, '@', 1)),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture')
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
