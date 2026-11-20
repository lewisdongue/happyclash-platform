import clsx from 'clsx'
import { heatmapDays } from './insights'

/** Twelve weeks of posting activity, one cell per day. */
export function ActivityHeatmap({ activeDays }: { activeDays: string[] }) {
  const active = new Set(activeDays)
  const days = heatmapDays(12)

  return (
    <section className="rounded-3xl border border-line bg-fg/[.035] p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Last 12 weeks</h2>
        <span className="text-xs text-muted">
          {active.size} active {active.size === 1 ? 'day' : 'days'}
        </span>
      </div>
      <div className="mt-4 grid grid-flow-col grid-rows-7 gap-[5px]" role="img" aria-label={`${active.size} ${active.size === 1 ? 'day' : 'days'} with a new video in the last 12 weeks`}>
        {days.map((day) => (
          <span
            key={day}
            title={day}
            className={clsx('aspect-square rounded-[4px]', active.has(day) ? 'bg-world shadow-[0_0_8px_var(--world-glow)]' : 'bg-fg/6')}
          />
        ))}
      </div>
    </section>
  )
}
