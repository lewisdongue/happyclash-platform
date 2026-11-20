// Live Clash media broker.
//
// Browsers never see the Cloudflare Realtime token. They call this function,
// which checks in the database what the caller may do (watch, publish their
// camera, publish their microphone, moderate) and only then talks to
// Cloudflare on their behalf.

import { createClient } from 'npm:@supabase/supabase-js@2'

// The app id is not a secret; the token is, and lives only in the function's environment.
const CF_APP_ID = Deno.env.get('CF_REALTIME_APP_ID') ?? '98d5b0d49f2b2185ac5f06b2a5f64d78'
const CF_BASE = `https://rtc.live.cloudflare.com/v1/apps/${CF_APP_ID}`
const CF_TOKEN = Deno.env.get('CF_REALTIME_TOKEN') ?? ''

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Kind = 'audio' | 'video'
interface PublishedTrack {
  mid: string
  trackName: string
  kind: Kind
}
interface Participant {
  user_id: string
  role: 'host' | 'moderator' | 'viewer'
  stage: 'audience' | 'requested' | 'on_stage'
  cam_allowed: boolean
  mic_allowed: boolean
  session_id: string | null
  tracks: PublishedTrack[]
}

class Refusal extends Error {
  constructor(message: string, readonly status = 403) {
    super(message)
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function cloudflare(path: string, method: 'POST' | 'PUT', body?: unknown) {
  if (!CF_TOKEN) throw new Refusal('live_not_configured', 503)
  const response = await fetch(`${CF_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok || result.errorCode) throw new Refusal(result.errorDescription ?? 'cloudflare_error', 502)
  return result
}

async function participant(clashId: string, userId: string): Promise<Participant> {
  const { data, error } = await db
    .from('live_participants')
    .select('user_id, role, stage, cam_allowed, mic_allowed, session_id, tracks')
    .match({ clash_id: clashId, user_id: userId })
    .maybeSingle()
  if (error) throw new Refusal(`db_error: ${error.message}`, 500)
  if (!data) throw new Refusal('join_first')
  return data as Participant
}

function ownSession(me: Participant, sessionId: string) {
  if (!sessionId || me.session_id !== sessionId) throw new Refusal('wrong_session')
}

const allowed = (who: Participant, kind: Kind) => who.stage === 'on_stage' && (kind === 'audio' ? who.mic_allowed : who.cam_allowed)

async function saveTracks(clashId: string, userId: string, tracks: PublishedTrack[]) {
  await db.from('live_participants').update({ tracks, updated_at: new Date().toISOString() }).match({ clash_id: clashId, user_id: userId })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const { data: auth } = await db.auth.getUser(token)
    if (!auth.user) throw new Refusal('not_signed_in', 401)
    const userId = auth.user.id

    const body = await request.json()
    const clashId: string = body.clashId
    const me = await participant(clashId, userId)

    switch (body.action) {
      // A fresh Cloudflare session for this browser, used to publish and to watch.
      case 'session': {
        const result = await cloudflare('/sessions/new', 'POST')
        await db
          .from('live_participants')
          .update({ session_id: result.sessionId, tracks: [], updated_at: new Date().toISOString() })
          .match({ clash_id: clashId, user_id: userId })
        return json({ sessionId: result.sessionId })
      }

      // Publish the caller's own camera and/or microphone, within what the host allowed.
      case 'publish': {
        ownSession(me, body.sessionId)
        const tracks: PublishedTrack[] = body.tracks
        if (!tracks?.length) throw new Refusal('no_tracks', 400)
        for (const track of tracks) if (!allowed(me, track.kind)) throw new Refusal(`${track.kind}_not_allowed`)
        const result = await cloudflare(`/sessions/${body.sessionId}/tracks/new`, 'POST', {
          sessionDescription: { type: 'offer', sdp: body.sdp },
          tracks: tracks.map(({ mid, trackName }) => ({ location: 'local', mid, trackName })),
        })
        const kept = me.tracks.filter((existing) => !tracks.some((track) => track.trackName === existing.trackName))
        await saveTracks(clashId, userId, [...kept, ...tracks])
        return json(result)
      }

      // Watch tracks that on-stage talents of this room are publishing.
      case 'pull': {
        ownSession(me, body.sessionId)
        const wanted: { sessionId: string; trackName: string }[] = body.tracks
        const { data: stage } = await db.from('live_participants').select('session_id, tracks').match({ clash_id: clashId, stage: 'on_stage' })
        const available = new Set((stage ?? []).flatMap((row) => (row.tracks as PublishedTrack[]).map((track) => `${row.session_id}/${track.trackName}`)))
        for (const track of wanted) if (!available.has(`${track.sessionId}/${track.trackName}`)) throw new Refusal('track_not_on_stage')
        const result = await cloudflare(`/sessions/${body.sessionId}/tracks/new`, 'POST', {
          tracks: wanted.map((track) => ({ location: 'remote', sessionId: track.sessionId, trackName: track.trackName })),
        })
        return json(result)
      }

      case 'renegotiate': {
        ownSession(me, body.sessionId)
        await cloudflare(`/sessions/${body.sessionId}/renegotiate`, 'PUT', { sessionDescription: { type: 'answer', sdp: body.sdp } })
        return json({ ok: true })
      }

      // Stop receiving or sending some tracks of the caller's own session.
      case 'close': {
        ownSession(me, body.sessionId)
        const mids: string[] = body.mids
        await cloudflare(`/sessions/${body.sessionId}/tracks/close`, 'PUT', { tracks: mids.map((mid) => ({ mid })), force: true })
        await saveTracks(clashId, userId, me.tracks.filter((track) => !mids.includes(track.mid)))
        return json({ ok: true })
      }

      // Host or moderator: cut whatever a talent publishes beyond their current permissions.
      case 'enforce': {
        const isHost = (await db.from('clashes').select('creator_id').eq('id', clashId).single()).data?.creator_id === userId
        if (!isHost && me.role !== 'moderator') throw new Refusal('not_allowed')
        const target = await participant(clashId, body.userId)
        const cut = target.tracks.filter((track) => !allowed(target, track.kind))
        if (cut.length > 0 && target.session_id) {
          await cloudflare(`/sessions/${target.session_id}/tracks/close`, 'PUT', { tracks: cut.map(({ mid }) => ({ mid })), force: true }).catch(() => undefined)
          await saveTracks(clashId, body.userId, target.tracks.filter((track) => !cut.includes(track)))
        }
        return json({ ok: true, closed: cut.length })
      }

      default:
        throw new Refusal('unknown_action', 400)
    }
  } catch (error) {
    if (error instanceof Refusal) return json({ error: error.message }, error.status)
    console.error(error)
    return json({ error: 'server_error' }, 500)
  }
})
