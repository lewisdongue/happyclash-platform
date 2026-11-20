import { Link } from 'react-router'
import clsx from 'clsx'
import type { FeedMode } from '@/api/queries'

/** For you / Following switch for wide screens. */
export function FeedModeTabs({ mode, onMode, className }: { mode: FeedMode; onMode: (mode: FeedMode) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="Feed" className={clsx('grid w-[300px] grid-cols-3 gap-1 rounded-xl border border-line bg-ink/70 p-[3px] backdrop-blur-md', className)}>
      {(['for-you', 'following'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          onClick={() => onMode(value)}
          className={clsx('h-9 rounded-[10px] text-[13px] transition-colors', mode === value ? 'bg-world font-extrabold text-world-ink' : 'font-semibold text-muted hover:text-text')}
        >
          {value === 'for-you' ? 'For you' : 'Following'}
        </button>
      ))}
      <Link to="/live" role="tab" aria-selected={false} className="flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-semibold text-muted hover:text-text">
        <span className="size-2 animate-pulse rounded-full bg-[#ff5b6e]" /> Live
      </Link>
    </div>
  )
}
