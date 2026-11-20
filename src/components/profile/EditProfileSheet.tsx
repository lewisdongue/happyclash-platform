import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateProfile } from '@/api/profiles'
import { uploadMedia } from '@/api/publish'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { squareAvatar } from '@/lib/videoFile'
import type { Profile } from '@/types/domain'

const NOT_COUNTRIES = new Set(['EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ'])

/** Every ISO country the browser can name, sorted by name. */
function countryOptions(): { code: string; name: string }[] {
  const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const options: { code: string; name: string }[] = []
  for (const first of letters) {
    for (const second of letters) {
      const code = first + second
      const name = NOT_COUNTRIES.has(code) ? undefined : names.of(code)
      if (name) options.push({ code, name })
    }
  }
  return options.sort((a, b) => a.name.localeCompare(b.name))
}

export function EditProfileSheet({ profile, open, onClose }: { profile: Profile; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const countries = useMemo(countryOptions, [])
  const photoPicker = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  const [country, setCountry] = useState(profile.country ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  // Reopening starts from what is saved, not from an abandoned edit.
  useEffect(() => {
    if (!open) return
    setDisplayName(profile.displayName)
    setBio(profile.bio)
    setCountry(profile.country ?? '')
    setAvatarUrl(profile.avatarUrl)
    setProblem(null)
  }, [open, profile])

  const pickPhoto = async (file: File) => {
    setBusy('photo')
    setProblem(null)
    try {
      setAvatarUrl(await uploadMedia(await squareAvatar(file), profile.id))
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The photo could not be uploaded.')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!displayName.trim()) return setProblem('Your name cannot be empty.')
    setBusy('save')
    try {
      await updateProfile(profile.id, { displayName, bio, country: country || null, avatarUrl })
      await Promise.all(['profile', 'my-profile', 'feed', 'ranking'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
      toast('Profile saved')
      onClose()
    } catch {
      setProblem('Your profile could not be saved. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} title="Edit profile" onClose={onClose}>
      <div className="flex max-h-[72dvh] flex-col gap-5 overflow-y-auto pb-1">
        <div className="flex items-center gap-4">
          <Avatar name={displayName || profile.displayName} src={avatarUrl} size={72} ring />
          <div className="flex flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={() => photoPicker.current?.click()}
              disabled={busy !== null}
              className="pressable h-10 rounded-xl bg-fg/8 px-4 text-sm font-extrabold disabled:opacity-60"
            >
              {busy === 'photo' ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Add a photo'}
            </button>
            {avatarUrl && (
              <button type="button" onClick={() => setAvatarUrl(null)} className="text-xs font-semibold text-muted">
                Remove photo
              </button>
            )}
          </div>
          <input
            ref={photoPicker}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void pickPhoto(file)
            }}
          />
        </div>

        <label className="block">
          <span className="mb-2 flex justify-between text-[11px] font-extrabold tracking-widest text-muted uppercase">
            Name <span className="tabular">{displayName.length}/40</span>
          </span>
          <input
            value={displayName}
            maxLength={40}
            onChange={(event) => setDisplayName(event.target.value)}
            className="h-12 w-full rounded-2xl border border-line bg-fg/5 px-4 text-[15px] outline-none focus:border-world"
          />
        </label>

        <label className="block">
          <span className="mb-2 flex justify-between text-[11px] font-extrabold tracking-widest text-muted uppercase">
            Bio <span className="tabular">{bio.length}/160</span>
          </span>
          <textarea
            value={bio}
            maxLength={160}
            rows={3}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Your talent in a few words"
            className="w-full resize-none rounded-2xl border border-line bg-fg/5 px-4 py-3 text-[15px] outline-none placeholder:text-subtle focus:border-world"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] font-extrabold tracking-widest text-muted uppercase">Country</span>
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] outline-none [color-scheme:dark] focus:border-world"
          >
            <option value="">Not shown</option>
            {countries.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-muted">Your country counts in the country ranking.</span>
        </label>

        {problem && <p role="alert" className="text-sm font-semibold text-[#ff8fa3]">{problem}</p>}

        <button
          type="button"
          onClick={save}
          disabled={busy !== null}
          className="pressable h-14 w-full shrink-0 rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-base font-extrabold text-world-ink shadow-[0_14px_34px_var(--world-glow)] disabled:opacity-60"
        >
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Sheet>
  )
}
