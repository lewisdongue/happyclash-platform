import { supabase } from '@/lib/supabase'

/** Every write below needs a signed-in user; callers check the session first. */

export async function setSpark(entryId: string, userId: string, on: boolean): Promise<void> {
  const query = on
    ? supabase.from('sparks').insert({ entry_id: entryId, user_id: userId })
    : supabase.from('sparks').delete().match({ entry_id: entryId, user_id: userId })
  const { error } = await query
  if (error) throw error
}

export async function postComment(entryId: string, userId: string, body: string, parentId: string | null = null): Promise<void> {
  const { error } = await supabase.from('comments').insert({ entry_id: entryId, author_id: userId, body, parent_id: parentId })
  if (error) throw error
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId)
  if (error) throw error
}

export async function setCommentLike(commentId: string, userId: string, on: boolean): Promise<void> {
  const { error } = on
    ? await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId })
    : await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

/** Ids of the comments of one video that the user liked. */
export async function fetchMyCommentLikes(entryId: string, userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('comment_likes')
    .select('comment_id, comments!inner(entry_id)')
    .eq('user_id', userId)
    .eq('comments.entry_id', entryId)
  if (error) throw error
  return new Set((data ?? []).map((row) => row.comment_id as string))
}

export async function castDuelVote(userId: string, originalId: string, answerId: string, choice: 'original' | 'answer'): Promise<void> {
  const { error } = await supabase.from('duel_votes').insert({ voter_id: userId, original_id: originalId, answer_id: answerId, choice })
  if (error) throw error
}

export async function fetchDuelResults(originalId: string, answerId: string): Promise<{ original: number; answer: number }> {
  const { data, error } = await supabase.from('duel_votes').select('choice').match({ original_id: originalId, answer_id: answerId })
  if (error) throw error
  const original = (data ?? []).filter((vote) => vote.choice === 'original').length
  return { original, answer: (data ?? []).length - original }
}

export async function fetchMySparks(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('sparks').select('entry_id').eq('user_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((row) => row.entry_id))
}

export async function fetchIsFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('follows')
    .select('follower_id', { count: 'exact', head: true })
    .match({ follower_id: followerId, followee_id: followeeId })
  if (error) throw error
  return (count ?? 0) > 0
}

export async function setFollow(followerId: string, followeeId: string, on: boolean): Promise<void> {
  const query = on
    ? supabase.from('follows').insert({ follower_id: followerId, followee_id: followeeId })
    : supabase.from('follows').delete().match({ follower_id: followerId, followee_id: followeeId })
  const { error } = await query
  if (error) throw error
}

const utcDay = () => new Date().toISOString().slice(0, 10)

/** Boosts are unlimited: anyone can boost any video but their own, as often as they like. */
export async function boostEntry(entryId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('boosts').insert({ entry_id: entryId, user_id: userId, day: utcDay() })
  if (!error) return
  if (error.code === '42501') throw new Error('You cannot boost your own video.')
  throw error
}

/** Ids of every talent the user follows, to show the follow button only where it is useful. */
export async function fetchMyFollowing(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('follows').select('followee_id').eq('follower_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((row) => row.followee_id as string))
}
