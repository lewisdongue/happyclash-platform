import clsx from 'clsx'
import { Link } from 'react-router'
import { WORLDS } from '@/theme/worlds'
import type { Clash } from '@/types/domain'
import { Countdown, liveStatus, useNow } from './Countdown'

const ACCESS_LABEL: Record<Clash['access'], string> = { public: 'Public', private: 'Private', group: 'Group' }

/** A Clash as a tilted card: its world's light, its best entry as cover, a live clock. */
export function ClashCard({ clash, wide = false }: { clash: Clash; wide?: boolean }) {
  const world = WORLDS[clash.worldId]
  const status = liveStatus(clash, useNow(30_000))

  return (
    <Link
      to={`/c/${clash.id}`}
      data-theme="dark"
      className={clsx(
        'pressable group relative block shrink-0 snap-start overflow-hidden rounded-[24px] border border-fg/8 [transform-style:preserve-3d] transition-transform duration-500 hover:[transform:perspective(900px)_rotateX(4deg)_rotateY(-6deg)]',
        wide ? 'h-[200px] w-full' : 'h-[230px] w-[176px]',
      )}
      style={{ background: `radial-gradient(120% 90% at 20% 0%, ${world.accent}55, transparent 60%), linear-gradient(180deg, ${world.scene}, #07080c)` }}
    >
      {clash.coverUrl && <img src={clash.coverUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-55 transition-transform duration-700 group-hover:scale-105" />}
      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,8,.15),rgba(5,6,8,.92))]" />

      <span className="absolute top-3 left-3 flex gap-1.5">
        <span
          className={clsx(
            'flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[10px] font-extrabold tracking-wider uppercase',
            status === 'open' ? 'bg-[#ff4d6d] text-white' : 'bg-black/50 text-fg/85 backdrop-blur-md',
          )}
        >
          {status === 'open' && <span className="size-1.5 animate-pulse rounded-full bg-white" />}
          {status === 'open' ? 'Open' : status === 'scheduled' ? 'Soon' : 'Ended'}
        </span>
        <span className="flex h-[22px] items-center rounded-full bg-black/50 px-2.5 text-[10px] font-extrabold tracking-wider text-fg/85 uppercase backdrop-blur-md">
          {ACCESS_LABEL[clash.access]}
        </span>
      </span>

      <span className="absolute inset-x-3.5 bottom-3.5 block">
        <span className="text-[10.5px] font-extrabold tracking-wider uppercase" style={{ color: world.accent }}>
          {world.name}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[15px] leading-tight font-extrabold">{clash.title}</span>
        {clash.group && (
          <span className="mt-1 block truncate text-[11.5px] text-fg/70">
            <span translate="no" className="notranslate">{clash.group.name}</span>
            {clash.rivalGroup && ` vs ${clash.rivalGroup.name}`}
          </span>
        )}
        <span className="mt-2 flex items-center justify-between text-[11px] font-bold text-fg/70">
          <span>
            {clash.entriesCount} {clash.entriesCount === 1 ? 'entry' : 'entries'}
          </span>
          <Countdown clash={clash} />
        </span>
      </span>
    </Link>
  )
}
