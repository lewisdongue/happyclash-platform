import { supabase } from '@/lib/supabase'

export const HANDLE_PATTERN = /^[a-zA-Z0-9._]{3,20}$/

export async function isHandleTaken(handle: string): Promise<boolean> {
  const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).ilike('handle', handle)
  if (error) throw error
  return (count ?? 0) > 0
}

/** Creates an account. Returns whether the user is signed in right away or must confirm by email first. */
export async function signUpWithEmail(email: string, password: string, handle: string): Promise<'signed-in' | 'confirm-email'> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { handle, display_name: handle },
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) throw error
  return data.session ? 'signed-in' : 'confirm-email'
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** Turns Supabase auth errors into short, human messages. */
export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.'
  if (/already registered/i.test(message)) return 'An account already exists with this email. Log in instead.'
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. Check your inbox.'
  if (/password should be at least/i.test(message)) return 'Use at least 6 characters for your password.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a minute and try again.'
  if (/database error saving new user/i.test(message)) return 'This username is taken. Pick another one.'
  return message
}
