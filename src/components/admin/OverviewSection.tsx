import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { fetchAdminOverview, type AdminOverview } from '@/api/admin'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { compactNumber } from '@/lib/format'
import { AdminIcon, type AdminIconName } from './icons'

interface Tile {
  key: keyof AdminOverview
  label: string
  icon: AdminIconName
  color: string
  sub?: keyof AdminOverview
  subLabel?: string
}

const TILES: Tile[] = [
  { key: 'talents', label: 'Talents', icon: 'talents', color: '#8b7cf6', sub: 'talents_today', subLabel: 'new today' },
  { key: 'videos', label: 'Videos', icon: 'videos', color: '#f59e0b', sub: 'videos_today', subLabel: 'posted today' },
  { key: 'views_today', label: 'Views today', icon: 'eye', color: '#1D9BF0' },
  { key: 'sparks_today', label: 'Sparks today', icon: 'spark', color: '#eab308' },
  { key: 'comments_today', label: 'Comments today', icon: 'comment', color: '#14b8a6' },
  { key: 'clashes_open', label: 'Clashes open', icon: 'clashes', color: '#ec4899', sub: 'clashes_scheduled', subLabel: 'scheduled' },
  { key: 'groups', label: 'Groups', icon: 'group', color: '#22c55e' },
  { key: 'verified', label: 'Verified', icon: 'badge', color: '#1D9BF0' },
  { key: 'hidden_videos', label: 'Hidden videos', icon: 'hidden', color: '#94a3b8' },
  { key: 'suspended', label: 'Suspended', icon: 'ban', color: '#ef4444' },
]

/** Platform health at a glance, live. What needs a decision sits on top. */
export function OverviewSection({ onOpen }: { onOpen: (tab: 'reports' | 'approvals') => void }) {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin', 'overview'], queryFn: fetchAdminOverview, refetchInterval: 60_000 })
  if (isLoading) return <LoadingState />
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />

  const calm = data.reports_open === 0 && data.approvals_pending === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Attention
          icon="reports"
          value={data.reports_open}
          label={data.reports_open === 1 ? 'open report' : 'open reports'}
          detail={data.reports_child_safety > 0 ? `${data.reports_child_safety} about child safety` : 'Child safety cases go first'}
          urgent={data.reports_child_safety > 0}
          onClick={() => onOpen('reports')}
        />
        <Attention
          icon="approvals"
          value={data.approvals_pending}
          label={data.approvals_pending === 1 ? 'action to approve' : 'actions to approve'}
          detail="Suspensions and deletions need a second admin"
          onClick={() => onOpen('approvals')}
        />
      </div>
      {calm && <p className="px-1 text-sm text-muted">All clear: nothing waits for a decision.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TILES.map((tile) => (
          <div key={tile.key} className="relative overflow-hidden rounded-[22px] border border-line bg-fg/[.035] p-4">
            <span aria-hidden="true" className="absolute -top-10 -right-10 size-24 rounded-full opacity-20 blur-2xl" style={{ background: tile.color }} />
            <span className="relative grid size-9 place-items-center rounded-xl" style={{ background: `${tile.color}22`, color: tile.color }}>
              <AdminIcon name={tile.icon} />
            </span>
            <span className="tabular relative mt-3 block text-[26px] leading-none font-extrabold">{compactNumber(data[tile.key])}</span>
            <span className="relative mt-1 block text-[13px] font-bold">{tile.label}</span>
            {tile.sub && (
              <span className="relative mt-0.5 block text-xs text-muted">
                {data[tile.sub]} {tile.subLabel}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Attention({
  icon,
  value,
  label,
  detail,
  urgent = false,
  onClick,
}: {
  icon: AdminIconName
  value: number
  label: string
  detail: string
  urgent?: boolean
  onClick: () => void
}) {
  const active = value > 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'pressable flex items-center gap-4 rounded-[24px] border p-4 text-left transition-colors',
        active ? 'border-[#ff4d6d]/40 bg-[linear-gradient(135deg,rgba(255,77,109,.14),rgba(255,77,109,.04))]' : 'border-line bg-fg/[.035]',
      )}
    >
      <span className={clsx('relative grid size-12 shrink-0 place-items-center rounded-2xl', active ? 'bg-[#ff4d6d] text-white' : 'bg-fg/8 text-muted')}>
        {urgent && <span aria-hidden="true" className="animate-ping-ring absolute inset-0 rounded-2xl border-2 border-[#ff4d6d]" />}
        <AdminIcon name={icon} size={22} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-extrabold">
          <span className="tabular">{value}</span> {label}
        </span>
        <span className={clsx('block truncate text-xs', urgent ? 'font-extrabold text-[#e5484d]' : 'text-muted')}>{detail}</span>
      </span>
    </button>
  )
}
