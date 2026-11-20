import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

const IDLE_MS = 3200
/** A tap that only brings the chrome back must not also pause the video. */
const WAKE_TAP_MS = 500

interface ImmersiveValue {
  /** True while the chrome is hidden so the video owns the screen. */
  immersive: boolean
  /** Enables or disables the idle timer (only the feed is immersive). */
  setEnabled: (enabled: boolean) => void
  /** Brings the chrome back and restarts the idle timer. */
  wake: () => void
  /** True during the tap that brought the chrome back. */
  justWoke: () => boolean
  /** While a video is paused the chrome stays visible (comments, actions…). */
  setHeld: (held: boolean) => void
}

const ImmersiveContext = createContext<ImmersiveValue | null>(null)

/**
 * Immersive mode: while watching, every overlay fades out after a short
 * idle period. Any touch, scroll or key press brings it back.
 */
export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const hidden = useRef(false)
  const wokeAt = useRef(0)
  const held = useRef(false)

  useEffect(() => {
    hidden.current = immersive
  }, [immersive])

  const wake = useCallback(() => {
    if (hidden.current) wokeAt.current = performance.now()
    hidden.current = false
    setImmersive(false)
    window.clearTimeout(timer.current)
    if (enabled && !held.current) timer.current = window.setTimeout(() => setImmersive(true), IDLE_MS)
  }, [enabled])

  const setHeld = useCallback(
    (next: boolean) => {
      if (held.current === next) return
      held.current = next
      if (next) {
        window.clearTimeout(timer.current)
        hidden.current = false
        setImmersive(false)
      } else wake()
    },
    [wake],
  )

  useEffect(() => {
    if (!enabled) {
      setImmersive(false)
      return
    }
    wake()
    const events = ['pointerdown', 'keydown', 'wheel'] as const
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }))
    return () => {
      window.clearTimeout(timer.current)
      events.forEach((name) => window.removeEventListener(name, wake))
    }
  }, [enabled, wake])

  const justWoke = useCallback(() => performance.now() - wokeAt.current < WAKE_TAP_MS, [])
  const value = useMemo(() => ({ immersive, setEnabled, wake, justWoke, setHeld }), [immersive, wake, justWoke, setHeld])
  return <ImmersiveContext.Provider value={value}>{children}</ImmersiveContext.Provider>
}

export function useImmersive(): ImmersiveValue {
  const context = useContext(ImmersiveContext)
  if (!context) throw new Error('useImmersive must be used inside <ImmersiveProvider>')
  return context
}
