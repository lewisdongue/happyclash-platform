import clsx from 'clsx'
import { VideoPlayer } from '@/components/feed/VideoPlayer'
import type { Entry } from '@/types/domain'

interface DuelCardProps {
  entry: Entry
  label: string
  /** The side currently playing. Only one side plays at a time. */
  active: boolean
  revealed: boolean
  /** Called when this side's video finishes, so the other side can take its turn. */
  onEnded?: () => void
  /** Tapping the waiting side gives it the turn. */
  onSelect?: () => void
}

/** One side of a blind duel. The name stays hidden until the viewer has voted. */
export function DuelCard({ entry, label, active, revealed, onEnded, onSelect }: DuelCardProps) {
  return (
    <div
      className={clsx(
        'absolute inset-0 overflow-hidden rounded-[28px] border shadow-[0_30px_70px_rgba(0,0,0,.6)] transition-[border-color,box-shadow] duration-500 [backface-visibility:hidden]',
        active ? 'border-world/70 shadow-[0_30px_70px_rgba(0,0,0,.6),0_0_0_3px_var(--world-glow)]' : 'border-fg/10',
      )}
    >
      <VideoPlayer entry={entry} active={active} loop={false} onEnded={onEnded} />
      {!active && onSelect && (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Play ${label}`}
          className="absolute inset-0 grid place-items-center bg-black/35 transition-colors hover:bg-black/20"
        >
          <span className="grid size-16 place-items-center rounded-full bg-black/45 backdrop-blur-md">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="#fff" />
            </svg>
          </span>
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
        <p className="text-lg font-extrabold">{revealed ? entry.author.displayName : label}</p>
        <p className="text-xs text-fg/70">{revealed ? `@${entry.author.handle}` : 'Name revealed after you vote'}</p>
      </div>
    </div>
  )
}
