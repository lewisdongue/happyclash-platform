import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { canAct, fetchAdminEntries, requestApproval, setEntryHidden, type AdminEntry, type AdminRole } from '@/api/admin'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { compactNumber, timeAgo } from '@/lib/format'
import { WORLDS } from '@/theme/worlds'
import type { WorldId } from '@/types/domain'
import { ActionButton, Empty, Panel, Pill, ReasonSheet, Rows, useAdminAction } from './shared'

type Filter = 'reported' | 'hidden' | 'recent'

/** Videos to review: the most reported first, then hidden ones, then everything new. */
export function ContentSection({ role }: { role: AdminRole }) {
  const [filter, setFilter] = useState<Filter>('reported')
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['admin', 'entries', filter], queryFn: () => fetchAdminEntries(filter) })
  const { run, busy, patch } = useAdminAction()
  const [deleting, setDeleting] = useState<AdminEntry | null>(null)

  return (
    <Panel
      title="Videos"
      aside={
        <SegmentedTabs
          label="Video filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'reported', label: 'Reported' },
            { value: 'hidden', label: 'Hidden' },
            { value: 'recent', label: 'New' },
          ]}
        />
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Empty>{filter === 'reported' ? 'No reported video.' : filter === 'hidden' ? 'No hidden video.' : 'No video yet.'}</Empty>
      ) : (
        <Rows>
          {data.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
              <Link
                to={`/?v=${entry.id}`}
                target="_blank"
                data-theme="dark"
                className="h-16 w-11 shrink-0 overflow-hidden rounded-lg"
                style={{ background: WORLDS[entry.world_id as WorldId]?.scene ?? '#111' }}
              >
                {entry.poster_url && <img src={entry.poster_url} alt="" loading="lazy" className="size-full object-cover" />}
              </Link>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{entry.caption || 'Video'}</span>
                <span className="block truncate text-xs text-muted">
                  @{entry.author_handle} · {timeAgo(entry.created_at)} · {compactNumber(entry.views_count)} views
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {entry.reports_count > 0 && <Pill tone="danger">{entry.reports_count} reports</Pill>}
                  {entry.hidden_at && <Pill tone="warn">Hidden</Pill>}
                </span>
              </span>
              <span className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                <ActionButton
                  tone={entry.hidden_at ? 'neutral' : 'danger'}
                  disabled={busy === entry.id}
                  onClick={() =>
                    run(entry.id, () => setEntryHidden(entry.id, !entry.hidden_at), entry.hidden_at ? 'Video visible again' : 'Video hidden', () =>
                      patch<AdminEntry>(['admin', 'entries'], (rows) =>
                        rows.map((row) => (row.id === entry.id ? { ...row, hidden_at: row.hidden_at ? null : new Date().toISOString() } : row)),
                      ),
                    )
                  }
                >
                  {entry.hidden_at ? 'Unhide' : 'Hide'}
                </ActionButton>
                {canAct(role, 'admin') && (
                  <ActionButton tone="danger" onClick={() => setDeleting(entry)}>
                    Delete
                  </ActionButton>
                )}
              </span>
            </li>
          ))}
        </Rows>
      )}

      <ReasonSheet
        open={deleting !== null}
        title="Delete this video?"
        description="Deleting is permanent, so a second admin must approve it. Until then you can hide the video."
        confirm="Ask for approval"
        onClose={() => setDeleting(null)}
        onConfirm={(reason) => run('delete', () => requestApproval('delete_entry', deleting!.id, reason), 'Sent to another admin for approval')}
      />
    </Panel>
  )
}
