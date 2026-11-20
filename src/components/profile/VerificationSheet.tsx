import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { describeVerificationError, removeVerification, verifyWithLink } from '@/api/profiles'
import { VerifiedBadge } from '@/components/icons/UiIcons'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import type { Profile, VerifiedPlatform } from '@/types/domain'

export const PLATFORM_NAMES: Record<VerifiedPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  snapchat: 'Snapchat',
}

const EXAMPLES: { platform: VerifiedPlatform; example: string }[] = [
  { platform: 'instagram', example: 'instagram.com/yourname' },
  { platform: 'tiktok', example: 'tiktok.com/@yourname' },
  { platform: 'facebook', example: 'facebook.com/yourname' },
  { platform: 'snapchat', example: 'snapchat.com/add/yourname' },
]

/** Get the blue badge by linking one of your social accounts, or remove it. */
export function VerificationSheet({ profile, open, onClose }: { profile: Profile; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLink('')
    setError(null)
  }, [open])

  const refresh = () =>
    // The badge shows on the profile, in the feed and in rankings.
    queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'feed' })

  const verify = async (event: FormEvent) => {
    event.preventDefault()
    if (!link.trim()) {
      setError('Paste the link of your profile.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await verifyWithLink(link)
      await refresh()
      toast(`Verified with ${PLATFORM_NAMES[result.platform]}`)
      onClose()
    } catch (caught) {
      setError(describeVerificationError(caught))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await removeVerification()
      await refresh()
      toast('Verification removed')
      onClose()
    } catch {
      setError('That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title="Verification" onClose={onClose}>
      {profile.verified && profile.verifiedUrl && profile.verifiedPlatform ? (
        <div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#22c55e]/35 bg-[#22c55e]/10 p-4">
            <VerifiedBadge size={30} />
            <div className="min-w-0">
              <p className="font-extrabold text-[#16a34a]">Your account is verified</p>
              <a href={profile.verifiedUrl} target="_blank" rel="noreferrer" className="block truncate text-sm text-muted underline">
                {PLATFORM_NAMES[profile.verifiedPlatform]} · {profile.verifiedUrl.replace(/^https:\/\/www\./, '')}
              </a>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">The blue badge shows next to your name everywhere. Your linked account is shown on your profile so fans can check it.</p>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-[#ff6b81]">{error}</p>}
          <button type="button" onClick={remove} disabled={busy} className="pressable mt-5 h-12 w-full rounded-2xl bg-fg/8 text-sm font-extrabold text-[#ff6b81] disabled:opacity-50">
            {busy ? 'Removing…' : 'Remove verification'}
          </button>
        </div>
      ) : (
        <form onSubmit={verify} noValidate>
          <p className="text-sm leading-relaxed text-muted">
            Paste the link of your profile on one of these apps. You get the <span className="font-bold text-[#1D9BF0]">blue badge</span> right away, and the link shows on your profile so fans know it is really you.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {EXAMPLES.map(({ platform, example }) => (
              <li key={platform} className="min-w-0 rounded-2xl border border-line bg-fg/4 px-3 py-2.5">
                <span className="block text-sm font-extrabold">{PLATFORM_NAMES[platform]}</span>
                <span className="block truncate text-[11px] text-muted">{example}</span>
              </li>
            ))}
          </ul>
          <label htmlFor="verify-link" className="sr-only">
            Profile link
          </label>
          <input
            id="verify-link"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoComplete="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://www.instagram.com/yourname"
            className="mt-4 h-13 w-full rounded-2xl border border-line bg-fg/5 px-4 py-3.5 text-[16px] outline-none placeholder:text-subtle focus:border-world"
          />
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-[#ff6b81]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="pressable mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1D9BF0] text-base font-extrabold text-white shadow-[0_12px_30px_rgba(29,155,240,.35)] disabled:opacity-60"
          >
            {busy ? 'Checking…' : 'Verify my account'}
          </button>
          <p className="mt-3 text-center text-xs text-subtle">Only link an account that is yours. Accounts using someone else's link are removed.</p>
        </form>
      )}
    </Sheet>
  )
}
