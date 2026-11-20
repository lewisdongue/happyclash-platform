/**
 * Domain types used by the UI. They follow the database schema
 * (see supabase migrations) but use camelCase and nested authors.
 */

export type WorldId = 'music' | 'dance' | 'sport' | 'comedy' | 'art' | 'tech' | 'lifestyle' | 'innovation' | 'animals'

export interface TalentWorld {
  id: WorldId
  name: string
  /** Primary accent, used for highlights and the main call to action. */
  accent: string
  /** Deeper shade, used for gradients and pressed states. */
  accentDeep: string
  /** Text color that stays readable on top of the accent. */
  onAccent: string
  /** Dark tint used behind media of this world. */
  scene: string
}

export type ClashAccess = 'private' | 'group' | 'public'
export type ClashFormat = 'video' | 'live'
export type ClashStatus = 'scheduled' | 'open' | 'ended'
export type ClashJudging = 'community' | 'creator'

export interface Author {
  id: string
  handle: string
  displayName: string
  country: string | null
  verified: boolean
  avatarUrl: string | null
}

export interface Entry {
  id: string
  author: Author
  caption: string
  worldId: WorldId
  videoUrl: string
  posterUrl: string | null
  /** Frame size in pixels, as published (0 when unknown). */
  width: number
  height: number
  answersEntryId: string | null
  clashId: string | null
  /** Hidden after reports; only its author still sees it. */
  hidden: boolean
  createdAt: string
  sparks: number
  comments: number
  clashBacks: number
  views: number
}

export type VerifiedPlatform = 'instagram' | 'tiktok' | 'facebook' | 'snapchat'

export interface Profile extends Author {
  bio: string
  createdAt: string
  /** The social account that verified this talent, shown on the profile so anyone can check it. */
  verifiedPlatform: VerifiedPlatform | null
  verifiedUrl: string | null
}

export interface ProfileStats {
  followers: number
  following: number
  videos: number
  sparksReceived: number
  clashBacksReceived: number
  views: number
  countriesReached: number
  worlds: Partial<Record<WorldId, number>>
  /** UTC dates (YYYY-MM-DD) with at least one post in the last 12 weeks. */
  activeDays: string[]
}

export interface Comment {
  id: string
  body: string
  createdAt: string
  author: Pick<Author, 'id' | 'handle' | 'displayName' | 'avatarUrl'>
  /** Top-level comment this one answers, or null. */
  parentId: string | null
  likes: number
  replies: number
}

export interface RankingRow {
  rank: number
  id: string
  name: string
  detail: string
  initials: string
  /** Profile photo for talents; groups and countries show initials or a flag. */
  imageUrl?: string | null
  points: number
  href?: string
}

export interface Clash {
  id: string
  creatorId: string
  creator: Pick<Author, 'handle' | 'displayName'>
  title: string
  description: string
  worldId: WorldId
  access: ClashAccess
  format: ClashFormat
  group: { id: string; name: string } | null
  rivalGroup: { id: string; name: string } | null
  prize: string
  rules: string
  maxSeconds: number
  judging: ClashJudging
  startsAt: string
  endsAt: string
  createdAt: string
  status: ClashStatus
  entriesCount: number
  coverUrl: string | null
  /** The signed-in user was personally invited. */
  invited: boolean
  /** Set by the creator when they judge; community Clashes rank by Sparks. */
  winnerEntryId: string | null
}

export interface Group {
  id: string
  ownerId: string
  ownerHandle: string
  name: string
  description: string
  worldId: WorldId
  visibility: 'public' | 'private'
  createdAt: string
  membersCount: number
  isMember: boolean
  /** Only members receive the invite code. */
  inviteCode: string | null
}

export interface GroupScore {
  groupId: string
  name: string
  points: number
}
