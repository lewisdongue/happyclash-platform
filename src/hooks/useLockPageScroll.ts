import { useEffect } from 'react'

/**
 * Freezes the document while a full-screen experience (the video feed) is
 * shown, so wheel and touch gestures move videos instead of the page.
 */
export function useLockPageScroll(active = true) {
  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [active])
}
