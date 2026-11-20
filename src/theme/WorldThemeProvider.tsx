import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { WorldId } from '@/types/domain'
import { WORLDS, withAlpha } from './worlds'

interface WorldThemeValue {
  worldId: WorldId
  setWorld: (id: WorldId) => void
}

const WorldThemeContext = createContext<WorldThemeValue | null>(null)

/**
 * Publishes the active Talent World as CSS variables on <html>.
 * Components never read colors from here directly: they use the Tailwind
 * `world` color tokens, which resolve to these variables.
 */
export function WorldThemeProvider({ children }: { children: ReactNode }) {
  const [worldId, setWorldId] = useState<WorldId>('music')

  useEffect(() => {
    const world = WORLDS[worldId]
    const root = document.documentElement.style
    root.setProperty('--world-a', world.accent)
    root.setProperty('--world-b', world.accentDeep)
    root.setProperty('--world-soft', withAlpha(world.accent, 0.18))
    root.setProperty('--world-glow', withAlpha(world.accent, 0.5))
    root.setProperty('--world-ink', world.onAccent)
    root.setProperty('--world-scene', world.scene)
  }, [worldId])

  const setWorld = useCallback((id: WorldId) => setWorldId(id), [])
  const value = useMemo(() => ({ worldId, setWorld }), [worldId, setWorld])

  return <WorldThemeContext.Provider value={value}>{children}</WorldThemeContext.Provider>
}

export function useWorldTheme(): WorldThemeValue {
  const context = useContext(WorldThemeContext)
  if (!context) throw new Error('useWorldTheme must be used inside <WorldThemeProvider>')
  return context
}
