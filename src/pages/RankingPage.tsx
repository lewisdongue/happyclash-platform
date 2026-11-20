import { useState } from 'react'
import { Link } from 'react-router'
import { useRanking } from '@/api/queries'
import type { RankingBoard, RankingPeriod } from '@/api/rankings'
import { SparkIcon } from '@/components/icons/ActionIcons'
import { Podium } from '@/components/ranking/Podium'
import { PageHeader } from '@/components/layout/PageHeader'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { EmptyState, LoadingState } from '@/components/ui/States'

const EMPTY_COPY: Record<RankingBoard, string> = {
  talents: 'Sparks decide the ranking. Spark the videos you love to move talents up.',
  groups: 'No public group yet. Create one and climb with your crew.',
  countries: 'Countries rank by the Sparks their talents collect. Set your country in your profile.',
}

export function RankingPage() {
  const [board, setBoard] = useState<RankingBoard>('talents')
  const [period, setPeriod] = useState<RankingPeriod>('week')
  const { data: rows = [], isLoading } = useRanking(board, period)

  return (
    <div className="mx-auto min-h-dvh max-w-6xl bg-[radial-gradient(80%_45%_at_50%_25%,var(--world-soft),transparent_60%)] pb-36 lg:px-8 lg:pb-12">
      <PageHeader
        title="Ranking"
        actions={
          <SegmentedTabs
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      />
      <div className="px-4 pt-2 lg:px-0">
        <SegmentedTabs
          variant="underline"
          label="Ranking type"
          value={board}
          onChange={setBoard}
          options={[
            { value: 'talents', label: 'Talents' },
            { value: 'groups', label: 'Groups' },
            { value: 'countries', label: 'Countries' },
          ]}
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Nothing ranked yet">{EMPTY_COPY[board]}</EmptyState>
          {board === 'groups' && (
            <div className="mt-4 flex justify-center">
              <Link to="/groups" className="pressable grid h-12 place-items-center rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] px-6 text-sm font-extrabold text-world-ink shadow-[0_12px_30px_var(--world-glow)]">
                Create a group
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          <div className="mt-5 lg:mt-10">
            <Podium key={`${board}-${period}`} rows={rows.slice(0, 3)} />
          </div>
          <div className="lg:mt-10">
            {rows.length <= 3 && <p className="mx-4 mt-6 text-sm text-muted lg:mx-0">{EMPTY_COPY[board]}</p>}
            <ol className="mx-4 mt-1 lg:mx-0">
              {rows.slice(3).map((row) => {
                const content = (
                  <>
                    <span className="w-5 text-center font-extrabold text-subtle">{row.rank}</span>
                    {row.imageUrl ? (
                      <img src={row.imageUrl} alt="" className="size-9 rounded-full border border-fg/10 object-cover" />
                    ) : (
                      <span className="grid size-9 place-items-center rounded-full border border-fg/10 bg-raised text-xs font-extrabold">{row.initials}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span translate="no" className="notranslate block truncate text-sm font-bold">{row.name}</span>
                      <span className="block text-xs text-muted">{row.detail}</span>
                    </span>
                    <span className="tabular flex items-center gap-1 text-sm font-extrabold">
                      <SparkIcon size={13} /> {row.points.toLocaleString('en-US')}
                    </span>
                  </>
                )
                return (
                  <li key={row.id} className="border-b border-fg/6">
                    {row.href ? (
                      <Link to={row.href} className="flex h-14 items-center gap-3">{content}</Link>
                    ) : (
                      <div className="flex h-14 items-center gap-3">{content}</div>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
