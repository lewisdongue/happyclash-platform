import { supabase } from '@/lib/supabase'
import type { Author, Group, WorldId } from '@/types/domain'
import { toGroup, type GroupFeedRow } from './mappers'

/** Public groups plus the private ones the viewer belongs to, biggest first. */
export async function fetchGroups(): Promise<Group[]> {
  const { data, error } = await supabase.from('group_feed').select('*').order('members_count', { ascending: false }).limit(100)
  if (error) throw error
  return (data as GroupFeedRow[]).map(toGroup)
}

export async function fetchGroup(id: string): Promise<Group | null> {
  const { data, error } = await supabase.from('group_feed').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toGroup(data as GroupFeedRow) : null
}

export type GroupMember = Pick<Author, 'id' | 'handle' | 'displayName' | 'avatarUrl'> & { role: 'owner' | 'member' }

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('role, joined_at, member:profiles(id, handle, display_name, avatar_url)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? []).flatMap((row) => {
    const member = Array.isArray(row.member) ? row.member[0] : row.member
    if (!member) return []
    return [{ id: member.id, handle: member.handle, displayName: member.display_name, avatarUrl: member.avatar_url, role: row.role as GroupMember['role'] }]
  })
}

export interface NewGroup {
  name: string
  description: string
  worldId: WorldId
  visibility: 'public' | 'private'
}

export async function createGroup(ownerId: string, group: NewGroup): Promise<string> {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      owner_id: ownerId,
      name: group.name.trim(),
      description: group.description.trim(),
      world_id: group.worldId,
      visibility: group.visibility,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function joinGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: userId })
  if (error && error.code !== '23505') throw error
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId)
  if (error) throw error
}

export async function joinGroupWithCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group_with_code', { p_code: code })
  if (error) throw new Error(error.message)
  return data as string
}

/** Finds talents by handle or name, for invitations. */
export async function searchProfiles(query: string, excludeId?: string): Promise<Pick<Author, 'id' | 'handle' | 'displayName' | 'avatarUrl'>[]> {
  const term = query.trim().replace(/[%_,()]/g, '')
  if (term.length < 2) return []
  let request = supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_url')
    .or(`handle.ilike.${term}%,display_name.ilike.%${term}%`)
    .limit(8)
  if (excludeId) request = request.neq('id', excludeId)
  const { data, error } = await request
  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.id, handle: row.handle, displayName: row.display_name, avatarUrl: row.avatar_url }))
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) throw error
}
