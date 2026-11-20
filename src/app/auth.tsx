import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSession } from '@/app/session'
import { AuthModal, type AuthMode } from '@/components/auth/AuthModal'

interface AuthUiValue {
  /** Opens the sign-in sheet; `reason` tells the user why it appeared. */
  openAuth: (mode?: AuthMode, reason?: string) => void
}

const AuthUiContext = createContext<AuthUiValue>({ openAuth: () => {} })

export function AuthUiProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ mode: AuthMode; reason?: string } | null>(null)
  const openAuth = useCallback((mode: AuthMode = 'signup', reason?: string) => setState({ mode, reason }), [])
  const value = useMemo(() => ({ openAuth }), [openAuth])
  const session = useSession()

  // Guests can only watch and scroll. Any other tap (buttons, links, fields) opens sign-up instead.
  // Elements (or areas) marked `data-guest-ok` stay usable: feed navigation, sound, Home/Life, Life driving, this sheet.
  useEffect(() => {
    if (session) return
    const guard = (event: Event) => {
      const target = event.target as Element | null
      if (!target?.closest) return
      const control = target.closest('a, button, input, textarea, select, label, [role="button"], [role="tab"], [role="link"]')
      if (!control || control.closest('[data-guest-ok]')) return
      event.preventDefault()
      event.stopPropagation()
      setState({ mode: 'signup' })
    }
    document.addEventListener('click', guard, true)
    return () => document.removeEventListener('click', guard, true)
  }, [session])

  return (
    <AuthUiContext.Provider value={value}>
      {children}
      <AuthModal open={state !== null} initialMode={state?.mode ?? 'signup'} reason={state?.reason} onClose={() => setState(null)} />
    </AuthUiContext.Provider>
  )
}

export const useAuthUi = () => useContext(AuthUiContext)
