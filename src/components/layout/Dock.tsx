import clsx from 'clsx'
import { Link, NavLink } from 'react-router'
import { PlusIcon } from '@/components/icons/UiIcons'
import { useImmersive } from '@/app/ImmersiveContext'
import { INACTIVE_ICON_ACCENT, NAV_ITEMS, type NavItem } from './navigation'

const CREATE: NavItem = { to: '/create', label: 'Post', Icon: () => null }

/**
 * Floating glass tab bar for phones. The active tab floats and glows in the
 * world color; the raised center button opens the camera to post.
 */
export function Dock() {
  const { immersive } = useImmersive()

  return (
    <nav
      aria-label="Main"
      translate="no"
      className={clsx(
        'notranslate',
        'glass fixed inset-x-5 bottom-[calc(var(--safe-bottom)+16px)] z-40 grid h-[var(--dock-h)] grid-cols-5 items-center rounded-3xl px-1 shadow-[0_20px_50px_rgba(0,0,0,.55)] transition-all duration-500 lg:hidden',
        immersive && 'pointer-events-none translate-y-6 opacity-0',
      )}
    >
      {NAV_ITEMS.flatMap((item, index) => (index === 2 ? [CREATE, item] : [item])).map(({ to, label, Icon }) =>
        to === CREATE.to ? (
          <Link key={to} to={to} aria-label="Post a video" className="pressable flex h-full items-center justify-center">
            <span className="grid h-11 w-14 place-items-center rounded-2xl bg-[linear-gradient(160deg,var(--world-a),var(--world-b))] text-world-ink shadow-[0_10px_24px_var(--world-glow),inset_0_1px_0_rgba(255,255,255,.55),inset_0_-4px_10px_rgba(0,0,0,.18)]">
              <PlusIcon size={24} />
            </span>
          </Link>
        ) : (
        <NavLink key={to} to={to} end={to === '/'} data-guest-ok={to === '/' || to === '/life' ? true : undefined} className="pressable relative flex h-full flex-col items-center justify-center gap-1">
          {({ isActive }) => (
            <>
              {isActive && <span className="animate-breathe absolute top-1 h-9 w-12 rounded-full bg-[radial-gradient(closest-side,var(--world-glow),transparent)]" />}
              <span
                className={clsx('relative flex transition-all', isActive ? 'animate-float drop-shadow-[0_6px_10px_var(--world-glow)]' : 'opacity-55 grayscale-[.6]')}
              >
                <Icon size={isActive ? 32 : 24} accent={isActive ? 'var(--world-a)' : INACTIVE_ICON_ACCENT} />
              </span>
              <span className={clsx('relative text-[10.5px]', isActive ? 'font-extrabold text-text' : 'font-semibold text-muted')}>{label}</span>
            </>
          )}
        </NavLink>
        ),
      )}
    </nav>
  )
}
