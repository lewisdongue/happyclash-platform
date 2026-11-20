import { useQuery } from '@tanstack/react-query'
import { canAct, decideApproval, fetchApprovals, type AdminApproval, type AdminRole, type ApprovalAction } from '@/api/admin'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { timeAgo } from '@/lib/format'
import { ActionButton, Empty, Panel, Pill, Rows, useAdminAction } from './shared'

const ACTIONS: Record<ApprovalAction, string> = {
  suspend_user: 'Suspend talent',
  delete_entry: 'Delete video',
  delete_group: 'Delete group',
}

const STATUS_TONE = { pending: 'warn', approved: 'good', rejected: 'neutral' } as const

/** Four eyes: critical actions wait here until a second admin approves them. */
export function ApprovalsSection({ role }: { role: AdminRole }) {
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['admin', 'approvals'], queryFn: fetchApprovals })
  const { run, busy, patch } = useAdminAction()

  return (
    <Panel title="Approvals">
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Empty>Nothing to approve. Suspensions and deletions requested by an admin appear here.</Empty>
      ) : (
        <Rows>
          {data.map((request) => (
            <li key={request.id} className="flex flex-col gap-2 px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-extrabold">{ACTIONS[request.action]}</span>
                <Pill tone={STATUS_TONE[request.status]}>{request.status}</Pill>
                <span className="ml-auto text-xs text-muted">{timeAgo(request.requested_at)}</span>
              </div>
              <p className="text-sm break-words">{request.target_label}</p>
              <p className="rounded-xl bg-fg/5 px-3 py-2 text-sm break-words text-muted">“{request.reason}”</p>
              <p className="text-xs text-subtle">
                Asked by @{request.requested_by_handle ?? 'former admin'}
                {request.decided_by_handle && ` · ${request.status} by @${request.decided_by_handle}`}
              </p>
              {request.status === 'pending' && canAct(role, 'admin') && (
                <div className="flex flex-wrap items-center gap-2">
                  {request.mine ? (
                    <span className="text-xs font-bold text-muted">Waiting for another admin</span>
                  ) : (
                    <ActionButton tone="danger" disabled={busy === request.id} onClick={() => run(request.id, () => decideApproval(request.id, true), 'Approved and done', () =>
                        patch<AdminApproval>(['admin', 'approvals'], (rows) => rows.map((row) => (row.id === request.id ? { ...row, status: 'approved' } : row))),
                      )}>
                      Approve
                    </ActionButton>
                  )}
                  <ActionButton disabled={busy === request.id} onClick={() => run(request.id, () => decideApproval(request.id, false), request.mine ? 'Request withdrawn' : 'Rejected', () =>
                        patch<AdminApproval>(['admin', 'approvals'], (rows) => rows.map((row) => (row.id === request.id ? { ...row, status: 'rejected' } : row))),
                      )}>
                    {request.mine ? 'Withdraw' : 'Reject'}
                  </ActionButton>
                </div>
              )}
            </li>
          ))}
        </Rows>
      )}
    </Panel>
  )
}
