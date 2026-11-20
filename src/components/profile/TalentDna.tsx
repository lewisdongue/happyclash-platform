import { WORLDS } from '@/theme/worlds'
import type { ProfileStats } from '@/types/domain'
import { worldShares } from './insights'

/** How a talent's videos split across the Talent Worlds. */
export function TalentDna({ stats }: { stats: ProfileStats }) {
  const shares = worldShares(stats.worlds)
  return (
    <section className="rounded-3xl border border-line bg-fg/[.035] p-5">
      <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Talent DNA</h2>
      {shares.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Appears with the first video.</p>
      ) : (
        <>
          <p className="mt-2 text-xl font-extrabold">
            Mostly <span style={{ color: WORLDS[shares[0].id].accent }}>{WORLDS[shares[0].id].name}</span>
          </p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-fg/6">
            {shares.map(({ id, share }) => (
              <span key={id} style={{ width: `${share * 100}%`, background: WORLDS[id].accent }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {shares.map(({ id, share }) => (
              <li key={id} className="flex items-center gap-1.5 text-xs font-bold text-muted">
                <span className="size-2 rounded-full" style={{ background: WORLDS[id].accent }} />
                {WORLDS[id].name} {Math.round(share * 100)}%
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
