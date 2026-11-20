import { useCallback, useEffect, useRef, useState } from 'react'
import { liveMedia, type LiveParticipant, type PublishedTrack, type TrackKind } from '@/api/live'

/**
 * WebRTC for a live room, over Cloudflare Realtime.
 *
 * One RTCPeerConnection per browser. The talent's own camera and microphone
 * go up as `sendonly` transceivers; every on-stage talent's tracks come down
 * on the same connection. Each change goes through the `live` Edge Function,
 * which checks the permissions the host granted. Negotiations run one at a
 * time so offers never cross.
 */

interface PullResult {
  tracks?: { mid: string; trackName: string; sessionId: string; errorCode?: string }[]
  requiresImmediateRenegotiation?: boolean
  sessionDescription?: RTCSessionDescriptionInit
}

const remoteKey = (sessionId: string, trackName: string) => `${sessionId}/${trackName}`

export interface LiveMedia {
  ready: boolean
  error: string | null
  localStream: MediaStream | null
  /** Live tracks of other talents, by `${sessionId}/${trackName}`. */
  remote: Record<string, MediaStreamTrack>
  camOn: boolean
  micOn: boolean
  setCamOn: (on: boolean) => void
  setMicOn: (on: boolean) => void
}

export function useLiveMedia(clashId: string, me: LiveParticipant | undefined, participants: LiveParticipant[], watching: boolean): LiveMedia {
  const pc = useRef<RTCPeerConnection | null>(null)
  const session = useRef<string | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const midToKey = useRef(new Map<string, string>())
  const pulled = useRef(new Set<string>())
  const published = useRef(new Map<TrackKind, { transceiver: RTCRtpTransceiver; track: MediaStreamTrack }>())

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remote, setRemote] = useState<Record<string, MediaStreamTrack>>({})
  const [camOn, setCamOn] = useState(true)
  const [micOn, setMicOn] = useState(true)

  /** Runs negotiation steps strictly one after another. */
  const serial = useCallback(<T,>(task: () => Promise<T>) => {
    const next = queue.current.then(task, task)
    queue.current = next.catch(() => undefined)
    return next
  }, [])

  // Connection: one session for the whole visit.
  useEffect(() => {
    if (!me) return
    let closed = false
    const connection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }], bundlePolicy: 'max-bundle' })
    pc.current = connection
    connection.ontrack = (event) => {
      const key = midToKey.current.get(event.transceiver.mid ?? '')
      if (key) setRemote((current) => ({ ...current, [key]: event.track }))
    }
    void liveMedia<{ sessionId: string }>(clashId, 'session')
      .then(({ sessionId }) => {
        if (closed) return
        session.current = sessionId
        setReady(true)
      })
      .catch((caught: Error) => setError(caught.message))

    return () => {
      closed = true
      published.current.forEach(({ track }) => track.stop())
      published.current.clear()
      pulled.current.clear()
      midToKey.current.clear()
      connection.close()
      pc.current = null
      session.current = null
      setReady(false)
      setRemote({})
      setLocalStream(null)
    }
    // A new session only when the person changes, not on every room update.
  }, [clashId, me?.userId])

  // Publishing: follow what the host allows and what the talent switched on.
  const wantCam = Boolean(ready && me?.stage === 'on_stage' && me.camAllowed && camOn)
  const wantMic = Boolean(ready && me?.stage === 'on_stage' && me.micAllowed && micOn)

  useEffect(() => {
    if (!ready) return
    const wanted: Record<TrackKind, boolean> = { video: wantCam, audio: wantMic }

    void serial(async () => {
      const connection = pc.current
      const sessionId = session.current
      if (!connection || !sessionId) return

      // Stop what is no longer wanted.
      const stopping = (['video', 'audio'] as TrackKind[]).filter((kind) => !wanted[kind] && published.current.has(kind))
      if (stopping.length > 0) {
        const mids = stopping.map((kind) => published.current.get(kind)!.transceiver.mid).filter((mid): mid is string => Boolean(mid))
        for (const kind of stopping) {
          const { transceiver, track } = published.current.get(kind)!
          track.stop()
          await transceiver.sender.replaceTrack(null)
          published.current.delete(kind)
        }
        if (mids.length > 0) await liveMedia(clashId, 'close', { sessionId, mids }).catch(() => undefined)
      }

      // Start what is newly wanted.
      const starting = (['video', 'audio'] as TrackKind[]).filter((kind) => wanted[kind] && !published.current.has(kind))
      if (starting.length > 0) {
        const media = await navigator.mediaDevices.getUserMedia({
          video: starting.includes('video') ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
          audio: starting.includes('audio') ? { echoCancellation: true, noiseSuppression: true } : false,
        })
        const added: { kind: TrackKind; transceiver: RTCRtpTransceiver; track: MediaStreamTrack }[] = media.getTracks().map((track) => ({
          kind: track.kind as TrackKind,
          track,
          transceiver: connection.addTransceiver(track, { direction: 'sendonly' }),
        }))
        await connection.setLocalDescription(await connection.createOffer())
        const tracks: PublishedTrack[] = added.map(({ kind, transceiver }) => ({ mid: transceiver.mid!, trackName: `${kind}-${crypto.randomUUID()}`, kind }))
        try {
          const answer = await liveMedia<{ sessionDescription: RTCSessionDescriptionInit }>(clashId, 'publish', {
            sessionId,
            sdp: connection.localDescription!.sdp,
            tracks,
          })
          await connection.setRemoteDescription(answer.sessionDescription)
          added.forEach(({ kind, transceiver, track }) => published.current.set(kind, { transceiver, track }))
        } catch (caught) {
          added.forEach(({ track, transceiver }) => {
            track.stop()
            void transceiver.sender.replaceTrack(null)
          })
          throw caught
        }
      }

      const stream = new MediaStream([...published.current.values()].map(({ track }) => track))
      setLocalStream(stream.getTracks().length > 0 ? stream : null)
    }).catch((caught: Error) => setError(caught.name === 'NotAllowedError' ? 'camera_blocked' : caught.message))
  }, [ready, wantCam, wantMic, clashId, serial])

  // Watching: pull every on-stage track not pulled yet.
  const available = watching
    ? participants
        .filter((person) => person.stage === 'on_stage' && person.sessionId && person.userId !== me?.userId)
        .flatMap((person) => person.tracks.map((track) => ({ sessionId: person.sessionId!, trackName: track.trackName })))
    : []
  const availableKey = available.map((track) => remoteKey(track.sessionId, track.trackName)).sort().join('|')

  useEffect(() => {
    if (!ready) return
    const wanted = new Set(availableKey ? availableKey.split('|') : [])

    // Tracks that left the stage disappear from the screen.
    setRemote((current) => Object.fromEntries(Object.entries(current).filter(([key]) => wanted.has(key))))
    for (const key of [...pulled.current]) if (!wanted.has(key)) pulled.current.delete(key)

    const fresh = available.filter((track) => !pulled.current.has(remoteKey(track.sessionId, track.trackName)))
    if (fresh.length === 0) return
    fresh.forEach((track) => pulled.current.add(remoteKey(track.sessionId, track.trackName)))

    void serial(async () => {
      const connection = pc.current
      const sessionId = session.current
      if (!connection || !sessionId) return
      const result = await liveMedia<PullResult>(clashId, 'pull', { sessionId, tracks: fresh })
      for (const track of result.tracks ?? []) {
        if (!track.errorCode) midToKey.current.set(track.mid, remoteKey(track.sessionId, track.trackName))
      }
      if (result.requiresImmediateRenegotiation && result.sessionDescription) {
        await connection.setRemoteDescription(result.sessionDescription)
        await connection.setLocalDescription(await connection.createAnswer())
        await liveMedia(clashId, 'renegotiate', { sessionId, sdp: connection.localDescription!.sdp })
      }
    }).catch(() => {
      // Let the next room update try again.
      fresh.forEach((track) => pulled.current.delete(remoteKey(track.sessionId, track.trackName)))
    })
    // `available` is summarised by `availableKey`.
  }, [ready, availableKey, clashId, serial])

  return { ready, error, localStream, remote, camOn, micOn, setCamOn, setMicOn }
}
