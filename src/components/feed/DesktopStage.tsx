import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { recordView } from '@/api/entries'
import { useClashBacks, useRanking } from '@/api/queries'
import { BoltIcon, SparkIcon } from '@/components/icons/ActionIcons'
import { CameraIcon, ChevronIcon, VerifiedBadge } from '@/components/icons/UiIcons'
import { Avatar } from '@/components/ui/Avatar'
import { compactNumber } from '@/lib/format'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import { useLockPageScroll } from '@/hooks/useLockPageScroll'
import { useWorldJump } from '@/lib/worldJump'
import { ActionString, type EntryPanel } from './ActionString'
import { EntryOptions } from './EntryOptions'
import { FeedModeTabs } from './FeedModeTabs'
import { NewVideosPill } from './NewVideosPill'
import type { FeedProps } from './PhoneFeed'
import { EntryPanels } from './EntryPanels'
import { SoundButton } from './SoundButton'
import { VideoPlayer } from './VideoPlayer'
import { WorldPill } from './WorldPill'
import { QuickFollow } from './QuickFollow'

/** One wheel or trackpad gesture moves exactly one video. */
const WHEEL_THRESHOLD = 40
const WHEEL_COOLDOWN_MS = 650

/**
 * Desktop home: a cinema stage. The video sits in the middle and its world
 * light spills over the page; ranking on the left, the Clash Back chain on
 * the right. Wheel, trackpad, arrow keys and the side arrows move between videos.
 */
export function DesktopStage({ entries, startId, onNearEnd, newCount, onShowNew, mode, onMode }: FeedProps) {
  const { setWorld } = useWorldTheme()
  const navigate = useNavigate()
  const [index, setIndex] = useState(() => Math.max(0, entries.findIndex((item) => item.id === startId)))
  const [direction, setDirection] = useState(1)
  const [panel, setPanel] = useState<EntryPanel | null>(null)
  const lastWheel = useRef(0)
  const stage = useRef<HTMLDivElement>(null)
  useLockPageScroll()
  // The list can shrink (a deleted or hidden video), so the index is clamped.
  const entry = entries[Math.min(index, entries.length - 1)]
  const { data: ranking = [] } = useRanking('talents', 'week')
  const { data: answers = [] } = useClashBacks(entry.id)

  useEffect(() => setWorld(entry.worldId), [entry.worldId, setWorld])

  useEffect(() => {
    if (index >= entries.length - 3) onNearEnd()
  }, [index, entries.length, onNearEnd])

  // Picking a world in the top bar jumps to that world's next video.
  useWorldJump((target) => {
    const current = Math.min(index, entries.length - 1)
    const after = entries.findIndex((item, position) => position > current && item.worldId === target)
    const match = after >= 0 ? after : entries.findIndex((item) => item.worldId === target)
    if (match < 0 || match === current) return
    setDirection(match > current ? 1 : -1)
    setIndex(match)
  })

  useEffect(() => {
    const timer = window.setTimeout(() => recordView(entry.id), 2000)
    return () => window.clearTimeout(timer)
  }, [entry.id])

  const step = useCallback(
    (delta: number) => {
      setDirection(delta)
      setIndex((current) => Math.min(entries.length - 1, Math.max(0, current + delta)))
    },
    [entries.length],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || panel) return
      if (event.key === 'ArrowDown' || event.key === 'j') step(1)
      if (event.key === 'ArrowUp' || event.key === 'k') step(-1)
      if (event.key.toLowerCase() === 'c') navigate(`/clash-back/${entry.id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, navigate, entry.id, panel])

  // Native, non-passive listener: the wheel must move videos, never the page.
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (panel) return
      event.preventDefault()
      if (Math.abs(event.deltaY) < WHEEL_THRESHOLD) return
      const now = performance.now()
      if (now - lastWheel.current < WHEEL_COOLDOWN_MS) return
      lastWheel.current = now
      step(event.deltaY > 0 ? 1 : -1)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [step, panel])

  return (
    <div ref={stage} className="relative hidden h-[calc(100dvh-76px)] overflow-hidden lg:block">
      <div aria-hidden="true" className="animate-breathe pointer-events-none absolute top-[-80px] left-1/2 h-[1000px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--world-soft),transparent)]" />

      <div className="absolute inset-x-0 top-2 z-30 flex flex-col items-center gap-2">
        <FeedModeTabs mode={mode} onMode={onMode} />
        <NewVideosPill
          count={newCount}
          onShow={() => {
            setIndex(0)
            onShowNew()
          }}
        />
      </div>

      <div className="relative mx-auto flex h-full max-w-[1600px] items-stretch gap-8 px-8 pt-14 pb-5">
        <aside className="hidden w-[300px] shrink-0 flex-col self-center rounded-3xl border border-line bg-fg/[.035] p-5 xl:flex">
          <h2 className="mb-2 text-[15px] font-extrabold">Top talents this week</h2>
          {ranking.length === 0 ? (
            <p className="py-6 text-sm text-muted">Sparks decide the ranking. Be the first to give one.</p>
          ) : (
            ranking.slice(0, 6).map((row) => (
              <Link key={row.id} to={row.href ?? '/animals?view=ranking'} className="flex h-12 items-center gap-3 border-b border-fg/5 hover:text-world">
                <span className={row.rank === 1 ? 'w-5 font-extrabold text-world' : 'w-5 font-extrabold text-subtle'}>{row.rank}</span>
                <span translate="no" className="notranslate flex-1 truncate text-sm font-bold">{row.name}</span>
                <span className="tabular flex items-center gap-1 text-[13px] font-extrabold">
                  <SparkIcon size={12} /> {row.points.toLocaleString('en-US')}
                </span>
              </Link>
            ))
          )}
          <Link to="/animals?view=ranking" className="mt-4 inline-block text-[13px] font-bold text-muted hover:text-text">Full ranking</Link>
        </aside>

        <main className="flex min-w-0 flex-1 items-center justify-center gap-6">
          <div className="relative h-full max-h-[880px] min-h-0 aspect-[9/16]">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={entry.id}
                custom={direction}
                initial={{ y: `${direction * 100}%`, opacity: 0.4, scale: 0.94 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: `${direction * -100}%`, opacity: 0.4, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 260, damping: 32 }}
                className="absolute inset-0 overflow-hidden rounded-[30px] shadow-[0_0_0_1px_var(--world-soft),0_40px_120px_var(--world-soft),0_30px_80px_rgba(0,0,0,.7)]"
              >
                <VideoPlayer entry={entry} active interactive adaptive />
                <div className="absolute top-4 right-4 left-4 flex items-center gap-2">
                  <WorldPill entry={entry} />
                  <SoundButton />
                  <EntryOptions entry={entry} className="ml-auto" />
                </div>
                <div className="absolute inset-x-5 bottom-5">
                  <div className="flex items-center gap-2.5">
                    <Link to={`/u/${entry.author.handle}`} className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={entry.author.displayName} src={entry.author.avatarUrl} size={36} ring />
                      <span className="truncate text-base font-extrabold"><span translate="no" className="notranslate">{entry.author.handle}</span></span>
                      {entry.author.verified && <VerifiedBadge />}
                    </Link>
                    <QuickFollow author={entry.author} />
                  </div>
                  <p className="mt-2 mb-3.5 text-sm text-fg/90">{entry.caption}</p>
                  <Link
                    to={`/clash-back/${entry.id}`}
                    className="pressable flex h-[52px] items-center justify-center gap-2.5 rounded-[18px] bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-[15px] font-extrabold text-world-ink shadow-[0_12px_30px_var(--world-glow)]"
                  >
                    <BoltIcon size={20} color="var(--world-ink)" /> Clash Back
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex h-full flex-col items-center justify-between py-6">
            <StepButton label="Previous video" disabled={index === 0} onClick={() => step(-1)} up />
            <ActionString entry={entry} onOpen={setPanel} size="desktop" live />
            <StepButton label="Next video" disabled={index === entries.length - 1} onClick={() => step(1)} />
          </div>
        </main>

        <aside className="hidden w-[300px] shrink-0 flex-col gap-3 self-center lg:flex">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-extrabold">Clash Back chain</h2>
            <span className="text-xs text-muted">
              {answers.length} {answers.length === 1 ? 'answer' : 'answers'}
            </span>
          </div>
          {answers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-fg/12 p-5 text-sm text-muted">
              Nobody has answered this video yet. The first Clash Back starts the chain.
            </div>
          ) : (
            answers.slice(0, 3).map((answer) => (
              <Link key={answer.id} to={`/duel/${entry.id}/${answer.id}`} className="pressable relative block h-[150px] overflow-hidden rounded-2xl border border-fg/7">
                <VideoPlayer entry={answer} active={false} />
                <span className="absolute bottom-2.5 left-3 text-[13px] font-extrabold"><span translate="no" className="notranslate">{answer.author.displayName}</span></span>
                <span className="absolute right-3 bottom-2.5 flex items-center gap-1 text-xs font-extrabold text-world">
                  <SparkIcon size={12} /> {compactNumber(answer.sparks)}
                </span>
              </Link>
            ))
          )}
          <Link to={`/create?answer=${entry.id}`} className="pressable flex h-[50px] items-center justify-center gap-2.5 rounded-2xl border border-fg/12 bg-fg/7 text-sm font-extrabold">
            <CameraIcon size={18} /> Answer with your talent
          </Link>
          <p className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
            <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> or scroll · next video</span>
            <span><Kbd>C</Kbd> Clash Back</span>
          </p>
        </aside>
      </div>

      <EntryPanels entry={entry} panel={panel} onClose={() => setPanel(null)} />
    </div>
  )
}

function StepButton({ label, disabled, onClick, up = false }: { label: string; disabled: boolean; onClick: () => void; up?: boolean }) {
  return (
    <button
      data-guest-ok
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="pressable grid size-11 place-items-center rounded-full border border-fg/10 bg-fg/6 disabled:opacity-25"
    >
      <ChevronIcon size={18} className={up ? '-rotate-90' : 'rotate-90'} />
    </button>
  )
}

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded-md border border-fg/15 px-1.5 py-0.5 font-sans text-text">{children}</kbd>
)
