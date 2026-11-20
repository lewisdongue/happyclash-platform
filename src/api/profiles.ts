import { supabase } from '@/lib/supabase'
import type { Profile, ProfileStats, VerifiedPlatform } from '@/types/domain'

export async function fetchProfileByHandle(handle: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, handle, display_name, bio, country, verified, verified_platform, verified_url, avatar_url, created_at')
    .ilike('handle', handle)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    handle: data.handle,
    displayName: data.display_name,
    bio: data.bio,
    country: data.country,
    verified: data.verified,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
    verifiedPlatform: data.verified_platform as VerifiedPlatform | null,
    verifiedUrl: data.verified_url,
  }
}

/** Verifies the signed-in talent with the link of one of their social accounts. */
export async function verifyWithLink(url: string): Promise<{ platform: VerifiedPlatform; url: string }> {
  const { data, error } = await supabase.rpc('verify_with_link', { p_url: url })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as { platform: VerifiedPlatform; url: string }
  return row
}

export async function removeVerification(): Promise<void> {
  const { error } = await supabase.rpc('remove_verification')
  if (error) throw error
}

/** Database messages turned into words a talent understands. */
export function describeVerificationError(error: unknown): string {
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : ''
  if (message.includes('unsupported_site')) return 'Use a link from Instagram, TikTok, Facebook or Snapchat.'
  if (message.includes('invalid_link')) return 'This is not a profile link. Open your profile in the app, tap Share, then Copy link.'
  if (message.includes('link_taken')) return 'This account already verifies another happyClash profile.'
  return 'Verification did not work. Try again.'
}

interface ProfileStatsRow {
  followers: number
  following: number
  videos: number
  sparks_received: number
  clash_backs_received: number
  views: number
  countries_reached: number
  worlds: ProfileStats['worlds']
  active_days: string[]
}

export async function fetchProfileStats(profileId: string): Promise<ProfileStats> {
  const { data, error } = await supabase.rpc('profile_stats', { p_profile_id: profileId })
  if (error) throw error
  const row = data as ProfileStatsRow
  return {
    followers: row.followers,
    following: row.following,
    videos: row.videos,
    sparksReceived: row.sparks_received,
    clashBacksReceived: row.clash_backs_received,
    views: row.views,
    countriesReached: row.countries_reached,
    worlds: row.worlds,
    activeDays: row.active_days,
  }
}

export async function fetchMyProfile(userId: string): Promise<{ handle: string; displayName: string; avatarUrl: string | null } | null> {
  const { data, error } = await supabase.from('profiles').select('handle, display_name, avatar_url').eq('id', userId).maybeSingle()
  if (error) throw error
  return data ? { handle: data.handle, displayName: data.display_name, avatarUrl: data.avatar_url } : null
}

export interface ProfileChanges {
  displayName: string
  bio: string
  country: string | null
  avatarUrl: string | null
}

export async function updateProfile(userId: string, changes: ProfileChanges): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: changes.displayName.trim(),
      bio: changes.bio.trim(),
      country: changes.country,
      avatar_url: changes.avatarUrl,
    })
    .eq('id', userId)
  if (error) throw error
}

export interface ProfileLink {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
}

/** Followers of a profile, or the profiles it follows, newest first. */
export async function fetchFollowList(profileId: string, direction: 'followers' | 'following'): Promise<ProfileLink[]> {
  const query =
    direction === 'followers'
      ? supabase.from('follows').select('person:profiles!follows_follower_id_fkey(id, handle, display_name, avatar_url)').eq('followee_id', profileId)
      : supabase.from('follows').select('person:profiles!follows_followee_id_fkey(id, handle, display_name, avatar_url)').eq('follower_id', profileId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data ?? []).flatMap((row) => {
    const person = Array.isArray(row.person) ? row.person[0] : row.person
    return person ? [{ id: person.id, handle: person.handle, displayName: person.display_name, avatarUrl: person.avatar_url }] : []
  })
}

/** Removes the user's files, then the account and everything it created. */
export async function deleteMyAccount(userId: string): Promise<void> {
  const { data: files } = await supabase.storage.from('media').list(userId, { limit: 1000 })
  if (files && files.length > 0) await supabase.storage.from('media').remove(files.map((file) => `${userId}/${file.name}`))
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
  await supabase.auth.signOut()
}
