import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Entry } from '@/types/domain'

/**
 * Live updates come from database triggers that broadcast on public topics:
 * `entry:<id>` (counters, comments), `clash:<id>` (entries changed) and
 * `feed` (new videos). Broadcast fans out cheaply to many viewers, unlike
 * per-row change streams, so only what is on screen is subscribed.
 */

export type EntryCounts = Pick<Entry, 'sparks' | 'comments' | 'views' | 'clashBacks'>

const countsKey = (id: string) => ['entry-counts', id] as const

type Handler = (event: string, payload: Record<string, unknown>) => void

/**
 * One channel per topic, shared by every component that listens to it and
 * closed when the last one unmounts. Two players of the same video therefore
 * never fight over a channel.
 */
const topics = new Map<string, { channel: RealtimeChannel; listeners: Set<Handler> }>()

function listen(topic: string, handler: Handler): () => void {
  let entry = topics.get(topic)
  if (!entry) {
    const listeners = new Set<Handler>()
    const channel = supabase
      .channel(topic, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: '*' }, (message) => {
        for (const listener of listeners) listener(message.event, (message.payload ?? {}) as Record<string, unknown>)
      })
    channel.subscribe()
    entry = { channel, listeners }
    topics.set(topic, entry)
  }
  entry.listeners.add(handler)
  return () => {
    const current = topics.get(topic)
    if (!current) return
    current.listeners.delete(handler)
    if (current.listeners.size === 0) {
      topics.delete(topic)
      void supabase.removeChannel(current.channel)
    }
  }
}

function useBroadcast(topic: string | null, handlers: Record<string, (payload: Record<string, unknown>) => void>) {
  const latest = useRef(handlers)
  latest.current = handlers
  useEffect(() => {
    if (!topic) return
    return listen(topic, (event, payload) => latest.current[event]?.(payload))
  }, [topic])
}

async function fetchEntryCounts(id: string): Promise<EntryCounts | null> {
  const { data, error } = await supabase
    .from('entries')
    .select('sparks_count, comments_count, views_count, clash_backs_count')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? { sparks: data.sparks_count, comments: data.comments_count, views: data.views_count, clashBacks: data.clash_backs_count } : null
}

/**
 * An entry's counters. Every component showing the same entry reads one
 * shared cache, seeded from the list it came from. While `live` (the video
 * on screen, an open panel) the exact numbers are fetched once and then kept
 * current by the broadcast, so swiping away and back never shows old numbers.
 */
export function useEntryCounts(entry: Entry, live: boolean): EntryCounts {
  const queryClient = useQueryClient()
  const seed: EntryCounts = { sparks: entry.sparks, comments: entry.comments, views: entry.views, clashBacks: entry.clashBacks }
  const { data } = useQuery({
    queryKey: countsKey(entry.id),
    queryFn: async () => (await fetchEntryCounts(entry.id)) ?? seed,
    initialData: seed,
    // The seed may be minutes old: it counts as stale so a live viewer refetches at once.
    initialDataUpdatedAt: 0,
    staleTime: 10_000,
    enabled: live,
  })

  useBroadcast(live ? `entry:${entry.id}` : null, {
    // The broadcast only says the numbers moved; the row is read again so a
    // malformed or partial message can never show zeros.
    counts: () => void queryClient.invalidateQueries({ queryKey: countsKey(entry.id) }),
    comment: () => void queryClient.invalidateQueries({ queryKey: ['comments', entry.id] }),
  })

  return data
}

/** Applies a local change (a Spark, a comment) before the broadcast confirms it. */
export function adjustEntryCounts(queryClient: ReturnType<typeof useQueryClient>, entryId: string, change: Partial<EntryCounts>) {
  queryClient.setQueryData<EntryCounts>(countsKey(entryId), (current) => {
    if (!current) return current
    return {
      sparks: Math.max(0, current.sparks + (change.sparks ?? 0)),
      comments: Math.max(0, current.comments + (change.comments ?? 0)),
      views: current.views + (change.views ?? 0),
      clashBacks: current.clashBacks + (change.clashBacks ?? 0),
    }
  })
}

/** Number of videos published by others since the feed loaded. */
export function useNewVideosCount(): [number, () => void] {
  const [count, setCount] = useState(0)
  useBroadcast('feed', { new_entry: () => setCount((value) => value + 1) })
  return [count, () => setCount(0)]
}

/** Refreshes a Clash page whenever one of its entries is added or sparked. */
export function useClashRealtime(clashId: string | undefined) {
  const queryClient = useQueryClient()
  useBroadcast(clashId ? `clash:${clashId}` : null, {
    changed: () => {
      void queryClient.invalidateQueries({ queryKey: ['clash-entries', clashId] })
      void queryClient.invalidateQueries({ queryKey: ['group-scores', clashId] })
      void queryClient.invalidateQueries({ queryKey: ['clash', clashId] })
    },
  })
}

/** Refreshes the signed-in user's Activity as soon as something new arrives for them. */
export function useNotificationsRealtime(userId: string | undefined) {
  const queryClient = useQueryClient()
  useBroadcast(userId ? `notify:${userId}` : null, {
    new: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })
}

/**
 * Keeps the Admin Console live: reports, approvals, moderation and new
 * content ping the `admin` topic, and every admin list refreshes at once.
 */
export function useAdminRealtime(enabled: boolean) {
  const queryClient = useQueryClient()
  const pending = useRef<number | null>(null)
  useBroadcast(enabled ? 'admin' : null, {
    changed: () => {
      // A burst of changes (a deletion cascading) refreshes once.
      if (pending.current !== null) return
      pending.current = window.setTimeout(() => {
        pending.current = null
        void queryClient.invalidateQueries({ queryKey: ['admin'] })
      }, 250)
    },
  })
}

/** Refreshes a live room as soon as someone joins, asks for the stage or is granted it. */
export function useLiveRoomRealtime(clashId: string | undefined) {
  const queryClient = useQueryClient()
  useBroadcast(clashId ? `live:${clashId}` : null, {
    changed: () => void queryClient.invalidateQueries({ queryKey: ['live-room', clashId] }),
  })
}
