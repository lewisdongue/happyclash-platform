import clsx from 'clsx'
import type { FeedMode } from '@/api/queries'
import { useImmersive } from '@/app/ImmersiveContext'
import { NotificationBell } from '@/components/activity/NotificationBell'
import { AccountButton } from '@/components/auth/AccountButton'
import { useNavigate } from 'react-router'

type FeedTab = FeedMode | 'live'

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'following', label: 'Following' },
  { id: 'for-you', label: 'For you' },
  { id: 'live', label: 'Live' },
]

/** Phone header floating over the feed. */
export function FeedHeader({ mode, onMode }: { mode: FeedMode; onMode: (mode: FeedMode) => void }) {
  const { immersive } = useImmersive()
  const navigate = useNavigate()

  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[calc(var(--safe-top)+16px)] transition-opacity duration-500 lg:hidden',
        immersive && 'pointer-events-none opacity-0',
      )}
    >
      <img src="/mark.png" alt="happyClash" className="size-[30px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,.6)]" />
      <div role="tablist" aria-label="Feed" className="flex gap-5">
        {TABS.map(({ id, label }) => {
          const active = mode === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (id === 'live') navigate('/live')
                else onMode(id)
              }}
              className={clsx('relative py-2 text-[15px]', active ? 'font-extrabold text-white' : 'font-semibold text-fg/55')}
            >
              {label}
              {active && <span className="absolute bottom-0 left-1/2 h-[3px] w-[18px] -translate-x-1/2 rounded-full bg-world shadow-[0_0_10px_var(--world-glow)]" />}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell overVideo />
        <AccountButton compact />
      </div>
    </header>
  )
}
