import { useEntryCounts } from '@/app/realtime'
import { compactNumber } from '@/lib/format'
import { WORLDS } from '@/theme/worlds'
import type { Entry } from '@/types/domain'

/** Which Talent World this video belongs to, and how many times it was watched. */
export function WorldPill({ entry }: { entry: Entry }) {
  const { views } = useEntryCounts(entry, false)
  return (
    <div className="flex h-[30px] items-center gap-2 rounded-full border border-line bg-ink/45 pr-3 pl-1 text-xs font-bold backdrop-blur-md">
      <span className="flex h-[22px] items-center rounded-full bg-world px-2.5 text-[10.5px] font-extrabold tracking-wider text-world-ink uppercase">
        {WORLDS[entry.worldId].name}
      </span>
      <span className="tabular text-fg/80">
        {compactNumber(views)} {views === 1 ? 'view' : 'views'}
      </span>
    </div>
  )
}
