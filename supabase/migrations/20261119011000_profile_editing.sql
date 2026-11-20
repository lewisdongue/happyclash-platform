-- Talents edit their name, bio, country and photo; nothing else (not handle, not verified).
revoke update on public.profiles from anon, authenticated;
grant update (display_name, bio, country, avatar_url) on public.profiles to authenticated;

alter table public.profiles
  add constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 40),
  add constraint profiles_bio_length check (char_length(bio) <= 160),
  add constraint profiles_avatar_origin check (
    avatar_url is null or avatar_url ~ '^https://bqovxstyagxytqxswcgb\.supabase\.co/storage/v1/object/public/media/'
  );
