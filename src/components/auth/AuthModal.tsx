import { supabase } from '@/lib/supabase'
import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { describeAuthError, HANDLE_PATTERN, isHandleTaken, sendPasswordReset, signInWithEmail, signUpWithEmail } from '@/api/auth'
import { BackIcon, CloseIcon } from '@/components/icons/UiIcons'
import { useToast } from '@/components/ui/Toast'
import { AppleLogo, GoogleLogo, MailIcon } from './BrandIcons'

export type AuthMode = 'signup' | 'login'
type Step = 'choose' | 'email' | 'check-inbox'

interface AuthModalProps {
  open: boolean
  initialMode: AuthMode
  reason?: string
  onClose: () => void
}

/**
 * Sign up and log in. Google and Apple are shown now and connected later;
 * email and password work end to end through Supabase Auth.
 */
export function AuthModal({ open, initialMode, reason, onClose }: AuthModalProps) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [step, setStep] = useState<Step>('choose')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [handle, setHandle] = useState('')
  const [oldEnough, setOldEnough] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setStep('choose')
    setError(null)
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, initialMode, onClose])

  const oauth = async (provider: 'google' | 'apple') => {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
    })
    if (oauthError) setError(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is not available right now. Use your email instead.`)
  }
  const socialSignIn = () => oauth('google')
  const appleSignIn = () => oauth('apple')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const cleanHandle = handle.trim()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Use at least 6 characters for your password.')
      return
    }
    if (mode === 'signup' && !oldEnough) {
      setError('Confirm that you are at least 16 years old to create an account.')
      return
    }
    if (mode === 'signup' && !HANDLE_PATTERN.test(cleanHandle)) {
      setError('Usernames use 3 to 20 lowercase letters, numbers, dots or underscores.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (await isHandleTaken(cleanHandle)) {
          setError('This username is taken. Pick another one.')
          return
        }
        const result = await signUpWithEmail(email.trim(), password, cleanHandle)
        if (result === 'confirm-email') {
          setStep('check-inbox')
          return
        }
        toast(`Welcome to happyClash, @${cleanHandle}`)
      } else {
        await signInWithEmail(email.trim(), password)
        toast('Welcome back')
      }
      await queryClient.invalidateQueries()
      onClose()
    } catch (caught) {
      setError(describeAuthError(caught))
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email first, then tap "Forgot password".')
      return
    }
    try {
      await sendPasswordReset(email.trim())
      toast('Check your inbox to reset your password')
    } catch (caught) {
      setError(describeAuthError(caught))
    }
  }

  const isSignup = mode === 'signup'

  return (
    <AnimatePresence>
      {open && (
        <div data-guest-ok className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-t-[32px] border border-line bg-[radial-gradient(120%_60%_at_50%_0%,var(--world-soft),transparent_60%),var(--surface)] px-6 pt-6 pb-[calc(var(--safe-bottom)+28px)] shadow-2xl sm:rounded-[32px]"
          >
            <div className="flex items-center justify-between">
              {step === 'email' ? (
                <button type="button" onClick={() => setStep('choose')} aria-label="Back" className="pressable grid size-10 place-items-center rounded-full bg-fg/7">
                  <BackIcon size={18} />
                </button>
              ) : (
                <span className="size-10" />
              )}
              <button type="button" onClick={onClose} aria-label="Close" className="pressable grid size-10 place-items-center rounded-full bg-fg/7">
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="mt-1 flex flex-col items-center text-center">
              <span className="grid size-[72px] place-items-center rounded-[22px] border border-fg/10 bg-fg/6 shadow-[0_10px_30px_var(--world-glow)]">
                <img src="/mark.png" alt="" className="size-12 object-contain" />
              </span>
              <h2 id="auth-title" className="mt-4 text-[26px] font-extrabold tracking-tight">
                {step === 'check-inbox' ? 'Check your inbox' : isSignup ? 'Join happyClash' : 'Welcome back'}
              </h2>
              <p className="mt-1.5 max-w-[300px] text-sm leading-relaxed text-muted">
                {step === 'check-inbox'
                  ? `We sent a confirmation link to ${email}. Open it to activate your account.`
                  : reason ?? (isSignup ? 'Show your talent, answer Clashes and support the people you love watching.' : 'Log in to keep clashing.')}
              </p>
            </div>

            {step === 'choose' && (
              <div className="mt-7 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={socialSignIn}
                  className="pressable flex h-14 items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-[15px] font-extrabold text-world-ink shadow-[0_12px_30px_var(--world-glow)]"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-white">
                    <GoogleLogo />
                  </span>
                  {isSignup ? 'Sign up with Google' : 'Log in with Google'}
                </button>
                <button
                  type="button"
                  onClick={appleSignIn}
                  className="pressable flex h-14 items-center justify-center gap-3 rounded-2xl border border-fg/12 bg-fg/6 text-[15px] font-extrabold"
                >
                  <AppleLogo />
                  Continue with Apple
                </button>
                <div className="my-2 flex items-center gap-3 text-xs font-bold tracking-[.2em] text-subtle">
                  <span className="h-px flex-1 bg-fg/10" />
                  OR
                  <span className="h-px flex-1 bg-fg/10" />
                </div>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="pressable flex h-14 items-center justify-center gap-3 rounded-2xl border border-fg/12 text-[15px] font-bold text-text/90"
                >
                  <MailIcon />
                  {isSignup ? 'Sign up with email' : 'Log in with email'}
                </button>
              </div>
            )}

            {step === 'email' && (
              <form className="mt-6 flex flex-col gap-3" onSubmit={submit} noValidate>
                {isSignup && (
                  <Field label="Username" id="auth-handle">
                    <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">@</span>
                    <input
                      id="auth-handle"
                      autoComplete="username"
                      autoCapitalize="none"
                      required
                      maxLength={20}
                      value={handle}
                      onChange={(event) => setHandle(event.target.value.replace(/\s/g, ''))}
                      placeholder="yourname"
                      className={clsx(inputClass, 'pl-9')}
                    />
                  </Field>
                )}
                <Field label="Email" id="auth-email">
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </Field>
                <Field label="Password" id="auth-password">
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
                    className={inputClass}
                  />
                </Field>

                {isSignup && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-fg/4 px-4 py-3 text-[13px] leading-snug text-muted">
                    <input
                      type="checkbox"
                      checked={oldEnough}
                      onChange={(event) => setOldEnough(event.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--world-a)]"
                    />
                    <span>
                      I am at least 16 years old and I accept the{' '}
                      <a href="/legal/terms" target="_blank" rel="noreferrer" className="font-bold text-text underline">
                        Terms
                      </a>
                      .
                    </span>
                  </label>
                )}

                {error && (
                  <p role="alert" className="rounded-xl bg-[#ff6b6b]/12 px-3.5 py-2.5 text-sm font-semibold text-[#ff6b81]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="pressable mt-1 h-14 rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-base font-extrabold text-world-ink shadow-[0_12px_30px_var(--world-glow)] disabled:opacity-60"
                >
                  {busy ? 'Please wait…' : isSignup ? 'Create my account' : 'Log in'}
                </button>
                {!isSignup && (
                  <button type="button" onClick={resetPassword} className="text-sm font-semibold text-muted hover:text-text">
                    Forgot password?
                  </button>
                )}
              </form>
            )}

            {step === 'check-inbox' && (
              <button type="button" onClick={onClose} className="pressable mt-7 h-14 w-full rounded-2xl bg-text text-base font-extrabold text-ink">
                Got it
              </button>
            )}

            {step !== 'check-inbox' && (
              <p className="mt-6 text-center text-sm text-muted">
                {isSignup ? 'Already have an account?' : 'New to happyClash?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode(isSignup ? 'login' : 'signup')
                    setError(null)
                  }}
                  className="font-extrabold text-world"
                >
                  {isSignup ? 'Log in' : 'Create an account'}
                </button>
              </p>
            )}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  )
}

const inputClass =
  'h-[52px] w-full rounded-2xl border border-line bg-fg/5 px-4 text-[15px] outline-none transition-colors placeholder:text-subtle focus:border-world focus:bg-fg/7'

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold tracking-wide text-muted">
        {label}
      </label>
      <div className="relative">{children}</div>
    </div>
  )
}
