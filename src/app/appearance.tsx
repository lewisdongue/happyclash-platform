import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'

export type Appearance = 'dark' | 'light'

interface AppearanceValue {
  /** The viewer's choice. Dark unless they switched to light in Settings. */
  appearance: Appearance
  setAppearance: (value: Appearance) => void
}

const STORAGE_KEY = 'hc:appearance'
const THEME_COLORS: Record<Appearance, string> = { dark: '#050608', light: '#f5f6fa' }

/** Video screens are always dark, whatever the viewer picked: videos read best on black. */
const ALWAYS_DARK = [/^\/$/, /^\/world\//, /^\/clash-back\//, /^\/duel\//, /^\/create/, /^\/life/, /^\/live\//]

const AppearanceContext = createContext<AppearanceValue>({ appearance: 'dark', setAppearance: () => {} })

export function readAppearance(): Appearance {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** Writes the theme on <html> and in the browser chrome color. */
export function applyAppearance(value: Appearance) {
  document.documentElement.dataset.theme = value
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[value])
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setState] = useState<Appearance>(readAppearance)

  const setAppearance = useCallback((value: Appearance) => {
    setState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for the visit.
    }
  }, [])

  const value = useMemo(() => ({ appearance, setAppearance }), [appearance, setAppearance])
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance(): AppearanceValue {
  return useContext(AppearanceContext)
}

/** Applies the viewer's appearance to the current route. Mounted once, inside the router. */
export function useRouteAppearance() {
  const { appearance } = useAppearance()
  const { pathname } = useLocation()
  const forcedDark = ALWAYS_DARK.some((pattern) => pattern.test(pathname))

  // Before paint, so a light page never flashes dark.
  useLayoutEffect(() => {
    applyAppearance(forcedDark ? 'dark' : appearance)
  }, [appearance, forcedDark])
}
