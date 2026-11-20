import { LANGUAGES, currentLanguage, setLanguage, type Language } from '@/lib/language'
import clsx from 'clsx'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { jumpToWorld } from '@/lib/worldJump'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import { WORLD_LIST } from '@/theme/worlds'
import { useFeed } from '@/api/queries'
import { NotificationBell } from '@/components/activity/NotificationBell'
import { AccountButton } from '@/components/auth/AccountButton'
import { GearIcon } from '@/components/icons/GearIcon'
import { PlusIcon } from '@/components/icons/UiIcons'
import { INACTIVE_ICON_ACCENT, NAV_ITEMS } from './navigation'

/** Desktop navigation: logo, Talent World switcher and the four sections. */
export function TopNav() {
  const { worldId, setWorld } = useWorldTheme()
  const navigate = useNavigate()
  const onHome = useLocation().pathname === '/'
  const { data } = useFeed('for-you', undefined)
  const entries = data?.pages.flat() ?? []
  // Only worlds that actually have videos appear in the switcher.
  // Fixed order: the feed is reshuffled on every load, the chips must not move.
  const present = new Set(entries.map((entry) => entry.worldId))
  const worlds = WORLD_LIST.filter((world) => present.has(world.id))

  return (
    <header className="relative z-20 hidden h-[76px] items-center justify-between gap-4 px-7 lg:flex">
      <NavLink to="/" aria-label="happyClash home" data-guest-ok className="notranslate shrink-0" translate="no">
        <img src="/logo.png" alt="happyClash" width={149} height={40} className="h-10 w-[149px] max-w-none shrink-0" />
      </NavLink>

      <div role="tablist" aria-label="Talent Worlds" className="hidden gap-1.5 xl:flex">
        {worlds.length > 1 && worlds.map((world) => {
          const active = world.id === worldId
          return (
            <button
              key={world.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (onHome) jumpToWorld(world.id)
                else navigate(`/world/${world.id}`)
                setWorld(world.id)
              }}
              className={clsx(
                'pressable h-9 rounded-full px-4 text-[13px] transition-colors',
                active ? 'bg-world font-extrabold text-world-ink' : 'border border-line font-semibold text-muted hover:text-text',
              )}
            >
              {world.name}
            </button>
          )
        })}
      </div>

      <nav aria-label="Main" translate="no" className="notranslate flex items-center gap-1">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            data-guest-ok={to === '/' || to === '/life' ? true : undefined}
            className={({ isActive }) =>
              clsx('pressable flex h-11 items-center gap-2 rounded-2xl pr-3.5 pl-2 text-sm', isActive ? 'bg-fg/8 font-extrabold' : 'font-semibold text-muted hover:text-text')
            }
          >
            {({ isActive }) => (
              <>
                <span className={clsx('flex', isActive ? 'animate-float drop-shadow-[0_4px_8px_var(--world-glow)]' : 'opacity-60 grayscale-[.6]')}>
                  <Icon size={isActive ? 28 : 24} accent={isActive ? 'var(--world-a)' : INACTIVE_ICON_ACCENT} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
        <span className="w-3" />
        <NavLink
          to="/create"
          className="pressable mr-2 flex h-11 items-center gap-2 rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] px-4 text-sm font-extrabold text-world-ink shadow-[0_10px_24px_var(--world-glow)]"
        >
          <PlusIcon size={18} /> Post
        </NavLink>
        <select
          aria-label="Language"
          data-guest-ok
          defaultValue={currentLanguage()}
          onChange={(event) => setLanguage(event.target.value as Language)}
          translate="no"
          className="notranslate mr-1 h-10 rounded-xl bg-transparent px-2 text-sm font-bold text-muted hover:text-text"
        >
          {LANGUAGES.map((language) => (
            <option key={language.id} value={language.id} className="bg-[#111]">
              {language.id.toUpperCase()}
            </option>
          ))}
        </select>
        <NotificationBell className="mr-1" />
        <NavLink to="/settings" aria-label="Settings" className="pressable mr-2 grid size-10 place-items-center rounded-full text-muted hover:text-text">
          <GearIcon size={20} />
        </NavLink>
        <AccountButton />
      </nav>
    </header>
  )
}
