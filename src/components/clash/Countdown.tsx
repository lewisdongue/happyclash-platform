import { useEffect, useState } from 'react'
import type { Clash, ClashStatus } from '@/types/domain'

/** Current time, re-rendering every second while mounted. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

/** Status from the clock, so a Clash flips from scheduled to open to ended without a refetch. */
export function liveStatus(clash: Pick<Clash, 'startsAt' | 'endsAt'>, now: number): ClashStatus {
  if (now < Date.parse(clash.startsAt)) return 'scheduled'
  if (now < Date.parse(clash.endsAt)) return 'open'
  return 'ended'
}

/** 3d 04h · 5h 12m · 12:09 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  if (days > 0) return `${days}d ${pad(hours)}h`
  if (hours > 0) return `${hours}h ${pad(minutes)}m`
  return `${pad(minutes)}:${pad(seconds)}`
}

const LABEL: Record<ClashStatus, string> = { scheduled: 'Starts in', open: 'Ends in', ended: 'Ended' }

export function Countdown({ clash, className }: { clash: Pick<Clash, 'startsAt' | 'endsAt'>; className?: string }) {
  const now = useNow()
  const status = liveStatus(clash, now)
  const target = status === 'scheduled' ? Date.parse(clash.startsAt) : Date.parse(clash.endsAt)
  return (
    <span className={className}>
      {LABEL[status]}
      {status !== 'ended' && <span className="tabular ml-1">{formatRemaining(target - now)}</span>}
    </span>
  )
}

/** Large segmented clock for the Clash page. */
export function BigCountdown({ clash }: { clash: Pick<Clash, 'startsAt' | 'endsAt'> }) {
  const now = useNow()
  const status = liveStatus(clash, now)
  if (status === 'ended') return null
  const total = Math.max(0, Math.floor(((status === 'scheduled' ? Date.parse(clash.startsAt) : Date.parse(clash.endsAt)) - now) / 1000))
  const parts = [
    { value: Math.floor(total / 86400), unit: 'days' },
    { value: Math.floor((total % 86400) / 3600), unit: 'hrs' },
    { value: Math.floor((total % 3600) / 60), unit: 'min' },
    { value: total % 60, unit: 'sec' },
  ]
  return (
    <div>
      <p className="mb-2 text-[11px] font-extrabold tracking-widest text-muted uppercase">{LABEL[status]}</p>
      <div className="flex gap-2">
        {parts.map((part) => (
          <span key={part.unit} className="flex w-[64px] flex-col items-center rounded-2xl border border-line bg-fg/5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
            <span className="tabular text-2xl font-extrabold">{String(part.value).padStart(2, '0')}</span>
            <span className="text-[10px] font-bold tracking-wider text-muted uppercase">{part.unit}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
