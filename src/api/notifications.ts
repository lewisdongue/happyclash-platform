import { supabase } from '@/lib/supabase'
import type { WorldId } from '@/types/domain'

export type NotificationKind =
  | 'follow'
  | 'spark'
  | 'comment'
  | 'reply'
  | 'comment_like'
  | 'clash_back'
  | 'clash_entry'
  | 'clash_invite'
  | 'group_join'
  | 'clash_starting'
  | 'clash_open'
  | 'clash_ended'
  | 'report_update'

export interface Notification {
  id: string
  kind: NotificationKind
  createdAt: string
  read: boolean
  actor: { handle: string; displayName: string; avatarUrl: string | null } | null
  entry: { id: string; posterUrl: string | null; worldId: WorldId } | null
  comment: { body: string } | null
  clash: { id: string; title: string; worldId: WorldId } | null
  group: { id: string; name: string; worldId: WorldId } | null
  /** Case number when a report the user filed was closed. */
  reportCase: number | null
}

export const NOTIFICATIONS_PAGE_SIZE = 30

const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value)

/** The signed-in user's notifications, newest first, one page before `before`. */
export async function fetchNotifications(before: string | null): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select(
      `id, kind, created_at, read_at, report_case,
       actor:profiles!notifications_actor_id_fkey(handle, display_name, avatar_url),
       entry:entries(id, poster_url, world_id),
       comment:comments(body),
       clash:clashes(id, title, world_id),
       group:groups(id, name, world_id)`,
    )
    .order('created_at', { ascending: false })
    .limit(NOTIFICATIONS_PAGE_SIZE)
  if (before) query = query.lt('created_at', before)
  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => {
    const actor = one(row.actor)
    const entry = one(row.entry)
    const comment = one(row.comment)
    const clash = one(row.clash)
    const group = one(row.group)
    return {
      id: row.id,
      kind: row.kind as NotificationKind,
      createdAt: row.created_at,
      read: row.read_at !== null,
      actor: actor ? { handle: actor.handle, displayName: actor.display_name, avatarUrl: actor.avatar_url } : null,
      entry: entry ? { id: entry.id, posterUrl: entry.poster_url, worldId: entry.world_id as WorldId } : null,
      comment: comment ? { body: comment.body } : null,
      clash: clash ? { id: clash.id, title: clash.title, worldId: clash.world_id as WorldId } : null,
      group: group ? { id: group.id, name: group.name, worldId: group.world_id as WorldId } : null,
      reportCase: row.report_case,
    }
  })
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_notifications_read')
  if (error) throw error
}
