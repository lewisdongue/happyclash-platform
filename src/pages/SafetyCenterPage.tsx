import type { ReactNode } from 'react'
import { Link } from 'react-router'
import clsx from 'clsx'
import { useBlockedTalents, useMyReports } from '@/api/queries'
import type { CaseStatus, ReportReasonId, ReportTarget } from '@/api/safety'
import { useAuthUi } from '@/app/auth'
import { useSession } from '@/app/session'
import { PageHeader } from '@/components/layout/PageHeader'
import { useBlockTalent } from '@/components/safety/useBlockTalent'
import { Avatar } from '@/components/ui/Avatar'
import { SUPPORT_EMAIL } from '@/content/legal'
import { timeAgo } from '@/lib/format'

const STATUS: Record<CaseStatus, { label: string; className: string }> = {
  open: { label: 'Received', className: 'bg-fg/10 text-text' },
  reviewing: { label: 'In review', className: 'bg-[#6FB8FF]/15 text-[#3d8fe0]' },
  actioned: { label: 'Action taken', className: 'bg-[#5FE0A8]/15 text-[#1f9e6e]' },
  dismissed: { label: 'No violation', className: 'bg-fg/6 text-muted' },
}

const TARGETS: Record<ReportTarget, string> = { entry: 'Video', user: 'Talent', clash: 'Clash', group: 'Group', comment: 'Comment' }

const REASONS: Record<ReportReasonId, string> = {
  spam: 'Spam or fake engagement',
  nudity: 'Nudity or sexual content',
  violence: 'Violence or danger',
  hate: 'Hate speech',
  harassment: 'Harassment',
  minor_safety: 'Child safety',
  impersonation: 'Impersonation',
  copyright: 'Stolen content',
  other: 'Other',
}

/** Your reports and their status, the talents you blocked, and how happyClash keeps people safe. */
export function SafetyCenterPage() {
  const session = useSession()
  const { openAuth } = useAuthUi()
  const { data: reports = [], isLoading: loadingReports } = useMyReports(session?.user.id)
  const { data: blocked = [], isLoading: loadingBlocked } = useBlockedTalents(session?.user.id)
  const blockTalent = useBlockTalent()

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-36 lg:pb-12">
      <PageHeader back title="Safety Center" />

      <div className="flex flex-col gap-7 px-4 pt-2 lg:px-0">
        <section className="relative overflow-hidden rounded-[28px] border border-line bg-[radial-gradient(120%_120%_at_0%_0%,var(--world-soft),transparent_60%)] p-5">
          <p className="text-xl font-extrabold tracking-tight">Show your talent. Feel safe doing it.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Block anyone at any time, report anything you see, and follow every report you send until it is closed.
          </p>
        </section>

        {!session ? (
          <button
            type="button"
            onClick={() => openAuth('login', 'Log in to see your reports and blocked talents.')}
            className="pressable h-14 rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-base font-extrabold text-world-ink"
          >
            Log in to see your reports
          </button>
        ) : (
          <>
            <Section title="Your reports" count={reports.length}>
              {loadingReports ? (
                <Muted>Loading…</Muted>
              ) : reports.length === 0 ? (
                <Muted>You have not reported anything. Use the ⋯ menu on a video, profile or comment, or the flag on a Clash or group.</Muted>
              ) : (
                <ul className="divide-y divide-fg/6">
                  {reports.map((report) => (
                    <li key={report.caseId} className="flex items-center gap-3 px-4 py-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="tabular block text-sm font-extrabold tracking-wide">{report.caseId}</span>
                        <span className="block truncate text-sm">
                          {TARGETS[report.target]} · {report.label}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {REASONS[report.reason]} · {timeAgo(report.createdAt)}
                        </span>
                      </span>
                      <span className={clsx('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold', STATUS[report.status].className)}>
                        {STATUS[report.status].label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Blocked talents" count={blocked.length}>
              {loadingBlocked ? (
                <Muted>Loading…</Muted>
              ) : blocked.length === 0 ? (
                <Muted>Nobody is blocked. Open a profile and tap ⋯ to block someone.</Muted>
              ) : (
                <ul className="divide-y divide-fg/6">
                  {blocked.map((talent) => (
                    <li key={talent.id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={talent.displayName} src={talent.avatarUrl} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold"><span translate="no" className="notranslate">{talent.displayName}</span></span>
                        <span className="block truncate text-xs text-muted"><span translate="no" className="notranslate">@{talent.handle}</span></span>
                      </span>
                      <button
                        type="button"
                        onClick={() => blockTalent(talent, false)}
                        className="pressable h-9 shrink-0 rounded-xl bg-fg/8 px-3.5 text-xs font-extrabold"
                      >
                        Unblock
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}

        <section>
          <h2 className="mb-2 px-1 text-[11px] font-extrabold tracking-widest text-muted uppercase">How we protect you</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card title="Block, no questions asked">
              Their videos and comments disappear for you and yours for them. They cannot follow you, comment, invite you or Clash Back your videos, and they are not told.
            </Card>
            <Card title="Every report is a case">
              Reports are anonymous and get a case number. Videos reported by several talents are hidden for everyone until reviewed.
            </Card>
            <Card title="Children come first">
              happyClash is for people aged 13 and over. Reports about a child at risk are reviewed first. Never share your address, school or phone number.
            </Card>
            <Card title="No bots, no fake votes">
              Every account has limits on how fast it can spark, comment, follow, vote and post, so rankings reflect real people.
            </Card>
          </div>
        </section>

        <section className="rounded-[22px] border border-line bg-fg/[.035] p-4 text-sm leading-relaxed">
          <p className="font-extrabold">Need help now?</p>
          <p className="mt-1 text-muted">
            If someone is in immediate danger, call your local emergency number. For anything else, write to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-world">
              {SUPPORT_EMAIL}
            </a>{' '}
            with your case number. Read our <Link to="/legal/terms" className="font-bold text-world">Terms</Link> for the community rules.
          </p>
        </section>
      </div>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center justify-between px-1 text-[11px] font-extrabold tracking-widest text-muted uppercase">
        {title}
        {count > 0 && <span className="tabular">{count}</span>}
      </h2>
      <div className="overflow-hidden rounded-[22px] border border-line bg-fg/[.035]">{children}</div>
    </section>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-line bg-fg/[.035] p-4">
      <p className="text-[15px] font-extrabold">{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{children}</p>
    </div>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="px-4 py-5 text-sm text-muted">{children}</p>
}
