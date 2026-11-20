import { useEffect, useRef, useState } from 'react'
import { useImmersive } from '@/app/ImmersiveContext'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import { useLockPageScroll } from '@/hooks/useLockPageScroll'
import type { FeedMode } from '@/api/queries'
import type { Entry } from '@/types/domain'
import { FeedHeader } from './FeedHeader'
import { FeedItem } from './FeedItem'
import { NewVideosPill } from './NewVideosPill'

export interface FeedProps {
  entries: Entry[]
  startId?: string
  /** Called when the viewer gets close to the last loaded video. */
  onNearEnd: () => void
  newCount: number
  onShowNew: () => void
  mode: FeedMode
  onMode: (mode: FeedMode) => void
}

/**
 * Vertical, snap-scrolling feed. Whichever video is on screen sets the
 * world color for the whole app and keeps immersive mode running.
 */
export function PhoneFeed({ entries, startId, onNearEnd, newCount, onShowNew, mode, onMode }: FeedProps) {
  const container = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const { setWorld } = useWorldTheme()
  const { setEnabled } = useImmersive()
  useLockPageScroll()

  // Opening a video from a profile lands directly on it.
  useEffect(() => {
    if (!startId) return
    container.current?.querySelector(`[data-entry-id="${startId}"]`)?.scrollIntoView({ block: 'start' })
  }, [startId])

  useEffect(() => {
    setEnabled(true)
    return () => setEnabled(false)
  }, [setEnabled])

  useEffect(() => {
    const root = container.current
    if (!root) return
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records.find((record) => record.isIntersecting)
        const id = visible?.target.getAttribute('data-entry-id')
        const index = entries.findIndex((entry) => entry.id === id)
        if (index >= 0) setActiveIndex(index)
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('[data-entry-id]').forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [entries])

  useEffect(() => {
    const entry = entries[activeIndex]
    if (entry) setWorld(entry.worldId)
    if (activeIndex >= entries.length - 3) onNearEnd()
  }, [activeIndex, entries, setWorld, onNearEnd])

  const showNew = () => {
    container.current?.scrollTo({ top: 0 })
    setActiveIndex(0)
    onShowNew()
  }

  return (
    <>
      <FeedHeader mode={mode} onMode={onMode} />
      <div className="fixed inset-x-0 top-[calc(var(--safe-top)+64px)] z-30 flex justify-center">
        <NewVideosPill count={newCount} onShow={showNew} />
      </div>
      <div ref={container} className="no-scrollbar fixed inset-0 snap-y snap-mandatory overflow-y-scroll overscroll-contain bg-ink">
        {entries.map((entry, index) => (
          <FeedItem key={entry.id} entry={entry} active={index === activeIndex} warm={Math.abs(index - activeIndex) === 1} />
        ))}
      </div>
    </>
  )
}
