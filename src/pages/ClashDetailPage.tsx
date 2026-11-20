import { useShare } from '@/components/ui/ShareSheet'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { deleteClash, inviteToClash, pickClashWinner } from '@/api/clashes'
import { useClash, useClashEntries, useClashInvitees, useGroupScores, useMySparks } from '@/api/queries'
import { setSpark } from '@/api/social'
import { useClashRealtime } from '@/app/realtime'
import { useRequireSession } from '@/app/requireSession'
import { useSession } from '@/app/session'
import { BigCountdown, liveStatus, useNow } from '@/components/clash/Countdown'
import { PeoplePicker, type Person } from '@/components/clash/PeoplePicker'
import { EntryOptions } from '@/components/feed/EntryOptions'
import { VideoPlayer } from '@/components/feed/VideoPlayer'
import { SparkIcon } from '@/components/icons/ActionIcons'
import { CameraIcon, CrownIcon } from '@/components/icons/UiIcons'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReportButton } from '@/components/safety/ReportButton'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { compactNumber } from '@/lib/format'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import { WORLDS } from '@/theme/worlds'
import type { Clash, Entry } from '@/types/domain'

/** One Clash: the challenge, its clock, the ranked entries and, at the end, the winner. */
export function ClashDetailPage() {
  const { clashId } = useParams()
  const session = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const shareLink = useShare()
  const queryClient = useQueryClient()
  const requireSession = useRequireSession()
  const { setWorld } = useWorldTheme()
  const now = useNow()

  const { data: clash, isLoading } = useClash(clashId)
  const { data: entries = [] } = useClashEntries(clashId)
  const { data: scores = [] } = useGroupScores(clashId, clash?.access === 'group')
  const isCreator = Boolean(session && clash && session.user.id === clash.creatorId)
  const { data: invitees = [] } = useClashInvitees(clashId, isCreator && clash?.access === 'private')
  const { data: mySparks } = useMySparks(session?.user.id)
  const [playing, setPlaying] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  useClashRealtime(clashId)

  useEffect(() => {
    if (clash) setWorld(clash.worldId)
  }, [clash, setWorld])

  if (isLoading) return <LoadingState />
  if (!clash) {
    return (
      <div className="pt-32">
        <EmptyState title="This Clash is not available">It may be private, or it was removed.</EmptyState>
      </div>
    )
  }

  const status = liveStatus(clash, now)
  const world = WORLDS[clash.worldId]
  const mine = session ? entries.find((entry) => entry.author.id === session.user.id) : undefined
  const winner =
    status === 'ended'
      ? clash.judging === 'creator'
        ? entries.find((entry) => entry.id === clash.winnerEntryId)
        : (entries[0]?.sparks ?? 0) > 0
          ? entries[0]
          : undefined
      : undefined

  const share = () => shareLink({ title: clash.title, url: `${window.location.origin}/c/${clash.id}` })

  const toggleSpark = (entry: Entry) =>
    requireSession('spark this entry', (current) => {
      const on = !mySparks?.has(entry.id)
      setSpark(entry.id, current.user.id, on)
        .then(() =>
          Promise.all([
            queryClient.invalidateQueries({ queryKey: ['my-sparks', current.user.id] }),
            queryClient.invalidateQueries({ queryKey: ['clash-entries', clash.id] }),
            queryClient.invalidateQueries({ queryKey: ['group-scores', clash.id] }),
          ]),
        )
        .catch(() => toast('That did not work. Try again.'))
    })

  return (
    <div className="mx-auto min-h-dvh max-w-6xl pb-48 lg:px-8 lg:pb-16">
      <PageHeader
        back
        title="Clash"
        actions={
          <>
            {clash && !isCreator && <ReportButton target="clash" targetId={clash.id} />}
            <button type="button" onClick={share} className="pressable h-10 rounded-xl bg-fg/7 px-4 text-sm font-extrabold">
              Share
            </button>
          </>
        }
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <section
          data-theme="dark"
          className="relative mx-4 mt-3 overflow-hidden rounded-[30px] border border-fg/10 p-5 lg:sticky lg:top-6 lg:mx-0"
          style={{ background: `radial-gradient(120% 80% at 10% 0%, ${world.accent}55, transparent 60%), linear-gradient(180deg, ${world.scene}, #08090d)` }}
        >
          <span aria-hidden="true" className="animate-breathe absolute -top-20 -right-20 size-64 rounded-full blur-3xl" style={{ background: `${world.accent}33` }} />
          <div className="relative">
            <div className="flex flex-wrap gap-1.5">
              <StatusChip status={status} />
              <Chip>{world.name}</Chip>
              <Chip>{clash.access === 'group' ? 'Group' : clash.access === 'private' ? 'Private' : 'Public'}</Chip>
            </div>
            <h1 className="mt-4 text-[30px] leading-[1.05] font-extrabold tracking-tight break-words">{clash.title}</h1>
            <p className="mt-2 text-sm text-fg/70">
              by{' '}
              <Link to={`/u/${clash.creator.handle}`} className="font-extrabold text-text">
                <span translate="no" className="notranslate">@{clash.creator.handle}</span>
              </Link>
            </p>
            {clash.description && <p className="mt-4 text-[15px] leading-relaxed text-fg/85">{clash.description}</p>}
            {clash.prize && (
              <p className="mt-4 flex items-center gap-2 text-sm font-extrabold" style={{ color: world.accent }}>
                <CrownIcon size={20} /> {clash.prize}
              </p>
            )}
            {clash.rules && (
              <details className="mt-4 rounded-2xl bg-black/25 px-4 py-3 text-sm">
                <summary className="cursor-pointer font-extrabold">Rules</summary>
                <p className="mt-2 leading-relaxed whitespace-pre-line text-fg/75">{clash.rules}</p>
              </details>
            )}

            <div className="mt-5">
              <BigCountdown clash={clash} />
            </div>

            <p className="mt-4 text-xs text-fg/60">
              {clash.entriesCount} {clash.entriesCount === 1 ? 'entry' : 'entries'} · videos up to {clash.maxSeconds}s ·{' '}
              {clash.judging === 'community' ? 'most Sparks wins' : `@${clash.creator.handle} picks the winner`}
            </p>

            {clash.access === 'group' && scores.length > 0 && <GroupScoreboard scores={scores} accent={world.accent} />}

            <div className="mt-6 hidden lg:block">
              <EnterButton clash={clash} status={status} entered={Boolean(mine)} onEnter={() => requireSession('enter this Clash', () => navigate(`/create?clash=${clash.id}`))} />
            </div>
          </div>
        </section>

        <div>
          {winner && <WinnerBanner entry={winner} />}

          {isCreator && clash.access === 'private' && status !== 'ended' && <InvitePanel clash={clash} invitees={invitees} />}

          <h2 className="mx-4 mt-8 mb-3 flex items-baseline justify-between text-[15px] font-extrabold lg:mx-0 lg:mt-3">
            {status === 'ended' ? 'Final ranking' : 'Live ranking'}
            <span className="text-xs font-semibold text-muted">by Sparks</span>
          </h2>

          {entries.length === 0 ? (
            <EmptyState title={status === 'scheduled' ? 'Entries open when the countdown ends' : 'No entry yet'}>
              {status === 'open' ? 'Be the first talent in this Clash.' : null}
            </EmptyState>
          ) : (
            <ol className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:px-0 xl:grid-cols-4">
              {entries.map((entry, index) => {
                const sparked = Boolean(mySparks?.has(entry.id))
                return (
                  <li key={entry.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setPlaying((current) => (current === entry.id ? null : entry.id))}
                      aria-label={`Play ${entry.author.displayName}'s entry`}
                      className={clsx(
                        'relative block aspect-[9/16] w-full overflow-hidden rounded-[22px] border transition-shadow',
                        playing === entry.id ? 'border-world shadow-[0_0_0_2px_var(--world-a),0_18px_40px_var(--world-glow)]' : 'border-fg/8',
                      )}
                    >
                      <VideoPlayer entry={entry} active={playing === entry.id} />
                      <span
                        className={clsx(
                          'absolute top-2.5 left-2.5 grid size-8 place-items-center rounded-full text-sm font-extrabold',
                          index === 0 ? 'bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-world-ink' : 'bg-black/55 backdrop-blur-md',
                        )}
                      >
                        {index + 1}
                      </span>
                    </button>
                    <EntryOptions entry={entry} className="absolute top-2.5 right-2.5" />
                    <div className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2">
                      <Link to={`/u/${entry.author.handle}`} className="min-w-0 truncate text-[13px] font-extrabold [text-shadow:0_1px_8px_rgba(0,0,0,.8)]">
                        <span translate="no" className="notranslate">@{entry.author.handle}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleSpark(entry)}
                        aria-pressed={sparked}
                        aria-label={sparked ? 'Remove your Spark' : 'Spark this entry'}
                        className={clsx(
                          'pressable flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-extrabold backdrop-blur-md',
                          sparked ? 'bg-world text-world-ink' : 'bg-black/55',
                        )}
                      >
                        <SparkIcon size={14} /> {compactNumber(entry.sparks)}
                      </button>
                    </div>
                    {isCreator && clash.judging === 'creator' && status === 'ended' && !clash.winnerEntryId && (
                      <button
                        type="button"
                        onClick={() =>
                          pickClashWinner(clash.id, entry.id)
                            .then(() => queryClient.invalidateQueries({ queryKey: ['clash', clash.id] }))
                            .then(() => toast(`@${entry.author.handle} wins the Clash`))
                            .catch((error: Error) => toast(error.message))
                        }
                        className="pressable mt-2 h-9 w-full rounded-xl border border-world text-xs font-extrabold text-world"
                      >
                        Crown the winner
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          )}

          {isCreator && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="mx-4 mt-10 text-sm font-semibold text-muted underline-offset-4 hover:underline lg:mx-0"
            >
              Delete this Clash
            </button>
          )}
        </div>
      </div>

      <ConfirmSheet
        open={confirmingDelete}
        title="Delete this Clash?"
        message="The Clash and its ranking disappear. The videos stay on their authors' profiles."
        confirmLabel="Delete"
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() =>
          deleteClash(clash.id)
            .then(() => queryClient.invalidateQueries({ queryKey: ['clashes'] }))
            .then(() => navigate('/clash', { replace: true }))
            .catch(() => toast('The Clash could not be deleted.'))
        }
      />

      <div className="fixed inset-x-4 bottom-[calc(var(--safe-bottom)+104px)] z-10 lg:hidden">
        <EnterButton clash={clash} status={status} entered={Boolean(mine)} onEnter={() => requireSession('enter this Clash', () => navigate(`/create?clash=${clash.id}`))} />
      </div>
    </div>
  )
}

function EnterButton({ clash, status, entered, onEnter }: { clash: Clash; status: ReturnType<typeof liveStatus>; entered: boolean; onEnter: () => void }) {
  if (status === 'ended') return null
  if (clash.format === 'live') {
    return (
      <Link
        to={`/live/${clash.id}`}
        className="pressable flex h-[62px] w-full items-center justify-center gap-3 rounded-[22px] bg-[#ff4d6d] text-base font-extrabold text-white shadow-[0_14px_34px_rgba(255,77,109,.45)]"
      >
        <span className="size-2.5 animate-pulse rounded-full bg-white" />
        Enter the live room
      </Link>
    )
  }
  const disabled = status === 'scheduled' || entered
  return (
    <button
      type="button"
      onClick={onEnter}
      disabled={disabled}
      className="pressable flex h-[62px] w-full items-center justify-center gap-3 rounded-[22px] bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-base font-extrabold text-world-ink shadow-[0_14px_34px_var(--world-glow)] disabled:bg-none disabled:bg-fg/10 disabled:text-muted disabled:shadow-none"
    >
      {!disabled && (
        <span className="grid size-[38px] place-items-center rounded-xl bg-black/14">
          <CameraIcon />
        </span>
      )}
      {entered ? 'You are in this Clash' : status === 'scheduled' ? 'Opens when the countdown ends' : `Enter with a ${clash.maxSeconds}s video`}
    </button>
  )
}

function StatusChip({ status }: { status: ReturnType<typeof liveStatus> }) {
  return (
    <span
      className={clsx(
        'flex h-6 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-extrabold tracking-wider uppercase',
        status === 'open' ? 'bg-[#ff4d6d] text-white' : 'bg-black/40 text-fg/85',
      )}
    >
      {status === 'open' && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
      {status === 'open' ? 'Open' : status === 'scheduled' ? 'Starting soon' : 'Ended'}
    </span>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="flex h-6 items-center rounded-full bg-black/40 px-3 text-[10.5px] font-extrabold tracking-wider text-fg/85 uppercase">{children}</span>
}

function GroupScoreboard({ scores, accent }: { scores: { groupId: string; name: string; points: number }[]; accent: string }) {
  const total = scores.reduce((sum, score) => sum + score.points, 0)
  return (
    <div className="mt-5 rounded-2xl bg-black/25 p-4">
      <p className="mb-3 text-[11px] font-extrabold tracking-widest text-fg/60 uppercase">Group score</p>
      {scores.map((score, index) => (
        <div key={score.groupId} className="mb-2 last:mb-0">
          <div className="mb-1 flex justify-between text-sm font-extrabold">
            <Link to={`/g/${score.groupId}`}>{score.name}</Link>
            <span className="tabular">{score.points}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fg/10">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${total === 0 ? 0 : (score.points / total) * 100}%`, background: index === 0 ? accent : '#9AA2C8' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function WinnerBanner({ entry }: { entry: Entry }) {
  return (
    <Link
      to={`/u/${entry.author.handle}`}
      className="pressable mx-4 mt-6 flex items-center gap-4 rounded-[26px] border border-world bg-world-soft p-4 shadow-[0_20px_50px_var(--world-glow)] lg:mx-0 lg:mt-3"
    >
      <span className="animate-float grid size-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-world-ink">
        <CrownIcon size={30} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-extrabold tracking-widest text-world uppercase">Winner</span>
        <span className="block truncate text-lg font-extrabold"><span translate="no" className="notranslate">@{entry.author.handle}</span></span>
        <span className="text-xs text-muted">{compactNumber(entry.sparks)} Sparks</span>
      </span>
    </Link>
  )
}

function InvitePanel({ clash, invitees }: { clash: Clash; invitees: { id: string; handle: string }[] }) {
  const session = useSession()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [picked, setPicked] = useState<Person[]>([])
  const invitedIds = new Set(invitees.map((person) => person.id))
  const fresh = picked.filter((person) => !invitedIds.has(person.id))

  return (
    <section className="mx-4 mt-6 rounded-[26px] border border-line bg-fg/4 p-4 lg:mx-0 lg:mt-3">
      <h2 className="text-[15px] font-extrabold">Invited talents</h2>
      <p className="mt-1 mb-3 text-xs text-muted">
        {invitees.length === 0 ? 'Nobody is invited yet.' : invitees.map((person) => `@${person.handle}`).join(' · ')}
      </p>
      <PeoplePicker selected={picked} onChange={setPicked} selfId={session?.user.id} />
      {fresh.length > 0 && session && (
        <button
          type="button"
          onClick={() =>
            inviteToClash(clash.id, session.user.id, fresh.map((person) => person.id))
              .then(() => queryClient.invalidateQueries({ queryKey: ['clash-invitees', clash.id] }))
              .then(() => {
                setPicked([])
                toast(`${fresh.length} ${fresh.length === 1 ? 'talent' : 'talents'} invited`)
              })
              .catch(() => toast('The invitations could not be sent.'))
          }
          className="pressable mt-3 h-11 w-full rounded-xl bg-world text-sm font-extrabold text-world-ink"
        >
          Invite {fresh.length}
        </button>
      )}
    </section>
  )
}
