import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { BoostIcon, PassIcon, SparkIcon, TalkIcon } from '@/components/icons/ActionIcons'
import { compactNumber } from '@/lib/format'
import { useQueryClient } from '@tanstack/react-query'
import { useMySparks } from '@/api/queries'
import { setSpark } from '@/api/social'
import { useSession } from '@/app/session'
import { adjustEntryCounts, useEntryCounts } from '@/app/realtime'
import { useRequireSession } from '@/app/requireSession'
import type { Entry } from '@/types/domain'

export type EntryPanel = 'talk' | 'boost' | 'pass'

interface ActionStringProps {
  entry: Entry
  onOpen: (panel: EntryPanel) => void
  size?: 'phone' | 'desktop'
  /** Subscribes to live counters; true for the video on screen. */
  live?: boolean
}

/**
 * The video actions sit on a thin "light string" that hums with the video.
 * Spark answers instantly with a burst; the others open their panel.
 */
export function ActionString({ entry, onOpen, size = 'phone', live = false }: ActionStringProps) {
  const session = useSession()
  const queryClient = useQueryClient()
  const counts = useEntryCounts(entry, live)
  const { data: mySparks } = useMySparks(session?.user.id)
  const sparked = mySparks?.has(entry.id) ?? false
  const [bursts, setBursts] = useState<number[]>([])
  const requireSession = useRequireSession()
  const scale = size === 'desktop' ? 1.1 : 1

  // Optimistic: the Spark and its count change at once, and roll back if the write fails.
  const applySpark = (userId: string, on: boolean) => {
    queryClient.setQueryData<Set<string>>(['my-sparks', userId], (current) => {
      const next = new Set(current)
      if (on) next.add(entry.id)
      else next.delete(entry.id)
      return next
    })
    adjustEntryCounts(queryClient, entry.id, { sparks: on ? 1 : -1 })
  }

  const spark = () =>
    requireSession('Spark this talent', (current) => {
      const next = !sparked
      applySpark(current.user.id, next)
      if (next) setBursts((list) => [...list, Date.now()])
      navigator.vibrate?.(12)
      setSpark(entry.id, current.user.id, next)
        .then(() => queryClient.invalidateQueries({ queryKey: ['ranking'] }))
        .catch(() => applySpark(current.user.id, !next))
    })

  return (
    <div className="relative flex flex-col items-center gap-4 py-2.5">
      <span
        aria-hidden="true"
        className="animate-hum absolute inset-y-[-24px] left-1/2 w-0.5 -translate-x-1/2 rounded-full opacity-70 shadow-[0_0_12px_var(--world-glow)]"
        style={{ background: 'linear-gradient(180deg, transparent, var(--world-a) 15%, var(--world-a) 85%, transparent)' }}
      />

      <ActionButton label={sparked ? 'Remove spark' : 'Spark'} count={compactNumber(counts.sparks)} onClick={spark} pressed={sparked}>
        <span className={clsx('relative flex', sparked ? 'scale-110' : 'animate-float')}>
          <SparkIcon size={30 * scale} />
          <AnimatePresence>
            {bursts.map((id) => (
              <motion.span
                key={id}
                aria-hidden="true"
                className="absolute inset-0 rounded-full border-2 border-world"
                initial={{ scale: 0.6, opacity: 1 }}
                animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                onAnimationComplete={() => setBursts((list) => list.filter((value) => value !== id))}
              />
            ))}
          </AnimatePresence>
        </span>
      </ActionButton>

      <ActionButton label="Talk" count={compactNumber(counts.comments)} onClick={() => onOpen('talk')}>
        <TalkIcon size={28 * scale} />
      </ActionButton>
      <ActionButton label="Boost this talent" count="Boost" onClick={() => onOpen('boost')}>
        <BoostIcon size={30 * scale} />
      </ActionButton>
      <ActionButton label="Pass it on" count="Pass" onClick={() => onOpen('pass')}>
        <PassIcon size={28 * scale} />
      </ActionButton>
    </div>
  )
}

interface ActionButtonProps {
  label: string
  count: string
  onClick: () => void
  pressed?: boolean
  children: ReactNode
}

function ActionButton({ label, count, onClick, pressed, children }: ActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="pressable relative flex flex-col items-center gap-0.5 text-text"
    >
      <span className="flex drop-shadow-[0_4px_10px_rgba(0,0,0,.6)]">{children}</span>
      <span className={clsx('text-[11px] font-bold [text-shadow:0_1px_6px_rgba(0,0,0,.8)]', pressed && 'text-world')}>{count}</span>
    </button>
  )
}
