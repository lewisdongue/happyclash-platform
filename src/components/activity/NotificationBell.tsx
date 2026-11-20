import clsx from 'clsx'
import { Link } from 'react-router'
import { useUnreadNotifications } from '@/api/queries'
import { useSession } from '@/app/session'
import { BellIcon } from '@/components/icons/UiIcons'

/** Opens Activity. The badge counts what the user has not seen yet. Hidden when signed out. */
export function NotificationBell({ className, overVideo = false }: { className?: string; overVideo?: boolean }) {
  const session = useSession()
  const { data: unread = 0 } = useUnreadNotifications(session?.user.id)
  if (!session) return null

  return (
    <Link
      to="/activity"
      aria-label={unread > 0 ? `Activity, ${unread} new` : 'Activity'}
      className={clsx(
        'pressable relative grid size-10 shrink-0 place-items-center rounded-full',
        overVideo ? 'bg-black/30 text-white backdrop-blur-md' : 'text-muted hover:text-text',
        className,
      )}
    >
      <BellIcon size={21} />
      {unread > 0 && (
        <span className="tabular absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff4d6d] px-1 text-[10.5px] font-extrabold text-white shadow-[0_0_0_2px_var(--ink)]">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
