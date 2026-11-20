import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { canAct, endClash, fetchAdminClashes, fetchAdminGroups, requestApproval, type AdminClash, type AdminGroup, type AdminRole } from '@/api/admin'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { timeAgo } from '@/lib/format'
import { WORLDS } from '@/theme/worlds'
import type { WorldId } from '@/types/domain'
import { ActionButton, dateTime, Empty, Panel, Pill, ReasonSheet, Rows, useAdminAction } from './shared'

const STATUS_TONE = { scheduled: 'info', open: 'good', ended: 'neutral' } as const

const worldName = (id: string) => WORLDS[id as WorldId]?.name ?? id

/** Every Clash and group, private ones included. Admins can start platform Clashes too. */
export function ClashesGroupsSection({ role }: { role: AdminRole }) {
  const navigate = useNavigate()
  const clashes = useQuery({ queryKey: ['admin', 'clashes'], queryFn: fetchAdminClashes })
  const groups = useQuery({ queryKey: ['admin', 'groups'], queryFn: fetchAdminGroups })
  const { run, busy, patch } = useAdminAction()
  const [deleting, setDeleting] = useState<AdminGroup | null>(null)
  const isAdmin = canAct(role, 'admin')

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Clashes"
        aside={
          <ActionButton tone="primary" onClick={() => navigate('/clash/new')}>
            New platform Clash
          </ActionButton>
        }
      >
        {clashes.isLoading ? (
          <LoadingState />
        ) : clashes.isError ? (
          <ErrorState onRetry={() => void clashes.refetch()} />
        ) : (clashes.data ?? []).length === 0 ? (
          <Empty>No Clash yet.</Empty>
        ) : (
          <Rows>
            {clashes.data!.map((clash) => (
              <li key={clash.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <Link to={`/c/${clash.id}`} target="_blank" className="block truncate text-sm font-extrabold hover:underline">
                    {clash.title}
                  </Link>
                  <span className="block truncate text-xs text-muted">
                    @{clash.creator_handle} · {worldName(clash.world_id)} · {clash.access} · {clash.entries} entries
                  </span>
                  <span className="block text-xs text-subtle">
                    {dateTime(clash.starts_at)} → {dateTime(clash.ends_at)}
                  </span>
                </span>
                <Pill tone={STATUS_TONE[clash.status]}>{clash.status}</Pill>
                {isAdmin && clash.status !== 'ended' && (
                  <ActionButton tone="danger" disabled={busy === clash.id} onClick={() => run(clash.id, () => endClash(clash.id), 'Clash ended', () =>
                    patch<AdminClash>(['admin', 'clashes'], (rows) => rows.map((row) => (row.id === clash.id ? { ...row, status: 'ended' } : row))),
                  )}>
                    End now
                  </ActionButton>
                )}
              </li>
            ))}
          </Rows>
        )}
      </Panel>

      <Panel title="Groups">
        {groups.isLoading ? (
          <LoadingState />
        ) : groups.isError ? (
          <ErrorState onRetry={() => void groups.refetch()} />
        ) : (groups.data ?? []).length === 0 ? (
          <Empty>No group yet.</Empty>
        ) : (
          <Rows>
            {groups.data!.map((group) => (
              <li key={group.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <Link to={`/g/${group.id}`} target="_blank" className="block truncate text-sm font-extrabold hover:underline">
                    <span translate="no" className="notranslate">{group.name}</span>
                  </Link>
                  <span className="block truncate text-xs text-muted">
                    @{group.owner_handle} · {worldName(group.world_id)} · {group.members} members · {group.visibility} · {timeAgo(group.created_at)}
                  </span>
                </span>
                {isAdmin && (
                  <ActionButton tone="danger" onClick={() => setDeleting(group)}>
                    Delete
                  </ActionButton>
                )}
              </li>
            ))}
          </Rows>
        )}
      </Panel>

      <ReasonSheet
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'this group'}?`}
        description="The group and its memberships are removed for good. A second admin must approve."
        confirm="Ask for approval"
        onClose={() => setDeleting(null)}
        onConfirm={(reason) => run('delete-group', () => requestApproval('delete_group', deleting!.id, reason), 'Sent to another admin for approval')}
      />
    </div>
  )
}
