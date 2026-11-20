import { LANGUAGES, currentLanguage, setLanguage, type Language } from '@/lib/language'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { signOut } from '@/api/auth'
import { fetchMyClashes } from '@/api/clashes'
import { deleteMyAccount, fetchProfileByHandle } from '@/api/profiles'
import { useMyProfile } from '@/api/queries'
import { useAppearance } from '@/app/appearance'
import { useAuthUi } from '@/app/auth'
import { fetchMyAdminRole } from '@/api/admin'
import { useSession } from '@/app/session'
import { useSound } from '@/app/sound'
import { ClashCard } from '@/components/clash/ClashCard'
import { liveStatus, useNow } from '@/components/clash/Countdown'
import { ChevronIcon } from '@/components/icons/UiIcons'
import { PageHeader } from '@/components/layout/PageHeader'
import { EditProfileSheet } from '@/components/profile/EditProfileSheet'
import { PLATFORM_NAMES, VerificationSheet } from '@/components/profile/VerificationSheet'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { BUSINESS_EMAIL, LEGAL_DOCUMENTS, SUPPORT_EMAIL } from '@/content/legal'

/** Everything behind the gear: account, your Clashes, preferences, help and legal. */
export function SettingsPage() {
  const session = useSession()
  const { openAuth } = useAuthUi()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { wantsSound, toggle } = useSound()
  const { appearance, setAppearance } = useAppearance()
  const { data: adminRole } = useQuery({ queryKey: ['admin-role', session?.user.id], queryFn: fetchMyAdminRole, enabled: Boolean(session) })
  const { data: me } = useMyProfile(session?.user.id)
  const { data: profile } = useQuery({ queryKey: ['profile', me?.handle.toLowerCase()], queryFn: () => fetchProfileByHandle(me!.handle), enabled: Boolean(me) })
  const [editing, setEditing] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [clashesOpen, setClashesOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const logOut = async () => {
    await signOut()
    await queryClient.invalidateQueries()
    toast('Signed out')
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-36 lg:pb-12">
      <PageHeader back title="Settings" />

      <div className="flex flex-col gap-6 px-4 pt-2">
        {adminRole && (
          <Link
            to="/admin"
            className="pressable flex items-center gap-3 rounded-[22px] bg-[linear-gradient(135deg,#ff5b6e,#6a5ba8)] px-5 py-4 text-white shadow-[0_14px_34px_rgba(106,91,168,.45)]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/20 text-xl">🛡️</span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-extrabold">Admin Console</span>
              <span className="block truncate text-sm text-white/80">Reports, videos, talents, Clashes · {adminRole}</span>
            </span>
            <ChevronIcon size={18} className="shrink-0" />
          </Link>
        )}
        {session && me ? (
          <Link to={`/u/${me.handle}`} className="pressable flex items-center gap-4 rounded-[26px] border border-line bg-[radial-gradient(120%_120%_at_0%_0%,var(--world-soft),transparent_60%)] p-4">
            <Avatar name={me.displayName} src={me.avatarUrl} size={56} ring />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-extrabold"><span translate="no" className="notranslate">{me.displayName}</span></span>
              <span className="block truncate text-sm text-muted"><span translate="no" className="notranslate">@{me.handle}</span></span>
            </span>
            <ChevronIcon size={18} className="shrink-0 text-muted" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openAuth('signup', 'Create your account to show your talent.')}
            className="pressable h-14 rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-base font-extrabold text-world-ink shadow-[0_14px_34px_var(--world-glow)]"
          >
            Sign up or log in
          </button>
        )}

        {session && (
          <Group title="Account">
            <Row label="Edit profile" hint="Name, photo, bio, country" onClick={() => setEditing(true)} disabled={!profile} />
            <Row
              label="Verification"
              hint={profile?.verified && profile.verifiedPlatform ? `Verified with ${PLATFORM_NAMES[profile.verifiedPlatform]}` : 'Get the blue badge with your social account'}
              onClick={() => setVerifying(true)}
              disabled={!profile}
              trailing={
                profile?.verified ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#22c55e]/15 px-2.5 py-1 text-xs font-extrabold text-[#16a34a]">
                    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Verified
                  </span>
                ) : undefined
              }
            />
            <Row label="My Clashes" hint="Ongoing and previous Clashes you started" onClick={() => setClashesOpen(true)} />
            <Row label="Activity" hint="Follows, Sparks, comments and Clash invites" to="/activity" />
          </Group>
        )}

        <Group title="Preferences">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 text-[15px] font-bold">Language</span>
            <LanguageSelect />
          </div>
          <Row label="Video sound" hint={wantsSound ? 'Videos play with sound' : 'Videos start muted'} onClick={toggle} trailing={<Switch on={wantsSound} />} />
          <Row
            label="Light mode"
            hint={appearance === 'light' ? 'Pages are light, videos stay dark' : 'Dark, the happyClash look'}
            onClick={() => setAppearance(appearance === 'light' ? 'dark' : 'light')}
            trailing={<Switch on={appearance === 'light'} />}
          />
        </Group>

        <Group title="Safety">
          <Row label="Safety Center" hint="Your reports, blocked talents, how we protect you" to="/safety" />
          {adminRole && <Row label="Admin Console" hint={`Moderation and platform tools · ${adminRole}`} to="/admin" />}
        </Group>

        <Group title="Help">
          <Row label="Contact us" hint={SUPPORT_EMAIL} href={`mailto:${SUPPORT_EMAIL}`} />
          <Row label="Business and partnerships" hint={BUSINESS_EMAIL} href={`mailto:${BUSINESS_EMAIL}`} />
          <Row label="Report a problem" hint="Tell us what went wrong" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Problem on happyClash')}`} />
        </Group>

        <Group title="Legal">
          {LEGAL_DOCUMENTS.map((doc) => (
            <Row key={doc.id} label={doc.title} hint={doc.summary} to={`/legal/${doc.id}`} />
          ))}
          <Row label="3D credits" hint="Models by Sketchfab artists" to="/credits" />
        </Group>

        {session && (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={logOut} className="pressable h-13 rounded-2xl border border-fg/12 bg-fg/6 py-3.5 text-[15px] font-extrabold">
              Log out
            </button>
            <button type="button" onClick={() => setDeleting(true)} className="h-12 text-sm font-bold text-[#ff8fa3]">
              Delete account
            </button>
          </div>
        )}

        <p className="pb-4 text-center text-xs text-subtle">happyClash · the talent arena</p>
      </div>

      {profile && <EditProfileSheet profile={profile} open={editing} onClose={() => setEditing(false)} />}
      {profile && <VerificationSheet profile={profile} open={verifying} onClose={() => setVerifying(false)} />}
      {session && <MyClashesSheet userId={session.user.id} open={clashesOpen} onClose={() => setClashesOpen(false)} />}
      {session && <DeleteAccountSheet userId={session.user.id} open={deleting} onClose={() => setDeleting(false)} />}
    </div>
  )
}

function LanguageSelect() {
  return (
    <select
      aria-label="Language"
      defaultValue={currentLanguage()}
      onChange={(event) => setLanguage(event.target.value as Language)}
      className="notranslate h-10 rounded-xl border border-line bg-fg/5 px-3 text-sm font-bold"
      translate="no"
    >
      {LANGUAGES.map((language) => (
        <option key={language.id} value={language.id}>
          {language.name}
        </option>
      ))}
    </select>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-extrabold tracking-widest text-muted uppercase">{title}</h2>
      <div className="divide-y divide-fg/6 overflow-hidden rounded-[22px] border border-line bg-fg/[.035]">{children}</div>
    </section>
  )
}

interface RowProps {
  label: string
  hint?: string
  to?: string
  href?: string
  onClick?: () => void
  trailing?: ReactNode
  disabled?: boolean
}

function Row({ label, hint, to, href, onClick, trailing, disabled }: RowProps) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{label}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
      {trailing ?? <ChevronIcon size={16} className="shrink-0 text-muted" />}
    </>
  )
  const className = 'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-fg/5 disabled:opacity-50'
  if (to) return <Link to={to} className={className}>{content}</Link>
  if (href) return <a href={href} className={className}>{content}</a>
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  )
}

function Switch({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-world' : 'bg-fg/15')}>
      <span className={clsx('absolute top-1 size-5 rounded-full bg-white shadow transition-[left]', on ? 'left-6' : 'left-1')} />
    </span>
  )
}

function MyClashesSheet({ userId, open, onClose }: { userId: string; open: boolean; onClose: () => void }) {
  const now = useNow(30_000)
  const { data: clashes = [], isLoading } = useQuery({ queryKey: ['my-clashes', userId], queryFn: () => fetchMyClashes(userId), enabled: open })
  const ongoing = clashes.filter((clash) => liveStatus(clash, now) !== 'ended')
  const previous = clashes.filter((clash) => liveStatus(clash, now) === 'ended')

  return (
    <Sheet open={open} title="My Clashes" onClose={onClose}>
      <div className="no-scrollbar max-h-[65dvh] overflow-y-auto" onClick={(event) => (event.target as HTMLElement).closest('a') && onClose()}>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        ) : (
          <>
            <h3 className="mb-2 text-sm font-extrabold">Ongoing</h3>
            {ongoing.length === 0 ? <p className="mb-5 text-sm text-muted">No ongoing Clash right now.</p> : <ClashRow clashes={ongoing} />}
            <h3 className="mt-2 mb-2 text-sm font-extrabold">Previous</h3>
            {previous.length === 0 ? <p className="text-sm text-muted">No previous Clash yet.</p> : <ClashRow clashes={previous} />}
          </>
        )}
      </div>
    </Sheet>
  )
}

function ClashRow({ clashes }: { clashes: Parameters<typeof ClashCard>[0]['clash'][] }) {
  return (
    <div className="no-scrollbar mb-5 flex gap-3 overflow-x-auto pb-1">
      {clashes.map((clash) => (
        <ClashCard key={clash.id} clash={clash} />
      ))}
    </div>
  )
}

function DeleteAccountSheet({ userId, open, onClose }: { userId: string; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const confirmed = typed.trim().toUpperCase() === 'DELETE'

  const remove = async () => {
    setBusy(true)
    try {
      await deleteMyAccount(userId)
      queryClient.clear()
      toast('Your account was deleted')
      navigate('/', { replace: true })
    } catch {
      toast('Your account could not be deleted. Try again or contact support.')
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title="Delete your account?" onClose={onClose}>
      <p className="text-sm leading-relaxed text-muted">
        Your profile, videos, Clashes, groups you own, comments and Sparks are deleted for good. This cannot be undone.
      </p>
      <label className="mt-5 block">
        <span className="mb-2 block text-[11px] font-extrabold tracking-widest text-muted uppercase">Type DELETE to confirm</span>
        <input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoCapitalize="characters"
          className="h-12 w-full rounded-2xl border border-line bg-fg/5 px-4 text-[16px] outline-none focus:border-[#ff4d6d]"
        />
      </label>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} className="pressable h-12 rounded-2xl bg-fg/8 text-sm font-extrabold">
          Keep my account
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={!confirmed || busy}
          className="pressable h-12 rounded-2xl bg-[#ff4d6d] text-sm font-extrabold text-white disabled:opacity-40"
        >
          {busy ? 'Deleting…' : 'Delete forever'}
        </button>
      </div>
    </Sheet>
  )
}
