import { useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useAuthUi } from './auth'
import { useSession } from './session'

/**
 * Wraps an action that needs an account. Signed out, it opens the
 * sign-up sheet and says why, instead of failing silently.
 */
export function useRequireSession() {
  const session = useSession()
  const { openAuth } = useAuthUi()
  return useCallback(
    (action: string, run: (session: Session) => void) => {
      if (session) run(session)
      else openAuth('signup', `Create your account to ${action}.`)
    },
    [session, openAuth],
  )
}
