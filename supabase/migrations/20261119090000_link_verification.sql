-- Verification by social account link.
--
-- A talent pastes the link of their Instagram, TikTok, Facebook or Snapchat
-- profile and is verified at once. The link must be a real profile address on
-- one of those sites, and one link verifies one HappyClash account only, so a
-- famous account cannot be claimed twice. The link shows on the profile, so
-- anyone can open it and check.

alter table public.profiles
  add column verified_platform text check (verified_platform in ('instagram', 'tiktok', 'facebook', 'snapchat')),
  add column verified_url text,
  add column verified_at timestamptz;

create unique index profiles_verified_url_idx on public.profiles (lower(verified_url)) where verified_url is not null;

/**
 * Checks a profile link, keeps its canonical form and verifies the caller.
 * Returns the platform and the canonical link.
 */
create function public.verify_with_link(p_url text)
returns table (platform text, url text)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  raw text := lower(trim(p_url));
  host text;
  path text;
  username text;
  found_platform text;
  canonical text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if raw is null or raw = '' then raise exception 'invalid_link'; end if;

  -- Accept links with or without https:// and www.
  raw := regexp_replace(raw, '^https?://', '');
  raw := regexp_replace(raw, '^(www\.|m\.|web\.)', '');
  host := split_part(raw, '/', 1);
  path := substr(raw, length(host) + 2);
  path := regexp_replace(path, '[?#].*$', '');
  path := regexp_replace(path, '/+$', '');

  if host in ('instagram.com', 'instagr.am') then
    username := substring(path from '^([a-z0-9._]{1,30})$');
    if username in ('p', 'reel', 'reels', 'explore', 'accounts', 'stories') then username := null; end if;
    found_platform := 'instagram';
    canonical := 'https://www.instagram.com/' || username;
  elsif host = 'tiktok.com' then
    username := substring(path from '^@([a-z0-9._]{2,24})$');
    found_platform := 'tiktok';
    canonical := 'https://www.tiktok.com/@' || username;
  elsif host in ('facebook.com', 'fb.com') then
    if path = 'profile.php' then
      username := substring(lower(trim(p_url)) from '[?&]id=([0-9]{5,20})');
      canonical := 'https://www.facebook.com/profile.php?id=' || username;
    else
      username := substring(path from '^([a-z0-9.]{5,50})$');
      if username in ('watch', 'groups', 'events', 'marketplace', 'share', 'login', 'pages', 'reel', 'photo.php') then username := null; end if;
      canonical := 'https://www.facebook.com/' || username;
    end if;
    found_platform := 'facebook';
  elsif host = 'snapchat.com' then
    username := coalesce(substring(path from '^add/([a-z0-9._-]{3,15})$'), substring(path from '^@([a-z0-9._-]{3,15})$'));
    found_platform := 'snapchat';
    canonical := 'https://www.snapchat.com/add/' || username;
  else
    raise exception 'unsupported_site';
  end if;

  if username is null then raise exception 'invalid_link'; end if;

  if exists (select 1 from public.profiles where lower(verified_url) = lower(canonical) and id <> me) then
    raise exception 'link_taken';
  end if;

  update public.profiles
  set verified = true, verified_platform = found_platform, verified_url = canonical, verified_at = now()
  where id = me;

  return query select found_platform, canonical;
end;
$$;
revoke execute on function public.verify_with_link(text) from public, anon;
grant execute on function public.verify_with_link(text) to authenticated;

-- Removing the link removes the badge.
create function public.remove_verification()
returns void language sql security definer set search_path = '' as $$
  update public.profiles
  set verified = false, verified_platform = null, verified_url = null, verified_at = null
  where id = (select auth.uid());
$$;
revoke execute on function public.remove_verification() from public, anon;
grant execute on function public.remove_verification() to authenticated;
