import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useImmersive } from '@/app/ImmersiveContext'
import { useSound } from '@/app/sound'
import { WORLDS } from '@/theme/worlds'
import type { Entry } from '@/types/domain'

interface VideoPlayerProps {
  entry: Entry
  /** Only the active video plays; the others stay paused on their poster. */
  active: boolean
  /** Neighbours of the active video preload so the next swipe starts instantly. */
  warm?: boolean
  /** Tap to pause and resume. Off for small previews. */
  interactive?: boolean
  /**
   * Full-screen use: on wide screens, and for videos filmed wider than tall,
   * the whole frame shows over a blurred copy instead of being cropped.
   */
  adaptive?: boolean
  /** Replays forever by default; turned off when something else should follow, as in a duel. */
  loop?: boolean
  onEnded?: () => void
  className?: string
}

export function VideoPlayer({ entry, active, warm = false, interactive = false, adaptive = false, loop = true, onEnded, className }: VideoPlayerProps) {
  const video = useRef<HTMLVideoElement>(null)
  const { muted, reportAutoplayBlocked, justUnlocked } = useSound()
  const { justWoke, setHeld } = useImmersive()
  const landscape = entry.width > entry.height * 0.85
  const [paused, setPaused] = useState(false)
  // Paused by the viewer: show everything again (comments, actions, caption).
  useEffect(() => {
    if (!active || !interactive) return
    setHeld(paused)
    return () => setHeld(false)
  }, [active, interactive, paused, setHeld])

  useEffect(() => {
    const element = video.current
    if (!element) return
    if (!active) {
      element.pause()
      element.currentTime = 0
      return
    }
    let cancelled = false
    setPaused(false)
    const retry = () => !cancelled && start(1)

    const start = (attempt: number) => {
      // A copy hidden by CSS (mobile vs desktop layout) must never play: that is the double audio.
      if (cancelled || element.getClientRects().length === 0) return
      element.play().catch((error: unknown) => {
        if (cancelled) return
        const name = error instanceof DOMException ? error.name : ''
        if (name === 'NotAllowedError' && !element.muted) {
          // Sound before any interaction is refused: play this one muted,
          // the first tap anywhere turns sound on for every video.
          element.muted = true
          reportAutoplayBlocked()
          start(attempt + 1)
        } else if (attempt < 3) {
          // AbortError and friends come from fast swipes interrupting a load: try again once it can play.
          element.addEventListener('canplay', retry, { once: true })
          if (element.readyState >= 3) start(attempt + 1)
        } else {
          setPaused(true)
        }
      })
    }
    start(0)
    return () => {
      cancelled = true
      element.removeEventListener('canplay', retry)
      element.pause()
    }
  }, [active, reportAutoplayBlocked])

  // React does not keep the `muted` property in sync after mount: do it by hand,
  // so only the active video can ever be heard.
  useEffect(() => {
    if (video.current) video.current.muted = muted || !active
  }, [muted, active])

  const togglePlayback = () => {
    const element = video.current
    if (!element || !interactive || justUnlocked() || justWoke()) return
    if (element.paused) {
      void element.play()
      setPaused(false)
    } else {
      element.pause()
      setPaused(true)
    }
  }

  return (
    <div className={clsx('absolute inset-0 overflow-hidden', className)} style={{ background: WORLDS[entry.worldId].scene }}>
      {adaptive && entry.posterUrl && (
        <img
          src={entry.posterUrl}
          alt=""
          aria-hidden="true"
          className={clsx('absolute inset-0 size-full scale-110 object-cover opacity-55 blur-2xl', !landscape && 'hidden md:block')}
        />
      )}
      <video
        ref={video}
        src={entry.videoUrl}
        poster={entry.posterUrl ?? undefined}
        muted={muted || !active}
        data-active={active}
        loop={loop}
        onEnded={onEnded}
        playsInline
        preload={active || warm ? 'auto' : 'metadata'}
        onClick={togglePlayback}
        onPlay={(event) => {
          const self = event.currentTarget
          if (!active) {
            if (!self.muted) self.pause()
            return
          }
          // One sound at a time: starting this video stops every other one.
          document.querySelectorAll<HTMLVideoElement>('video').forEach((other) => {
            if (other !== self && !other.paused) other.pause()
          })
        }}
        onPlaying={() => setPaused(false)}
        aria-label={`${entry.author.displayName}: ${entry.caption}`}
        className={clsx('relative size-full', adaptive ? (landscape ? 'object-contain' : 'object-cover md:object-contain') : 'object-cover')}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[linear-gradient(rgba(5,6,8,.55),transparent)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(transparent,rgba(5,6,8,.55)_45%,rgba(5,6,8,.92))]" />
      {interactive && paused && active && (
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/35 backdrop-blur-md">
          <svg viewBox="0 0 24 24" width="34" height="34">
            <path d="M8 5v14l11-7z" fill="#fff" />
          </svg>
        </span>
      )}
    </div>
  )
}
