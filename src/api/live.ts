import { supabase } from '@/lib/supabase'

export type LiveStatus = 'idle' | 'live' | 'ended'
export type LiveRole = 'host' | 'moderator' | 'viewer'
export type LiveStage = 'audience' | 'requested' | 'on_stage'
export type TrackKind = 'audio' | 'video'

export interface PublishedTrack {
  mid: string
  trackName: string
  kind: TrackKind
}

export interface LiveParticipant {
  userId: string
  handle: string
  displayName: string
  avatarUrl: string | null
  role: LiveRole
  stage: LiveStage
  camAllowed: boolean
  micAllowed: boolean
  sessionId: string | null
  tracks: PublishedTrack[]
  present: boolean
  requestedAt: string | null
}

export interface LiveRoom {
  status: LiveStatus
  startedAt: string | null
  participants: LiveParticipant[]
}

export async function fetchLiveRoom(clashId: string): Promise<LiveRoom> {
  const [room, people] = await Promise.all([
    supabase.from('live_rooms').select('status, started_at').eq('clash_id', clashId).maybeSingle(),
    supabase
      .from('live_participants')
      .select('user_id, role, stage, cam_allowed, mic_allowed, session_id, tracks, present, requested_at, profile:profiles(handle, display_name, avatar_url)')
      .eq('clash_id', clashId),
  ])
  if (room.error) throw room.error
  if (people.error) throw people.error
  return {
    status: (room.data?.status ?? 'idle') as LiveStatus,
    startedAt: room.data?.started_at ?? null,
    participants: (people.data ?? []).flatMap((row) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile
      if (!profile) return []
      return [
        {
          userId: row.user_id,
          handle: profile.handle,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          role: row.role as LiveRole,
          stage: row.stage as LiveStage,
          camAllowed: row.cam_allowed,
          micAllowed: row.mic_allowed,
          sessionId: row.session_id,
          tracks: (row.tracks ?? []) as PublishedTrack[],
          present: row.present,
          requestedAt: row.requested_at,
        },
      ]
    }),
  }
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(name, args)
  if (error) throw error
}

export const joinLive = (clashId: string) => rpc('live_join', { p_clash: clashId })
export const leaveLive = (clashId: string) => rpc('live_leave', { p_clash: clashId })
export const setLiveStatus = (clashId: string, status: 'live' | 'ended') => rpc('live_set_status', { p_clash: clashId, p_status: status })
export const requestStage = (clashId: string, request: boolean) => rpc('live_request_stage', { p_clash: clashId, p_request: request })
export const stepDown = (clashId: string) => rpc('live_step_down', { p_clash: clashId })
export const setStagePermissions = (clashId: string, userId: string, cam: boolean, mic: boolean) =>
  rpc('live_set_permissions', { p_clash: clashId, p_user: userId, p_cam: cam, p_mic: mic })
export const setLiveModerator = (clashId: string, userId: string, moderator: boolean) =>
  rpc('live_set_moderator', { p_clash: clashId, p_user: userId, p_moderator: moderator })

/** Calls the `live` Edge Function, which talks to Cloudflare Realtime on the caller's behalf. */
export async function liveMedia<T = Record<string, unknown>>(clashId: string, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('live', { body: { clashId, action, ...payload } })
  if (error) {
    const context = (error as { context?: Response }).context
    const detail = context ? await context.json().catch(() => null) : null
    throw new Error(detail?.error ?? error.message)
  }
  return data as T
}

/** The short event code of a live (6 characters), used to watch it inside Life. */
export const liveCode = (clashId: string) => clashId.replace(/-/g, '').slice(0, 6).toUpperCase()

/** Finds a running live from its event code, among the lives this user may see. */
export async function findLiveByCode(code: string): Promise<{ id: string; title: string; worldId: string } | null> {
  const wanted = code.replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (wanted.length < 6) return null
  const { data, error } = await supabase
    .from('clashes')
    .select('id, title, world_id')
    .eq('format', 'live')
    .gt('ends_at', new Date().toISOString())
    .limit(500)
  if (error) throw error
  const found = (data ?? []).find((row) => liveCode(row.id) === wanted.slice(0, 6))
  return found ? { id: found.id, title: found.title, worldId: found.world_id } : null
}
