import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { WorldId } from '@/types/domain'
import { fetchClash, fetchClashEntries, fetchClashes, fetchClashesForGroup, fetchClashInvitees, fetchGroupScores } from './clashes'
import { FEED_PAGE_SIZE, fetchClashBacks, fetchComments, fetchEntriesByAuthor, fetchEntry, fetchFollowingFeed, fetchRankedFeed, fetchWorldEntries } from './entries'
import { readSeen } from '@/lib/seen'
import { fetchGroup, fetchGroupMembers, fetchGroups } from './groups'
import { fetchNotifications, fetchUnreadCount, NOTIFICATIONS_PAGE_SIZE } from './notifications'
import { fetchMyProfile, fetchProfileByHandle, fetchProfileStats } from './profiles'
import { fetchBlocked, fetchMyReports } from './safety'
import { fetchRanking, type RankingBoard, type RankingPeriod } from './rankings'
import { fetchDuelResults, fetchIsFollowing, fetchMyFollowing, fetchMySparks } from './social'

/** React Query hooks: one place for cache keys and fetchers. */

export type FeedMode = 'for-you' | 'following'

/**
 * The home feed, page by page. It never refetches on its own: reordering
 * videos under the viewer's thumb would be disorienting. New videos are
 * announced live and loaded when the viewer asks.
 */
export const useFeed = (mode: FeedMode, userId: string | undefined) =>
  useInfiniteQuery({
    queryKey: ['feed', mode, mode === 'following' ? userId : null],
    initialPageParam: { loaded: [] as string[], before: null as string | null },
    queryFn: ({ pageParam }) =>
      mode === 'following' ? fetchFollowingFeed(userId!, pageParam.before) : fetchRankedFeed(pageParam.loaded, readSeen()),
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < FEED_PAGE_SIZE ? undefined : { loaded: pages.flat().map((entry) => entry.id), before: lastPage.at(-1)?.createdAt ?? null },
    enabled: mode === 'for-you' || Boolean(userId),
    staleTime: Infinity,
  })

export const useEntry = (id: string | undefined) =>
  useQuery({ queryKey: ['entry', id], queryFn: () => fetchEntry(id!), enabled: Boolean(id) })

export const useClashBacks = (entryId: string | undefined) =>
  useQuery({ queryKey: ['clash-backs', entryId], queryFn: () => fetchClashBacks(entryId!), enabled: Boolean(entryId) })

export const useComments = (entryId: string, enabled = true) =>
  useQuery({ queryKey: ['comments', entryId], queryFn: () => fetchComments(entryId), enabled })

export const useProfile = (handle: string | undefined) =>
  useQuery({ queryKey: ['profile', handle?.toLowerCase()], queryFn: () => fetchProfileByHandle(handle!), enabled: Boolean(handle) })

export const useProfileStats = (profileId: string | undefined) =>
  useQuery({ queryKey: ['profile-stats', profileId], queryFn: () => fetchProfileStats(profileId!), enabled: Boolean(profileId) })

export const useAuthorEntries = (authorId: string | undefined) =>
  useQuery({ queryKey: ['author-entries', authorId], queryFn: () => fetchEntriesByAuthor(authorId!), enabled: Boolean(authorId) })

export const useRanking = (board: RankingBoard, period: RankingPeriod) =>
  useQuery({ queryKey: ['ranking', board, period], queryFn: () => fetchRanking(board, period) })

export const useDuelResults = (originalId: string | undefined, answerId: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['duel-results', originalId, answerId],
    queryFn: () => fetchDuelResults(originalId!, answerId!),
    enabled: enabled && Boolean(originalId && answerId),
  })

/** The signed-in user's own profile. */
export const useMyProfile = (userId: string | undefined) =>
  useQuery({ queryKey: ['my-profile', userId], queryFn: () => fetchMyProfile(userId!), enabled: Boolean(userId) })

/** Entry ids the signed-in user has sparked. */
export const useMySparks = (userId: string | undefined) =>
  useQuery({ queryKey: ['my-sparks', userId], queryFn: () => fetchMySparks(userId!), enabled: Boolean(userId) })

export const useIsFollowing = (followerId: string | undefined, followeeId: string | undefined) =>
  useQuery({
    queryKey: ['is-following', followerId, followeeId],
    queryFn: () => fetchIsFollowing(followerId!, followeeId!),
    enabled: Boolean(followerId && followeeId),
  })

/** Clash lists change with time, not only with writes: refresh every minute. */
export const useClashes = () => useQuery({ queryKey: ['clashes'], queryFn: fetchClashes, refetchInterval: 60_000 })

export const useClash = (id: string | undefined) =>
  useQuery({ queryKey: ['clash', id], queryFn: () => fetchClash(id!), enabled: Boolean(id), refetchInterval: 60_000 })

export const useClashEntries = (id: string | undefined) =>
  useQuery({ queryKey: ['clash-entries', id], queryFn: () => fetchClashEntries(id!), enabled: Boolean(id) })

export const useGroupScores = (id: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: ['group-scores', id], queryFn: () => fetchGroupScores(id!), enabled: enabled && Boolean(id) })

export const useClashInvitees = (id: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: ['clash-invitees', id], queryFn: () => fetchClashInvitees(id!), enabled: enabled && Boolean(id) })

export const useGroups = () => useQuery({ queryKey: ['groups'], queryFn: fetchGroups })

export const useGroup = (id: string | undefined) =>
  useQuery({ queryKey: ['group', id], queryFn: () => fetchGroup(id!), enabled: Boolean(id) })

export const useGroupMembers = (id: string | undefined) =>
  useQuery({ queryKey: ['group-members', id], queryFn: () => fetchGroupMembers(id!), enabled: Boolean(id) })

export const useGroupClashes = (id: string | undefined) =>
  useQuery({ queryKey: ['group-clashes', id], queryFn: () => fetchClashesForGroup(id!), enabled: Boolean(id) })

export const useWorldEntries = (worldId: WorldId | undefined) =>
  useQuery({ queryKey: ['world-entries', worldId], queryFn: () => fetchWorldEntries(worldId!), enabled: Boolean(worldId) })

export const useNotifications = (userId: string | undefined) =>
  useInfiniteQuery({
    queryKey: ['notifications', userId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    getNextPageParam: (lastPage) => (lastPage.length < NOTIFICATIONS_PAGE_SIZE ? undefined : (lastPage.at(-1)?.createdAt ?? null)),
    enabled: Boolean(userId),
  })

export const useUnreadNotifications = (userId: string | undefined) =>
  useQuery({ queryKey: ['notifications-unread', userId], queryFn: fetchUnreadCount, enabled: Boolean(userId), staleTime: 60_000, refetchOnWindowFocus: true })

export const useBlockedTalents = (userId: string | undefined) =>
  useQuery({ queryKey: ['blocked', userId], queryFn: fetchBlocked, enabled: Boolean(userId) })

export const useMyReports = (userId: string | undefined) =>
  useQuery({ queryKey: ['my-reports', userId], queryFn: fetchMyReports, enabled: Boolean(userId) })

export const useMyFollowing = (userId: string | undefined) =>
  useQuery({ queryKey: ['my-following', userId], queryFn: () => fetchMyFollowing(userId!), enabled: Boolean(userId), staleTime: 60_000 })
