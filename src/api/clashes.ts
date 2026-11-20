import { supabase } from '@/lib/supabase'
import type { Clash, ClashAccess, ClashFormat, ClashJudging, Entry, GroupScore, WorldId } from '@/types/domain'
import { toClash, toEntry, type ClashFeedRow, type EntryFeedRow } from './mappers'

/**
 * Every Clash the viewer may see, soonest to end first. Row level security
 * already hides private and group Clashes from people they are not for.
 */
export async function fetchClashes(): Promise<Clash[]> {
  const { data, error } = await supabase
    .from('clash_feed')
    .select('*')
    .gte('ends_at', new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
    .order('ends_at', { ascending: true })
    .limit(100)
  if (error) throw error
  return (data as ClashFeedRow[]).map(toClash)
}

export async function fetchClash(id: string): Promise<Clash | null> {
  const { data, error } = await supabase.from('clash_feed').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toClash(data as ClashFeedRow) : null
}

export async function fetchClashesForGroup(groupId: string): Promise<Clash[]> {
  const { data, error } = await supabase
    .from('clash_feed')
    .select('*')
    .or(`group_id.eq.${groupId},rival_group_id.eq.${groupId}`)
    .order('ends_at', { ascending: false })
  if (error) throw error
  return (data as ClashFeedRow[]).map(toClash)
}

/** Entries of one Clash, ranked by sparks, earliest first on a tie. */
export async function fetchClashEntries(clashId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entry_feed')
    .select('*')
    .eq('clash_id', clashId)
    .order('sparks_count', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as EntryFeedRow[]).map(toEntry)
}

export async function fetchGroupScores(clashId: string): Promise<GroupScore[]> {
  const { data, error } = await supabase.rpc('clash_group_scores', { p_clash_id: clashId })
  if (error) throw error
  return (data as { group_id: string; name: string; points: number }[]).map((row) => ({
    groupId: row.group_id,
    name: row.name,
    points: row.points,
  }))
}

export interface NewClash {
  title: string
  description: string
  worldId: WorldId
  access: ClashAccess
  groupId: string | null
  rivalGroupId: string | null
  prize: string
  rules: string
  maxSeconds: number
  judging: ClashJudging
  /** A live Clash happens on stage in real time instead of with uploaded videos. */
  format: ClashFormat
  /** Null opens the Clash at the database's own clock. */
  startsAt: Date | null
  endsAt: Date
  inviteeIds: string[]
}

export async function createClash(creatorId: string, clash: NewClash): Promise<string> {
  const { data, error } = await supabase
    .from('clashes')
    .insert({
      creator_id: creatorId,
      title: clash.title.trim(),
      description: clash.description.trim(),
      world_id: clash.worldId,
      access: clash.access,
      group_id: clash.access === 'group' ? clash.groupId : null,
      rival_group_id: clash.access === 'group' ? clash.rivalGroupId : null,
      prize: clash.prize.trim(),
      rules: clash.rules.trim(),
      max_seconds: clash.maxSeconds,
      judging: clash.judging,
      format: clash.format,
      ...(clash.startsAt && { starts_at: clash.startsAt.toISOString() }),
      ends_at: clash.endsAt.toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  const id = data.id as string
  if (clash.access === 'private' && clash.inviteeIds.length > 0) await inviteToClash(id, creatorId, clash.inviteeIds)
  return id
}

export async function inviteToClash(clashId: string, invitedBy: string, inviteeIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('clash_invites')
    .upsert(inviteeIds.map((invitee_id) => ({ clash_id: clashId, invitee_id, invited_by: invitedBy })), { ignoreDuplicates: true })
  if (error) throw error
}

export async function fetchClashInvitees(clashId: string): Promise<{ id: string; handle: string; displayName: string }[]> {
  const { data, error } = await supabase
    .from('clash_invites')
    .select('invitee:profiles!clash_invites_invitee_id_fkey(id, handle, display_name)')
    .eq('clash_id', clashId)
  if (error) throw error
  return (data ?? []).flatMap((row) => {
    const invitee = Array.isArray(row.invitee) ? row.invitee[0] : row.invitee
    return invitee ? [{ id: invitee.id, handle: invitee.handle, displayName: invitee.display_name }] : []
  })
}

export async function deleteClash(id: string): Promise<void> {
  const { error } = await supabase.from('clashes').delete().eq('id', id)
  if (error) throw error
}

export async function pickClashWinner(clashId: string, entryId: string): Promise<void> {
  const { error } = await supabase.from('clashes').update({ winner_entry_id: entryId }).eq('id', clashId)
  if (error) throw new Error(error.message)
}

/** Clashes the user started, newest first. */
export async function fetchMyClashes(userId: string): Promise<Clash[]> {
  const { data, error } = await supabase.from('clash_feed').select('*').eq('creator_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return (data as ClashFeedRow[]).map(toClash)
}
