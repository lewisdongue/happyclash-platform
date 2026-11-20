import { Link } from 'react-router'
import { Model3D } from '@/components/three/Model3D'
import type { RankingRow } from '@/types/domain'

interface Step {
  height: number
  front: string
  top: string
  avatar: number
}

/** Gold, silver and bronze blocks, shown 2-1-3 like a real podium. */
const STEPS: Record<1 | 2 | 3, Step> = {
  1: { height: 126, front: 'linear-gradient(180deg,#FFE08A,#D9901F)', top: 'linear-gradient(135deg,#FFF3C4,#FFD54F)', avatar: 70 },
  2: { height: 88, front: 'linear-gradient(180deg,#D7DCEB,#7C849F)', top: 'linear-gradient(135deg,#F2F4FA,#A9B0C8)', avatar: 54 },
  3: { height: 64, front: 'linear-gradient(180deg,#E8B48C,#9A5A34)', top: 'linear-gradient(135deg,#F6D2B4,#C98A5E)', avatar: 54 },
}

export function Podium({ rows }: { rows: RankingRow[] }) {
  const [first, second, third] = rows
  return (
    <section aria-label="Top 3" className="relative flex min-h-[318px] items-end gap-2 px-6 pt-6">
      <span aria-hidden="true" className="animate-breathe absolute top-2.5 left-1/2 size-[260px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,200,80,.25),transparent)]" />
      <Block row={second} place={2} />
      <Block row={first} place={1} />
      <Block row={third} place={3} />
    </section>
  )
}

function Block({ row, place }: { row?: RankingRow; place: 1 | 2 | 3 }) {
  const step = STEPS[place]
  const isFirst = place === 1
  const avatar = (
    <span
      className="animate-float block rounded-full p-[2.5px] shadow-[0_10px_24px_rgba(0,0,0,.5)]"
      style={{ width: step.avatar, height: step.avatar, background: row ? step.top : 'rgb(255 255 255 / .08)', animationDelay: `${place * 0.4}s` }}
    >
      <span className="flex size-full items-center justify-center rounded-full bg-raised font-extrabold" style={{ fontSize: isFirst ? 17 : 14 }}>
        {row?.imageUrl ? <img src={row.imageUrl} alt="" className="size-full rounded-full object-cover" /> : (row?.initials ?? '?')}
      </span>
    </span>
  )

  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center">
      {isFirst && row && (
        <Model3D model="trophy" label="Gold trophy" spin={8} className="-mb-3 size-24 drop-shadow-[0_6px_14px_rgba(255,190,70,.55)]" />
      )}
      {row?.href ? <Link to={row.href}>{avatar}</Link> : avatar}
      <p className="mt-2 max-w-full truncate text-[13px] font-extrabold">{row?.name ?? 'Open spot'}</p>
      <p className={isFirst ? 'tabular mb-2.5 text-xs font-bold text-gold' : 'tabular mb-2.5 text-xs font-bold text-muted'}>
        {row ? `${row.points.toLocaleString('en-US')} ${row.points === 1 ? 'Spark' : 'Sparks'}` : '—'}
      </p>
      <div className="w-full" style={{ opacity: row ? 1 : 0.35 }}>
        <div className="mx-1.5 h-4 origin-bottom rounded-t-lg [transform:perspective(200px)_rotateX(55deg)]" style={{ background: step.top }} />
        <div
          className="flex justify-center rounded-[4px_4px_10px_10px] pt-3.5 font-extrabold text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_18px_34px_rgba(0,0,0,.5)]"
          style={{ height: step.height, background: step.front, fontSize: isFirst ? 38 : 28 }}
        >
          {place}
        </div>
      </div>
    </div>
  )
}
