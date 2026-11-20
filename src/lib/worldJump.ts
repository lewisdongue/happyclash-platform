import { useEffect, useRef } from 'react'
import type { WorldId } from '@/types/domain'

const EVENT = 'hc:jump-to-world'

/**
 * The top bar asks the home stage to jump to a world's next video. This is an
 * explicit request, not a reaction to the theme color: the stage itself sets
 * the theme as videos change, and reacting to that would make the two loop.
 */
export function jumpToWorld(worldId: WorldId) {
  window.dispatchEvent(new CustomEvent<WorldId>(EVENT, { detail: worldId }))
}

export function useWorldJump(onJump: (worldId: WorldId) => void) {
  const latest = useRef(onJump)
  latest.current = onJump
  useEffect(() => {
    const listener = (event: Event) => latest.current((event as CustomEvent<WorldId>).detail)
    window.addEventListener(EVENT, listener)
    return () => window.removeEventListener(EVENT, listener)
  }, [])
}
