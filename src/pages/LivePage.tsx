import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  fetchLiveRoom,
  liveCode,
  joinLive,
  leaveLive,
  liveMedia,
  requestStage,
  setLiveModerator,
  setLiveStatus,
  setStagePermissions,
  stepDown,
  type LiveParticipant,
} from '@/api/live'
import { useClash } from '@/api/queries'
import { useAuthUi } from '@/app/auth'
import { useLiveMedia } from '@/app/liveMedia'
import { useLiveRoomRealtime } from '@/app/realtime'
import { useSession } from '@/app/session'
import { BackIcon } from '@/components/icons/UiIcons'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useWorldTheme } from '@/theme/WorldThemeProvider'

/**
 * A live Clash. The creator hosts; everyone else watches and can ask to
 * join the stage. The host grants the camera and the microphone separately
 * and can take them back at any moment. Nothing is recorded.
 */
export function LivePage() {
  const { clashId = '' } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const { openAuth } = useAuthUi()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { setWorld } = useWorldTheme()
  const { data: clash, isLoading: loadingClash } = useClash(clashId)
  const [joined, setJoined] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [peopleOpen, setPeopleOpen] = useState(false)

  const roomKey = ['live-room', clashId]
  const { data: room } = useQuery({ queryKey: roomKey, queryFn: () => fetchLiveRoom(clashId), enabled: joined, refetchInterval: 20_000 })
  useLiveRoomRealtime(joined ? clashId : undefined)

  useEffect(() => {
    if (clash) setWorld(clash.worldId)
  }, [clash, setWorld])

  // Enter the room once signed in; leave it when the page closes.
  useEffect(() => {
    if (!session || !clash || clash.format !== 'live') return
    let active = true
    joinLive(clashId)
      .then(() => active && setJoined(true))
      .catch((error: Error) => active && setJoinError(error.message))
    const leave = () => void leaveLive(clashId)
    window.addEventListener('pagehide', leave)
    return () => {
      active = false
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [session, clash, clashId])

  const participants = useMemo(() => room?.participants ?? [], [room])
  const me = participants.find((person) => person.userId === session?.user.id)
  const isHost = me?.role === 'host'
  const isStaff = isHost || me?.role === 'moderator'
  const live = room?.status === 'live'
  const media = useLiveMedia(clashId, joined ? me : undefined, participants, live || isStaff)

  const onStage = participants.filter((person) => person.stage === 'on_stage' && (person.present || person.role === 'host'))
  const audience = participants.filter((person) => person.present && person.stage !== 'on_stage')
  const requests = participants.filter((person) => person.present && person.stage === 'requested')

  // Tell a talent when the host changes what they may do.
  const previous = useRef<{ cam: boolean; mic: boolean } | null>(null)
  useEffect(() => {
    if (!me || isHost) return
    const now = { cam: me.camAllowed, mic: me.micAllowed }
    const before = previous.current
    previous.current = now
    if (!before) return
    if (!before.cam && !before.mic && (now.cam || now.mic)) toast('You are on stage')
    else if ((before.cam || before.mic) && !now.cam && !now.mic) toast('You are back in the audience')
    else if (before.cam && !now.cam) toast('The host turned your camera off')
    else if (before.mic && !now.mic) toast('The host turned your microphone off')
  }, [me, isHost, toast])

  const act = async (task: () => Promise<unknown>, done?: string) => {
    try {
      await task()
      if (done) toast(done)
      await queryClient.invalidateQueries({ queryKey: roomKey })
    } catch {
      toast('That did not work. Try again.')
    }
  }

  /** Changes a talent's permissions, then makes Cloudflare cut anything they may no longer send. */
  const grant = (person: LiveParticipant, cam: boolean, mic: boolean) =>
    act(async () => {
      await setStagePermissions(clashId, person.userId, cam, mic)
      await liveMedia(clashId, 'enforce', { userId: person.userId })
    })

  if (loadingClash) return <LoadingState />
  if (!clash) return <div className="pt-32"><EmptyState title="This live does not exist" /></div>
  if (clash.format !== 'live') return <div className="pt-32"><EmptyState title="This Clash is not a live">Open it to enter with a video.</EmptyState></div>
  if (!session) {
    return (
      <div className="pt-32">
        <EmptyState title={clash.title}>
          <p>Sign in to watch this live.</p>
          <button type="button" onClick={() => openAuth('signup', 'Create your account to watch this live.')} className="pressable mt-5 h-12 rounded-2xl bg-text px-6 text-sm font-extrabold text-ink">
            Sign in
          </button>
        </EmptyState>
      </div>
    )
  }
  if (joinError) return <div className="pt-32"><EmptyState title="You cannot enter this live">It may be private or reserved to its groups.</EmptyState></div>
  if (!room || !me) return <LoadingState label="Entering the live…" />

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <header className="flex items-center gap-3 px-4 pt-[calc(var(--safe-top)+12px)] pb-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Leave the live" className="pressable grid size-10 shrink-0 place-items-center rounded-xl bg-fg/8">
          <BackIcon />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold">{clash.title}</p>
          <p className="text-xs text-muted">
            {audience.length + onStage.length} watching · code <span className="font-extrabold text-text">{liveCode(clashId)}</span>
          </p>
        </div>
        <Link
          to={`/life?live=${liveCode(clashId)}`}
          className="pressable flex h-9 shrink-0 items-center rounded-xl bg-fg/8 px-3 text-xs font-extrabold"
        >
          <span className="sm:hidden">Life</span><span className="hidden sm:inline">Watch in Life</span>
        </Link>
        <span
          className={clsx(
            'flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-extrabold tracking-wider uppercase',
            live ? 'bg-[#ff4d6d] text-white' : 'bg-fg/10 text-muted',
          )}
        >
          {live && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
          {live ? 'Live' : room.status === 'ended' ? 'Ended' : 'Not started'}
        </span>
        {isStaff && (
          <button type="button" onClick={() => setPeopleOpen(true)} className="pressable relative h-10 shrink-0 rounded-xl bg-fg/8 px-3.5 text-sm font-extrabold">
            People
            {requests.length > 0 && (
              <span className="tabular absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff4d6d] px-1 text-[10.5px] text-white">{requests.length}</span>
            )}
          </button>
        )}
      </header>

      <main className="relative min-h-0 flex-1 px-3 pb-3">
        {!live && !isStaff ? (
          <Waiting ended={room.status === 'ended'} host={participants.find((person) => person.role === 'host')} />
        ) : (
          <Stage people={onStage} me={me} localStream={media.localStream} remote={media.remote} camOn={media.camOn} />
        )}
        {media.error && (
          <p role="alert" className="absolute inset-x-6 top-4 z-10 rounded-2xl bg-[#ff4d6d] px-4 py-3 text-center text-sm font-bold text-white">
            {media.error === 'camera_blocked' ? 'Allow camera and microphone access in your browser to go on stage.' : 'The live connection had a problem. Leave and come back.'}
          </p>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-2.5 px-4 pt-1 pb-[calc(var(--safe-bottom)+16px)]">
        {me.stage === 'on_stage' && (
          <>
            {me.camAllowed && (
              <Control active={media.camOn} onClick={() => media.setCamOn(!media.camOn)}>
                {media.camOn ? 'Camera on' : 'Camera off'}
              </Control>
            )}
            {me.micAllowed && (
              <Control active={media.micOn} onClick={() => media.setMicOn(!media.micOn)}>
                {media.micOn ? 'Mic on' : 'Mic off'}
              </Control>
            )}
            {!isHost && <Control onClick={() => act(() => stepDown(clashId), 'You left the stage')}>Leave stage</Control>}
          </>
        )}
        {me.stage !== 'on_stage' && live && (
          <Control primary={me.stage !== 'requested'} onClick={() => act(() => requestStage(clashId, me.stage !== 'requested'), me.stage === 'requested' ? 'Request cancelled' : 'The host sees your request')}>
            {me.stage === 'requested' ? 'Cancel request' : 'Ask to join the stage'}
          </Control>
        )}
        {isHost && room.status !== 'live' && (
          <Control primary onClick={() => act(() => setLiveStatus(clashId, 'live'), 'You are live')}>
            Go live
          </Control>
        )}
        {isHost && live && (
          <Control danger onClick={() => act(() => setLiveStatus(clashId, 'ended'), 'The live has ended')}>
            End live
          </Control>
        )}
      </footer>

      {isStaff && (
        <PeopleSheet
          open={peopleOpen}
          onClose={() => setPeopleOpen(false)}
          isHost={isHost}
          myId={me.userId}
          requests={requests}
          onStage={onStage.filter((person) => person.role !== 'host')}
          audience={audience.filter((person) => person.stage === 'audience')}
          onGrant={grant}
          onDecline={(person) => grant(person, false, false)}
          onModerator={(person, value) => act(() => setLiveModerator(clashId, person.userId, value))}
        />
      )}
    </div>
  )
}

function Waiting({ ended, host }: { ended: boolean; host?: LiveParticipant }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[28px] border border-line bg-[radial-gradient(80%_60%_at_50%_40%,var(--world-soft),transparent_70%)] px-6 text-center">
      {host && <Avatar name={host.displayName} src={host.avatarUrl} size={88} ring />}
      <p className="text-xl font-extrabold">{ended ? 'This live has ended' : `${host?.displayName ?? 'The host'} is getting ready`}</p>
      <p className="max-w-xs text-sm text-muted">{ended ? 'Thanks for watching.' : 'Stay here: the stage appears the moment the live starts.'}</p>
    </div>
  )
}

function Stage({
  people,
  me,
  localStream,
  remote,
  camOn,
}: {
  people: LiveParticipant[]
  me: LiveParticipant
  localStream: MediaStream | null
  remote: Record<string, MediaStreamTrack>
  camOn: boolean
}) {
  if (people.length === 0) {
    return <div className="grid h-full place-items-center rounded-[28px] border border-line text-sm text-muted">The stage is empty.</div>
  }
  const columns = people.length === 1 ? 'grid-cols-1' : people.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'
  return (
    <div className={clsx('grid h-full gap-2.5', columns, people.length > 2 && 'grid-rows-2', people.length === 2 && 'grid-rows-2 sm:grid-rows-1')}>
      {people.map((person) => {
        const mine = person.userId === me.userId
        const stream = mine
          ? localStream
          : (() => {
              const tracks = person.tracks.map((track) => remote[`${person.sessionId}/${track.trackName}`]).filter(Boolean)
              return tracks.length > 0 ? new MediaStream(tracks) : null
            })()
        const hasVideo = mine ? Boolean(localStream?.getVideoTracks().length) && camOn : person.tracks.some((track) => track.kind === 'video')
        const hasAudio = person.tracks.some((track) => track.kind === 'audio')
        return <Tile key={person.userId} person={person} stream={stream} mine={mine} hasVideo={hasVideo} hasAudio={hasAudio} />
      })}
    </div>
  )
}

function Tile({ person, stream, mine, hasVideo, hasAudio }: { person: LiveParticipant; stream: MediaStream | null; mine: boolean; hasVideo: boolean; hasAudio: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  // Streams are rebuilt on every room update; only a real change of tracks touches the player.
  const trackIds = stream?.getTracks().map((track) => track.id).join(',') ?? ''
  const latest = useRef(stream)
  latest.current = stream
  useEffect(() => {
    if (video.current) video.current.srcObject = latest.current
  }, [trackIds])

  return (
    <div data-theme="dark" className="relative min-h-0 overflow-hidden rounded-[24px] border border-fg/10 bg-[radial-gradient(80%_70%_at_50%_40%,var(--world-soft),#07080c_75%)]">
      <video ref={video} autoPlay playsInline muted={mine} className={clsx('size-full object-cover', mine && '-scale-x-100', !hasVideo && 'invisible')} />
      {!hasVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <Avatar name={person.displayName} src={person.avatarUrl} size={84} ring />
        </div>
      )}
      <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
        <span className="truncate rounded-full bg-black/45 px-3 py-1 text-xs font-extrabold text-white backdrop-blur-md">
          {mine ? 'You' : person.displayName}
          {person.role === 'host' && ' · Host'}
        </span>
        {!hasAudio && !mine && <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white/80 backdrop-blur-md">muted</span>}
      </div>
    </div>
  )
}

function Control({ children, onClick, primary = false, danger = false, active }: { children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'pressable h-12 rounded-2xl px-5 text-sm font-extrabold',
        primary && 'bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-world-ink shadow-[0_10px_26px_var(--world-glow)]',
        danger && 'bg-[#ff4d6d] text-white',
        !primary && !danger && (active === false ? 'bg-fg/6 text-muted line-through' : 'bg-fg/10'),
      )}
    >
      {children}
    </button>
  )
}

interface PeopleSheetProps {
  open: boolean
  onClose: () => void
  isHost: boolean
  myId: string
  requests: LiveParticipant[]
  onStage: LiveParticipant[]
  audience: LiveParticipant[]
  onGrant: (person: LiveParticipant, cam: boolean, mic: boolean) => void
  onDecline: (person: LiveParticipant) => void
  onModerator: (person: LiveParticipant, moderator: boolean) => void
}

/** Host and moderators: the waiting list, who is on stage with what, and the audience. */
function PeopleSheet({ open, onClose, isHost, myId, requests, onStage, audience, onGrant, onDecline, onModerator }: PeopleSheetProps) {
  return (
    <Sheet open={open} title="People" onClose={onClose}>
      <div className="no-scrollbar flex max-h-[64dvh] flex-col gap-5 overflow-y-auto">
        <Group title={`Waiting to join · ${requests.length}`} empty="Nobody is asking to join.">
          {requests.map((person) => (
            <Person key={person.userId} person={person}>
              <Small onClick={() => onGrant(person, true, true)} primary>
                Cam + mic
              </Small>
              <Small onClick={() => onGrant(person, false, true)}>Mic only</Small>
              <Small onClick={() => onDecline(person)}>Decline</Small>
            </Person>
          ))}
        </Group>

        <Group title={`On stage · ${onStage.length}`} empty="Only the host is on stage.">
          {onStage.map((person) => (
            <Person key={person.userId} person={person}>
              <Small onClick={() => onGrant(person, !person.camAllowed, person.micAllowed)}>{person.camAllowed ? 'Cam off' : 'Cam on'}</Small>
              <Small onClick={() => onGrant(person, person.camAllowed, !person.micAllowed)}>{person.micAllowed ? 'Mic off' : 'Mic on'}</Small>
              <Small onClick={() => onDecline(person)} danger>
                Remove
              </Small>
            </Person>
          ))}
        </Group>

        <Group title={`Audience · ${audience.length}`} empty="No one else is watching yet.">
          {audience.map((person) => (
            <Person key={person.userId} person={person}>
              <Small onClick={() => onGrant(person, true, true)}>Invite on stage</Small>
              {isHost && person.userId !== myId && (
                <Small onClick={() => onModerator(person, person.role !== 'moderator')}>{person.role === 'moderator' ? 'Remove moderator' : 'Make moderator'}</Small>
              )}
            </Person>
          ))}
        </Group>
      </div>
    </Sheet>
  )
}

function Group({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-extrabold tracking-widest text-muted uppercase">{title}</h3>
      {children.length === 0 ? <p className="text-sm text-muted">{empty}</p> : <ul className="flex flex-col gap-2">{children}</ul>}
    </section>
  )
}

function Person({ person, children }: { person: LiveParticipant; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-fg/4 p-3">
      <span className="flex items-center gap-2.5">
        <Avatar name={person.displayName} src={person.avatarUrl} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold"><span translate="no" className="notranslate">{person.displayName}</span></span>
          <span className="block truncate text-xs text-muted">
            <span translate="no" className="notranslate">@{person.handle}</span>
            {person.role === 'moderator' && ' · moderator'}
          </span>
        </span>
      </span>
      <span className="flex flex-wrap gap-1.5">{children}</span>
    </li>
  )
}

function Small({ children, onClick, primary = false, danger = false }: { children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'pressable h-8 rounded-lg px-3 text-xs font-extrabold',
        primary ? 'bg-text text-ink' : danger ? 'bg-[#ff4d6d]/14 text-[#ff6b81]' : 'bg-fg/8',
      )}
    >
      {children}
    </button>
  )
}
