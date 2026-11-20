import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { deleteCommentAsAdmin, fetchAdminReports, setEntryHidden, setReportStatus, type AdminReport } from '@/api/admin'
import { formatCase } from '@/api/safety'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { timeAgo } from '@/lib/format'
import { ActionButton, Empty, Panel, Pill, Rows, useAdminAction } from './shared'

const REASONS: Record<AdminReport['reason'], string> = {
  spam: 'Spam',
  nudity: 'Nudity',
  violence: 'Violence',
  hate: 'Hate speech',
  harassment: 'Harassment',
  minor_safety: 'Child safety',
  impersonation: 'Impersonation',
  copyright: 'Stolen content',
  other: 'Other',
}

const STATUS_TONE = { open: 'warn', reviewing: 'info', actioned: 'good', dismissed: 'neutral' } as const

/** Where a reported thing lives, so a moderator can look before deciding. */
function targetLink(report: AdminReport): string | null {
  if (report.entry_id) return `/?v=${report.entry_id}`
  if (report.target_type === 'user' && report.target_handle) return `/u/${report.target_handle}`
  if (report.clash_id) return `/c/${report.clash_id}`
  if (report.group_id) return `/g/${report.group_id}`
  return null
}

/** The report queue. Child safety cases always sit on top. */
export function ReportsSection() {
  const [status, setStatus] = useState<'active' | 'closed'>('active')
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['admin', 'reports', status], queryFn: () => fetchAdminReports(status), refetchInterval: 10_000 })
  const { run, busy, patch } = useAdminAction()
  const [notes, setNotes] = useState<Record<number, string>>({})

  return (
    <Panel
      title={status === 'active' ? 'Open cases' : 'Closed cases'}
      aside={
        <SegmentedTabs
          label="Report status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Open' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Empty>{status === 'active' ? 'No open case. The community is behaving.' : 'No closed case yet.'}</Empty>
      ) : (
        <Rows>
          {data.map((report) => {
            const key = String(report.case_number)
            const link = targetLink(report)
            const leaveQueue = () => patch<AdminReport>(['admin', 'reports', 'active'], (rows) => rows.filter((row) => row.case_number !== report.case_number))
            const close = (next: 'actioned' | 'dismissed') =>
              run(key, () => setReportStatus(report.case_number, next, notes[report.case_number]), next === 'actioned' ? 'Case closed: action taken' : 'Case closed: no violation', leaveQueue)
            return (
              <li key={key} className="flex flex-col gap-2.5 px-4 py-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="tabular mr-1 text-sm font-extrabold tracking-wide">{formatCase(report.case_number)}</span>
                  <Pill tone={report.reason === 'minor_safety' ? 'danger' : 'neutral'}>{REASONS[report.reason]}</Pill>
                  <Pill tone={STATUS_TONE[report.status]}>{report.status}</Pill>
                  {report.same_target_reports > 1 && <Pill tone="danger">{report.same_target_reports} reports</Pill>}
                  <span className="ml-auto text-xs text-muted">{timeAgo(report.created_at)}</span>
                </div>
                <p className="text-sm break-words">
                  <span className="font-bold capitalize">{report.target_type === 'entry' ? 'Video' : report.target_type}</span>
                  {' · '}
                  {report.target_label}
                  {report.target_handle && report.target_type !== 'user' && <span className="text-muted"> by @{report.target_handle}</span>}
                </p>
                {report.details && <p className="rounded-xl bg-fg/5 px-3 py-2 text-sm break-words text-muted">“{report.details}”</p>}
                <p className="text-xs text-subtle">Reported by @{report.reporter_handle ?? 'deleted account'}</p>
                {report.moderator_note && <p className="text-xs text-muted">Note: {report.moderator_note}</p>}

                {status === 'active' && (
                  <>
                    <input
                      value={notes[report.case_number] ?? ''}
                      onChange={(event) => setNotes((current) => ({ ...current, [report.case_number]: event.target.value }))}
                      placeholder="Internal note (optional)"
                      className="h-10 w-full rounded-xl border border-line bg-fg/4 px-3 text-sm outline-none placeholder:text-subtle focus:border-world"
                    />
                    <div className="flex flex-wrap gap-2">
                      {link && (
                        <Link to={link} className="pressable grid h-9 place-items-center rounded-xl bg-fg/8 px-3 text-xs font-extrabold">
                          Open
                        </Link>
                      )}
                      {report.status === 'open' && (
                        <ActionButton disabled={busy === key} onClick={() => run(key, () => setReportStatus(report.case_number, 'reviewing'), 'Marked as in review', () =>
                            patch<AdminReport>(['admin', 'reports', 'active'], (rows) =>
                              rows.map((row) => (row.case_number === report.case_number ? { ...row, status: 'reviewing' } : row)),
                            ),
                          )}>
                          Start review
                        </ActionButton>
                      )}
                      {report.entry_id && (
                        <ActionButton
                          tone="danger"
                          disabled={busy === key}
                          onClick={() => run(key, async () => {
                            await setEntryHidden(report.entry_id!, true)
                            await setReportStatus(report.case_number, 'actioned', notes[report.case_number] || 'Video hidden')
                          }, 'Video hidden, case closed', leaveQueue)}
                        >
                          Hide video
                        </ActionButton>
                      )}
                      {report.comment_id && (
                        <ActionButton
                          tone="danger"
                          disabled={busy === key}
                          onClick={() => run(key, async () => {
                            await setReportStatus(report.case_number, 'actioned', notes[report.case_number] || 'Comment removed')
                            await deleteCommentAsAdmin(report.comment_id!)
                          }, 'Comment removed, case closed', leaveQueue)}
                        >
                          Remove comment
                        </ActionButton>
                      )}
                      <ActionButton tone="primary" disabled={busy === key} onClick={() => close('actioned')}>
                        Action taken
                      </ActionButton>
                      <ActionButton disabled={busy === key} onClick={() => close('dismissed')}>
                        No violation
                      </ActionButton>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </Rows>
      )}
    </Panel>
  )
}
