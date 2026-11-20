import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { fetchAdminOverview, fetchMyAdminRole } from '@/api/admin'
import { useAuthUi } from '@/app/auth'
import { useSession } from '@/app/session'
import { ApprovalsSection } from '@/components/admin/ApprovalsSection'
import { ClashesGroupsSection } from '@/components/admin/ClashesGroupsSection'
import { ContentSection } from '@/components/admin/ContentSection'
import { OverviewSection } from '@/components/admin/OverviewSection'
import { ReportsSection } from '@/components/admin/ReportsSection'
import { TalentsSection } from '@/components/admin/TalentsSection'
import { TeamAuditSection } from '@/components/admin/TeamAuditSection'
import { AdminIcon, type AdminIconName } from '@/components/admin/icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { useMyProfile } from '@/api/queries'
import { useAdminRealtime } from '@/app/realtime'
import { EmptyState, LoadingState } from '@/components/ui/States'

type Tab = 'overview' | 'reports' | 'content' | 'talents' | 'clashes' | 'approvals' | 'team'

const TABS: { id: Tab; label: string; icon: AdminIconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'content', label: 'Videos', icon: 'videos' },
  { id: 'talents', label: 'Talents', icon: 'talents' },
  { id: 'clashes', label: 'Clashes & groups', icon: 'clashes' },
  { id: 'approvals', label: 'Approvals', icon: 'approvals' },
  { id: 'team', label: 'Team & audit', icon: 'team' },
]

export const useMyAdminRole = (userId: string | undefined) =>
  useQuery({ queryKey: ['admin-role', userId], queryFn: fetchMyAdminRole, enabled: Boolean(userId), staleTime: 5 * 60_000 })

/** The happyClash team's workspace: moderation, talents, Clashes, approvals and the audit log. */
export function AdminPage() {
  const session = useSession()
  const { openAuth } = useAuthUi()
  const { data: role, isLoading } = useMyAdminRole(session?.user.id)
  const [tab, setTab] = useState<Tab>('overview')
  const { data: overview } = useQuery({ queryKey: ['admin', 'overview'], queryFn: fetchAdminOverview, enabled: Boolean(role), refetchInterval: 10_000 })
  const { data: me } = useMyProfile(session?.user.id)
  useAdminRealtime(Boolean(role))

  if (!session) {
    return (
      <div className="pt-32">
        <EmptyState title="Admin Console">
          <p>Log in once with a happyClash team account. After that, this page opens directly.</p>
          <button
            type="button"
            onClick={() => openAuth('login', 'Log in with your happyClash team account.')}
            className="pressable mt-5 h-12 rounded-2xl bg-text px-6 text-sm font-extrabold text-ink"
          >
            Log in
          </button>
        </EmptyState>
      </div>
    )
  }
  if (isLoading) return <LoadingState />
  if (!role) return <div className="pt-32"><EmptyState title="Admins only">This workspace is for the happyClash team.</EmptyState></div>

  const badge = (id: Tab) => (id === 'reports' ? overview?.reports_open : id === 'approvals' ? overview?.approvals_pending : 0) ?? 0

  return (
    <div className="mx-auto min-h-dvh max-w-5xl pb-36 lg:px-8 lg:pb-12">
      <PageHeader back title="" />

      <section className="relative mx-4 mb-4 overflow-hidden rounded-[28px] border border-line bg-[radial-gradient(120%_140%_at_0%_0%,var(--world-soft),transparent_55%),radial-gradient(90%_120%_at_100%_100%,rgba(29,155,240,.12),transparent_60%)] p-5 lg:mx-0">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(160deg,var(--world-a),var(--world-b))] text-world-ink shadow-[0_12px_30px_var(--world-glow),inset_0_1px_0_rgba(255,255,255,.5)]">
            <AdminIcon name="team" size={28} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[26px] leading-tight font-extrabold tracking-tight">Admin Console</span>
            <span className="block truncate text-sm text-muted">
              {me ? `@${me.handle} · ` : ''}
              <span className="capitalize">{role}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#22c55e]/12 px-3 py-1.5 text-xs font-extrabold text-[#16a34a]">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#22c55e] opacity-70" />
              <span className="relative size-2 rounded-full bg-[#22c55e]" />
            </span>
            Live
          </span>
        </div>
      </section>

      <div role="tablist" aria-label="Admin sections" className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-1 pb-4 lg:px-0">
        {TABS.map(({ id, label, icon }) => {
          const count = badge(id)
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={clsx(
                'pressable flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-extrabold whitespace-nowrap',
                tab === id ? 'bg-text text-ink' : 'border border-line bg-fg/4 text-muted',
              )}
            >
              <AdminIcon name={icon} size={15} />
              {label}
              {count > 0 && <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-[#ff4d6d] px-1 text-[10.5px] text-white">{count}</span>}
            </button>
          )
        })}
      </div>

      <div className="px-4 lg:px-0">
        {tab === 'overview' && <OverviewSection onOpen={setTab} />}
        {tab === 'reports' && <ReportsSection />}
        {tab === 'content' && <ContentSection role={role} />}
        {tab === 'talents' && <TalentsSection role={role} myId={session.user.id} />}
        {tab === 'clashes' && <ClashesGroupsSection role={role} />}
        {tab === 'approvals' && <ApprovalsSection role={role} />}
        {tab === 'team' && <TeamAuditSection role={role} />}
      </div>
    </div>
  )
}
