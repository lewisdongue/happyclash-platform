import type { Clash, ClashAccess, ClashFormat, ClashJudging, ClashStatus, Entry, Group, WorldId } from '@/types/domain'

/** Row shape of the `entry_feed` view. */
export interface EntryFeedRow {
  id: string
  author_id: string
  caption: string
  world_id: WorldId
  video_url: string
  poster_url: string | null
  width: number | null
  height: number | null
  answers_entry_id: string | null
  clash_id: string | null
  hidden_at: string | null
  created_at: string
  author_handle: string
  author_name: string
  author_country: string | null
  author_verified: boolean
  author_avatar_url: string | null
  sparks_count: number
  comments_count: number
  clash_backs_count: number
  views_count: number
}

export function toEntry(row: EntryFeedRow): Entry {
  return {
    id: row.id,
    caption: row.caption,
    worldId: row.world_id,
    videoUrl: row.video_url,
    posterUrl: row.poster_url,
    width: row.width ?? 0,
    height: row.height ?? 0,
    answersEntryId: row.answers_entry_id,
    clashId: row.clash_id,
    hidden: row.hidden_at !== null,
    createdAt: row.created_at,
    sparks: row.sparks_count,
    comments: row.comments_count,
    clashBacks: row.clash_backs_count,
    views: row.views_count,
    author: {
      id: row.author_id,
      handle: row.author_handle,
      displayName: row.author_name,
      country: row.author_country,
      verified: row.author_verified,
      avatarUrl: row.author_avatar_url,
    },
  }
}

/** Row shape of the `clash_feed` view. */
export interface ClashFeedRow {
  id: string
  creator_id: string
  creator_handle: string
  creator_name: string
  title: string
  description: string
  world_id: WorldId
  access: ClashAccess
  format: ClashFormat
  group_id: string | null
  group_name: string | null
  rival_group_id: string | null
  rival_group_name: string | null
  prize: string
  rules: string
  max_seconds: number
  judging: ClashJudging
  starts_at: string
  ends_at: string
  created_at: string
  status: ClashStatus
  entries_count: number
  cover_url: string | null
  invited: boolean
  winner_entry_id: string | null
}

export function toClash(row: ClashFeedRow): Clash {
  return {
    id: row.id,
    creatorId: row.creator_id,
    creator: { handle: row.creator_handle, displayName: row.creator_name },
    title: row.title,
    description: row.description,
    worldId: row.world_id,
    access: row.access,
    format: row.format,
    group: row.group_id ? { id: row.group_id, name: row.group_name ?? '' } : null,
    rivalGroup: row.rival_group_id ? { id: row.rival_group_id, name: row.rival_group_name ?? '' } : null,
    prize: row.prize,
    rules: row.rules,
    maxSeconds: row.max_seconds,
    judging: row.judging,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    status: row.status,
    entriesCount: row.entries_count,
    coverUrl: row.cover_url,
    invited: row.invited,
    winnerEntryId: row.winner_entry_id,
  }
}

/** Row shape of the `group_feed` view. */
export interface GroupFeedRow {
  id: string
  owner_id: string
  owner_handle: string
  name: string
  description: string
  world_id: WorldId
  visibility: 'public' | 'private'
  created_at: string
  members_count: number
  is_member: boolean
  invite_code: string | null
}

export function toGroup(row: GroupFeedRow): Group {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerHandle: row.owner_handle,
    name: row.name,
    description: row.description,
    worldId: row.world_id,
    visibility: row.visibility,
    createdAt: row.created_at,
    membersCount: row.members_count,
    isMember: row.is_member,
    inviteCode: row.invite_code,
  }
}
