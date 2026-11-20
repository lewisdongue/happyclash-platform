import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLiveRoom, joinLive, leaveLive } from '@/api/live'
import { useLiveMedia } from '@/app/liveMedia'
import { useSession } from '@/app/session'
import type { Hall } from '@/life/hall'

/**
 * A live Clash watched from inside a Life hall: the visitor joins the same
 * room as the classic Live page (so they count as watching), and the talent
 * on stage is shown on the hall's big screen with their sound.
 */
export function HallLive({ clashId, hall, onStatus }: { clashId: string; hall: Hall | null; onStatus: (text: string) => void }) {
  const session = useSession()
  const [joined, setJoined] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    let active = true
    joinLive(clashId)
      .then(() => active && setJoined(true))
      .catch(() => onStatus('This live cannot be joined.'))
    return () => {
      active = false
      void leaveLive(clashId)
    }
  }, [clashId, onStatus])

  const { data: room } = useQuery({ queryKey: ['live-room', clashId], queryFn: () => fetchLiveRoom(clashId), enabled: joined, refetchInterval: 8_000 })
  const participants = useMemo(() => room?.participants ?? [], [room])
  const me = participants.find((person) => person.userId === session?.user.id)
  const media = useLiveMedia(clashId, joined ? me : undefined, participants, true)

  // The first talent on stage with video goes on the big screen; every voice on stage is heard.
  const { videoTrack, audioTracks } = useMemo(() => {
    const onStage = participants.filter((person) => person.stage === 'on_stage' && person.sessionId)
    let videoTrack: MediaStreamTrack | null = null
    const audioTracks: MediaStreamTrack[] = []
    for (const person of onStage) {
      for (const track of person.tracks) {
        const remote = media.remote[`${person.sessionId}/${track.trackName}`]
        if (!remote) continue
        if (remote.kind === 'video' && !videoTrack) videoTrack = remote
        if (remote.kind === 'audio') audioTracks.push(remote)
      }
    }
    return { videoTrack, audioTracks }
  }, [participants, media.remote])

  useEffect(() => {
    const element = video.current
    if (!element) return
    element.srcObject = videoTrack ? new MediaStream([videoTrack]) : null
    if (videoTrack) void element.play().catch(() => undefined)
    hall?.showLive(videoTrack ? element : null)
    return () => hall?.showLive(null)
  }, [videoTrack, hall])

  const audioKey = audioTracks.map((track) => track.id).join(',')
  useEffect(() => {
    const element = audio.current
    if (!element) return
    element.srcObject = audioTracks.length ? new MediaStream(audioTracks) : null
    if (audioTracks.length) void element.play().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioKey])

  const watching = participants.filter((person) => person.present).length
  useEffect(() => {
    if (!joined) return
    if (room?.status === 'ended') onStatus('This live has ended.')
    else if (!videoTrack && audioTracks.length === 0) onStatus(room?.status === 'live' ? 'Waiting for the talent on stage…' : 'The live has not started yet.')
    else onStatus(`Live · ${watching} watching`)
  }, [joined, room?.status, videoTrack, audioTracks.length, watching, onStatus])

  return (
    <>
      <video ref={video} muted playsInline autoPlay className="pointer-events-none fixed size-px opacity-0" />
      <audio ref={audio} autoPlay />
    </>
  )
}
