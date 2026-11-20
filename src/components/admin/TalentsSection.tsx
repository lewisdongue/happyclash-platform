import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { canAct, fetchAdminUsers, requestApproval, revokeVerification, unsuspendUser, type AdminRole, type AdminUser } from '@/api/admin'
import { VerifiedBadge } from '@/components/icons/UiIcons'
import { Avatar } from '@/components/ui/Avatar'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { timeAgo } from '@/lib/format'
import { ActionButton, Empty, Panel, Pill, ReasonSheet, Rows, useAdminAction } from './shared'

/** Find any talent by name, username or email, and act on their account. */
export function TalentsSection({ role, myId }: { role: AdminRole; myId: string }) {
  const [search, setSearch] = useState('')
  const term = useDeferredValue(search.trim())
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['admin', 'users', term], queryFn: () => fetchAdminUsers(term) })
  const { run, busy, patch } = useAdminAction()
  const [suspending, setSuspending] = useState<AdminUser | null>(null)

  return (
    <Panel title="Talents">
      <div className="border-b border-line p-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, @username or email"
          className="h-11 w-full rounded-xl border border-line bg-fg/4 px-3.5 text-[15px] outline-none placeholder:text-subtle focus:border-world"
        />
      </div>
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Empty>No talent matches “{term}”.</Empty>
      ) : (
        <Rows>
          {data.map((user) => (
            <li key={user.id} className="flex flex-col gap-2.5 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Avatar name={user.display_name} src={user.avatar_url} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <Link to={`/u/${user.handle}`} target="_blank" className="truncate text-sm font-extrabold hover:underline">
                      {user.display_name}
                    </Link>
                    {user.verified && <VerifiedBadge size={14} />}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    <span translate="no" className="notranslate">@{user.handle}</span>
                    {user.email && ` · ${user.email}`}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {user.role && <Pill tone="info">{user.role}</Pill>}
                {user.suspended_at && <Pill tone="danger">Suspended</Pill>}
                {user.reports_against > 0 && <Pill tone="warn">{user.reports_against} reports</Pill>}
                <span>
                  {user.videos} {user.videos === 1 ? 'video' : 'videos'} · {user.followers} {user.followers === 1 ? 'follower' : 'followers'} · joined {timeAgo(user.created_at)}
                  {user.last_sign_in_at && ` · seen ${timeAgo(user.last_sign_in_at)}`}
                </span>
              </div>
              {user.suspended_reason && <p className="text-xs text-muted">Suspended for: {user.suspended_reason}</p>}

              {canAct(role, 'admin') && user.id !== myId && (
                <div className="flex flex-wrap gap-2">
                  {user.suspended_at ? (
                    <ActionButton disabled={busy === user.id} onClick={() => run(user.id, () => unsuspendUser(user.id), `@${user.handle} can use happyClash again`, () =>
                        patch<AdminUser>(['admin', 'users'], (rows) => rows.map((row) => (row.id === user.id ? { ...row, suspended_at: null, suspended_reason: null } : row))),
                      )}>
                      Lift suspension
                    </ActionButton>
                  ) : (
                    <ActionButton tone="danger" onClick={() => setSuspending(user)}>
                      Suspend
                    </ActionButton>
                  )}
                  {user.verified && (
                    <ActionButton disabled={busy === user.id} onClick={() => run(user.id, () => revokeVerification(user.id), 'Badge removed', () =>
                        patch<AdminUser>(['admin', 'users'], (rows) => rows.map((row) => (row.id === user.id ? { ...row, verified: false, verified_url: null } : row))),
                      )}>
                      Remove badge
                    </ActionButton>
                  )}
                </div>
              )}
            </li>
          ))}
        </Rows>
      )}

      <ReasonSheet
        open={suspending !== null}
        title={`Suspend @${suspending?.handle ?? ''}?`}
        description="A suspended talent can still watch but cannot post, comment, spark, follow, vote or create anything. A second admin must approve."
        confirm="Ask for approval"
        onClose={() => setSuspending(null)}
        onConfirm={(reason) => run('suspend', () => requestApproval('suspend_user', suspending!.id, reason), 'Sent to another admin for approval')}
      />
    </Panel>
  )
}
