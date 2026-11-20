import { markSeen } from '@/lib/seen'
import { supabase } from '@/lib/supabase'
import type { Comment, Entry, WorldId } from '@/types/domain'
import { toEntry, type EntryFeedRow } from './mappers'

export const FEED_PAGE_SIZE = 12

/**
 * The next page of the For You feed, ranked by the database (see ranked_feed).
 * `loaded` are ids already on screen; `seen` are ids this browser watched before.
 */
export async function fetchRankedFeed(loaded: string[], seen: string[]): Promise<Entry[]> {
  const { data, error } = await supabase.rpc('ranked_feed', { p_limit: FEED_PAGE_SIZE, p_exclude: loaded, p_seen: seen })
  if (error) throw error
  return (data as EntryFeedRow[]).map(toEntry)
}

/** Videos from the talents a user follows, newest first, paged by date. */
export async function fetchFollowingFeed(userId: string, before: string | null): Promise<Entry[]> {
  const { data: follows, error: followsError } = await supabase.from('follows').select('followee_id').eq('follower_id', userId)
  if (followsError) throw followsError
  const ids = (follows ?? []).map((row) => row.followee_id as string)
  if (ids.length === 0) return []
  let query = supabase
    .from('entry_feed')
    .select('*')
    .in('author_id', ids)
    .is('answers_entry_id', null)
    .is('hidden_at', null)
    .order('created_at', { ascending: false })
    .limit(FEED_PAGE_SIZE)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) throw error
  return (data as EntryFeedRow[]).map(toEntry)
}

/** Deletes one of the user's videos and its files. */
export async function deleteEntry(entry: Entry): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', entry.id)
  if (error) throw error
  const marker = '/storage/v1/object/public/media/'
  const paths = [entry.videoUrl, entry.posterUrl]
    .filter((url): url is string => Boolean(url?.includes(marker)))
    .map((url) => url.slice(url.indexOf(marker) + marker.length))
  // The row is gone either way; leftover files are harmless if this fails.
  if (paths.length > 0) await supabase.storage.from('media').remove(paths)
}

export async function fetchEntry(id: string): Promise<Entry | null> {
  const { data, error } = await supabase.from('entry_feed').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toEntry(data as EntryFeedRow) : null
}

/** Clash Backs answering one entry, most sparked first. */
export async function fetchClashBacks(entryId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entry_feed')
    .select('*')
    .eq('answers_entry_id', entryId)
    .order('sparks_count', { ascending: false })
  if (error) throw error
  return (data as EntryFeedRow[]).map(toEntry)
}

export async function fetchEntriesByAuthor(authorId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entry_feed')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as EntryFeedRow[]).map(toEntry)
}

/** The best videos of one Talent World: most Sparks first, newest on a tie. */
export async function fetchWorldEntries(worldId: WorldId, limit = 30): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entry_feed')
    .select('*')
    .eq('world_id', worldId)
    .is('answers_entry_id', null)
    .is('hidden_at', null)
    .order('sparks_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as EntryFeedRow[]).map(toEntry)
}

/**
 * The conversation under a video: top comments ranked by likes then recency,
 * each followed by its replies in order. Threads are one level deep.
 */
export async function fetchComments(entryId: string, limit = 200): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, body, created_at, parent_id, likes_count, replies_count, author:profiles!comments_author_id_fkey(id, handle, display_name, avatar_url)')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  const all = (data ?? []).map((row) => {
    const author = Array.isArray(row.author) ? row.author[0] : row.author
    return {
      id: row.id as string,
      body: row.body as string,
      createdAt: row.created_at as string,
      parentId: row.parent_id as string | null,
      likes: row.likes_count as number,
      replies: row.replies_count as number,
      author: {
        id: author?.id ?? '',
        handle: author?.handle ?? 'unknown',
        displayName: author?.display_name ?? 'Unknown',
        avatarUrl: author?.avatar_url ?? null,
      },
    }
  })
  const tops = all
    .filter((comment) => comment.parentId === null)
    .sort((a, b) => b.likes - a.likes || b.createdAt.localeCompare(a.createdAt))
  return tops.flatMap((top) => [top, ...all.filter((comment) => comment.parentId === top.id)])
}

/** The viewer's country as the browser's language settings state it (fr-CM → CM), if any. */
function viewerCountry(): string | null {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const region = tag.split('-')[1]
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase()
  }
  return null
}

/** Counts one view. Fire and forget: a failed view must never disturb playback. */
export function recordView(entryId: string): void {
  markSeen(entryId)
  // The query builder is lazy: it only sends the request once awaited or then'd.
  supabase.rpc('record_view', { p_entry_id: entryId, p_country: viewerCountry() }).then(() => undefined)
}
