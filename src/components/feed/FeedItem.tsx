import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import clsx from 'clsx'
import { recordView } from '@/api/entries'
import { useImmersive } from '@/app/ImmersiveContext'
import { useEntryCounts } from '@/app/realtime'
import { BoltIcon } from '@/components/icons/ActionIcons'
import { ChevronIcon, VerifiedBadge } from '@/components/icons/UiIcons'
import { Avatar } from '@/components/ui/Avatar'
import type { Entry } from '@/types/domain'
import { ActionString, type EntryPanel } from './ActionString'
import { EntryOptions } from './EntryOptions'
import { EntryPanels } from './EntryPanels'
import { FloatingComments } from './FloatingComments'
import { SoundButton } from './SoundButton'
import { VideoPlayer } from './VideoPlayer'
import { WorldPill } from './WorldPill'
import { QuickFollow } from './QuickFollow'

/** A video counts as viewed after this much continuous watch time. */
const VIEW_AFTER_MS = 2000

interface FeedItemProps {
  entry: Entry
  active: boolean
  warm: boolean
}

/** One full-screen video of the phone feed, with every overlay that fades in immersive mode. */
export function FeedItem({ entry, active, warm }: FeedItemProps) {
  const { immersive } = useImmersive()
  const [panel, setPanel] = useState<EntryPanel | null>(null)
  const counted = useRef(false)
  const { clashBacks } = useEntryCounts(entry, false)
  const chrome = clsx('transition-opacity duration-500', immersive && 'pointer-events-none opacity-0')

  useEffect(() => {
    if (!active || counted.current) return
    const timer = window.setTimeout(() => {
      counted.current = true
      recordView(entry.id)
    }, VIEW_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [active, entry.id])

  return (
    <section data-entry-id={entry.id} className="relative h-dvh w-full snap-start snap-always overflow-hidden">
      <VideoPlayer entry={entry} active={active} warm={warm} interactive adaptive />

      <div className={clsx('absolute top-[calc(var(--safe-top)+66px)] left-4 z-10 flex items-center gap-2', chrome)}>
        <WorldPill entry={entry} />
        <SoundButton />
      </div>
      <div className={clsx('absolute top-[calc(var(--safe-top)+66px)] right-4 z-10', chrome)}>
        <EntryOptions entry={entry} />
      </div>

      <div className={clsx('absolute top-[38%] left-4 z-10', chrome)}>
        <FloatingComments entryId={entry.id} active={active} />
      </div>

      <div className={clsx('absolute right-3.5 bottom-[calc(var(--safe-bottom)+250px)] z-10', chrome)}>
        <ActionString entry={entry} onOpen={setPanel} live={active} />
      </div>

      <div className={clsx('absolute right-[76px] bottom-[calc(var(--safe-bottom)+178px)] left-4 z-10', chrome)}>
        <div className="flex items-center gap-2.5">
          <Link to={`/u/${entry.author.handle}`} className="flex min-w-0 items-center gap-2.5">
            <Avatar name={entry.author.displayName} src={entry.author.avatarUrl} ring />
            <span className="truncate text-[15px] font-extrabold"><span translate="no" className="notranslate">{entry.author.handle}</span></span>
            {entry.author.verified && <VerifiedBadge />}
            {entry.author.country && <span className="text-[11px] font-extrabold text-fg/60">{entry.author.country}</span>}
          </Link>
          <QuickFollow author={entry.author} />
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-fg/90 [text-shadow:0_1px_8px_rgba(0,0,0,.6)]">{entry.caption}</p>
      </div>

      <Link
        to={`/clash-back/${entry.id}`}
        className={clsx(
          'pressable absolute inset-x-4 bottom-[calc(var(--safe-bottom)+104px)] z-10 flex h-[58px] items-center justify-between rounded-[20px] pr-2 pl-[18px] text-world-ink shadow-[0_14px_34px_var(--world-glow),inset_0_1px_0_rgba(255,255,255,.6)]',
          'bg-[linear-gradient(180deg,var(--world-a),var(--world-b))]',
          chrome,
        )}
      >
        <span className="flex items-center gap-2.5 text-base font-extrabold">
          <BoltIcon size={22} color="var(--world-ink)" />
          Clash Back
        </span>
        <span className="flex h-[42px] items-center gap-2 rounded-[14px] bg-black/12 px-3 text-[13px] font-extrabold">
          {clashBacks === 0 ? 'Be the first' : `${clashBacks} ${clashBacks === 1 ? 'answer' : 'answers'}`}
          <ChevronIcon />
        </span>
      </Link>

      <EntryPanels entry={entry} panel={panel} onClose={() => setPanel(null)} />
    </section>
  )
}
