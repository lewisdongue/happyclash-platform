import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

interface SoundValue {
  muted: boolean
  /** The viewer's own choice, regardless of what the browser currently allows. */
  wantsSound: boolean
  toggle: () => void
  /** Called by a player when the browser refused to start it with sound. */
  reportAutoplayBlocked: () => void
  /** True during the gesture that just unlocked sound, so that tap is not also read as pause or mute. */
  justUnlocked: () => boolean
}

const STORAGE_KEY = 'hc:muted2'
const UNLOCK_WINDOW_MS = 600

const SoundContext = createContext<SoundValue>({
  muted: true,
  wantsSound: true,
  toggle: () => {},
  reportAutoplayBlocked: () => {},
  justUnlocked: () => false,
})

function readMutedPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function saveMutedPreference(muted: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0')
  } catch {
    // Storage can be unavailable (private mode); the preference then lasts for the visit.
  }
}

/**
 * Videos play with sound by default. When the browser blocks sound before
 * the first interaction, they start muted and the first tap or key press
 * anywhere on the page turns sound on. A viewer who mutes on purpose stays
 * muted across visits.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(readMutedPreference)
  const [blocked, setBlocked] = useState(false)
  const unlockedAt = useRef(0)

  useEffect(() => {
    if (!blocked) return
    const unlock = () => {
      // Inside the gesture itself: unmute the playing video, and give every other
      // video of the feed one muted play/pause so iOS lets it start with sound later.
      document.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
        if (video.dataset.active === 'true' && video.getClientRects().length > 0) {
          video.muted = false
          void video.play().catch(() => undefined)
        } else if (video.paused) {
          video.muted = true
          void video
            .play()
            .then(() => {
              // Only rewind if it is still a background video: it may have become the active one meanwhile.
              if (video.dataset.active === 'true') return
              video.pause()
              video.currentTime = 0
            })
            .catch(() => undefined)
        }
      })
      unlockedAt.current = performance.now()
      setBlocked(false)
      setMuted(false)
    }
    // iOS only grants sound on touchend/click, desktop on pointerdown/keydown: listen to all,
    // so the very first tap anywhere (even on the sign-up popup) turns sound on.
    const events = ['pointerdown', 'touchend', 'click', 'keydown'] as const
    events.forEach((name) => window.addEventListener(name, unlock, { capture: true, passive: true }))
    return () => events.forEach((name) => window.removeEventListener(name, unlock, { capture: true }))
  }, [blocked])

  const toggle = useCallback(() => {
    // The tap on the speaker that unlocked sound means "sound on", not "mute again":
    // otherwise the muted choice gets saved and every visit starts silent.
    if (performance.now() - unlockedAt.current < UNLOCK_WINDOW_MS) {
      saveMutedPreference(false)
      setMuted(false)
      return
    }
    setMuted((current) => {
      saveMutedPreference(!current)
      return !current
    })
  }, [])

  // Only the refused video goes muted; the viewer's choice stays "sound on",
  // so the next tap unmutes and every later video starts with sound.
  const reportAutoplayBlocked = useCallback(() => setBlocked(true), [])

  const justUnlocked = useCallback(() => performance.now() - unlockedAt.current < UNLOCK_WINDOW_MS, [])

  // While the browser holds sound back, the UI shows muted: that is what the viewer hears.
  const value = useMemo(
    () => ({ muted: muted || blocked, wantsSound: !muted, toggle, reportAutoplayBlocked, justUnlocked }),
    [muted, blocked, toggle, reportAutoplayBlocked, justUnlocked],
  )
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}

export const useSound = () => useContext(SoundContext)
