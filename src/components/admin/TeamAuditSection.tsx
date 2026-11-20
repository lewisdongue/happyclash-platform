import { useQuery } from '@tanstack/react-query'
import { canAct, fetchAuditLog, fetchTeam, type AdminRole } from '@/api/admin'
import { Avatar } from '@/components/ui/Avatar'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { dateTime, Empty, Panel, Pill, Rows } from './shared'

/** Who can moderate, and every action they took. */
export function TeamAuditSection({ role }: { role: AdminRole }) {
  const team = useQuery({ queryKey: ['admin', 'team'], queryFn: fetchTeam })
  const audit = useQuery({ queryKey: ['admin', 'audit'], queryFn: fetchAuditLog, enabled: canAct(role, 'admin') })

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Team">
        {team.isLoading ? (
          <LoadingState />
        ) : team.isError ? (
          <ErrorState onRetry={() => void team.refetch()} />
        ) : (
          <Rows>
            {(team.data ?? []).map((member) => (
              <li key={member.user_id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={member.display_name} src={member.avatar_url} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{member.display_name}</span>
                  <span className="block truncate text-xs text-muted"><span translate="no" className="notranslate">@{member.handle}</span></span>
                </span>
                <Pill tone="info">{member.role}</Pill>
              </li>
            ))}
          </Rows>
        )}
        <p className="border-t border-line px-4 py-3 text-xs text-muted">Access is reserved to the three happyClash team accounts.</p>
      </Panel>

      {canAct(role, 'admin') && (
        <Panel title="Audit log">
          {audit.isLoading ? (
            <LoadingState />
          ) : audit.isError ? (
            <ErrorState onRetry={() => void audit.refetch()} />
          ) : (audit.data ?? []).length === 0 ? (
            <Empty>No action yet. Every moderation step will be listed here.</Empty>
          ) : (
            <Rows>
              {audit.data!.map((event) => (
                <li key={event.id} className="px-4 py-3">
                  <p className="text-sm">
                    <span className="font-extrabold">@{event.actor_handle ?? 'system'}</span> <span className="text-muted">{event.action.replace(/_/g, ' ')}</span>{' '}
                    <span className="break-words">{event.target_label}</span>
                  </p>
                  <p className="text-xs text-subtle">
                    {dateTime(event.created_at)}
                    {typeof event.details.reason === 'string' && ` · “${event.details.reason}”`}
                    {typeof event.details.note === 'string' && event.details.note && ` · “${event.details.note}”`}
                  </p>
                </li>
              ))}
            </Rows>
          )}
        </Panel>
      )}
    </div>
  )
}
