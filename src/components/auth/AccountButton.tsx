import { Link } from 'react-router'
import { useMyProfile } from '@/api/queries'
import { useAuthUi } from '@/app/auth'
import { useSession } from '@/app/session'
import { Avatar } from '@/components/ui/Avatar'

/** Avatar linking to your profile when signed in, a Sign in pill otherwise. */
export function AccountButton({ compact = false }: { compact?: boolean }) {
  const session = useSession()
  const { openAuth } = useAuthUi()
  const { data: me } = useMyProfile(session?.user.id)

  if (session && me) {
    return (
      <Link to={`/u/${me.handle}`} aria-label="Your profile" className="pressable">
        <Avatar name={me.displayName} src={me.avatarUrl} size={compact ? 38 : 40} ring />
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={() => openAuth('login')}
      className={compact ? 'pressable h-[38px] rounded-xl bg-white px-3.5 text-[13px] font-extrabold text-ink' : 'pressable h-10 rounded-full bg-text px-4 text-sm font-extrabold text-ink'}
    >
      Sign in
    </button>
  )
}
