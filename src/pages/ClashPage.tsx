import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useClashes, useGroups } from '@/api/queries'
import { useRequireSession } from '@/app/requireSession'
import { ClashCard } from '@/components/clash/ClashCard'
import { liveStatus, useNow } from '@/components/clash/Countdown'
import { Globe } from '@/components/clash/Globe'
import { WorldOrb } from '@/components/clash/WorldOrb'
import { NotificationBell } from '@/components/activity/NotificationBell'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/States'
import { WORLD_LIST } from '@/theme/worlds'
import type { Clash } from '@/types/domain'
import { GroupTile } from './GroupsPage'

export function ClashPage() {
  const navigate = useNavigate()
  const requireSession = useRequireSession()
  const { data: clashes = [], isLoading } = useClashes()
  const { data: groups = [] } = useGroups()
  const now = useNow(15_000)

  const start = () => requireSession('start a Clash', () => navigate('/clash/new'))
  const withStatus = clashes.map((clash) => ({ clash, status: liveStatus(clash, now) }))
  const pick = (test: (item: (typeof withStatus)[number]) => boolean) => withStatus.filter(test).map((item) => item.clash)

  const invitations = pick(({ clash, status }) => clash.invited && status !== 'ended')
  const open = pick(({ clash, status }) => status === 'open' && !clash.invited)
  const soon = pick(({ clash, status }) => status === 'scheduled' && !clash.invited)
  const ended = pick(({ status }) => status === 'ended').reverse()
  const myGroups = groups.filter((group) => group.isMember)

  return (
    <div className="mx-auto min-h-dvh max-w-6xl bg-[radial-gradient(80%_45%_at_50%_20%,var(--raised),transparent_60%)] pb-36 lg:px-8 lg:pb-12">
      <PageHeader
        title="Clash"
        actions={
          <>
            <NotificationBell className="lg:hidden" />
            <button
              type="button"
              onClick={start}
              className="pressable h-10 rounded-xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] px-4 text-sm font-extrabold text-world-ink shadow-[0_8px_20px_var(--world-glow)]"
            >
              Start a Clash
            </button>
          </>
        }
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start lg:gap-12">
        <section className="flex flex-col items-center pt-8 pb-2 lg:sticky lg:top-6 lg:py-16">
          <Globe onCreate={start} />
          <p className="mt-9 text-center text-[12.5px] text-muted">Tap the globe to start a Clash anywhere in the world</p>
        </section>

        <div className="min-w-0">
          {invitations.length > 0 && <Row title="You are invited" clashes={invitations} />}

          <Row title="Open now" clashes={open}>
            {isLoading ? (
              <div className="flex gap-3 overflow-hidden px-4 pt-1 pb-3 lg:px-0" aria-label="Loading Clashes">
                {[0, 1, 2].map((index) => (
                  <span key={index} className="h-[230px] w-[176px] shrink-0 animate-pulse rounded-[24px] bg-fg/5" />
                ))}
              </div>
            ) : (
              <EmptyState title="No open Clash right now">Start the first one and invite talents to answer.</EmptyState>
            )}
          </Row>

          {soon.length > 0 && <Row title="Starting soon" clashes={soon} />}

          <div className="mx-4 mt-8 mb-3 flex items-baseline justify-between lg:mx-0">
            <h2 className="text-[15px] font-extrabold">Groups</h2>
            <Link to="/groups" className="text-xs font-extrabold text-world">
              {groups.length > 0 ? 'See all' : 'Create a group'}
            </Link>
          </div>
          {myGroups.length > 0 ? (
            <ul className="grid gap-2 px-4 sm:grid-cols-2 lg:px-0">
              {myGroups.slice(0, 4).map((group) => (
                <li key={group.id}>
                  <GroupTile group={group} />
                </li>
              ))}
            </ul>
          ) : (
            <Link to="/groups" className="pressable mx-4 block rounded-3xl border border-dashed border-fg/12 px-6 py-6 text-center lg:mx-0">
              <span className="block text-base font-extrabold">Clash as a crew</span>
              <span className="mt-1 block text-sm text-muted">Create or join a group, then challenge another group.</span>
            </Link>
          )}

          {ended.length > 0 && <Row title="Recently ended" clashes={ended} />}

          <h2 className="mx-4 mt-8 mb-2.5 text-[15px] font-extrabold lg:mx-0">Talent Worlds</h2>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2 lg:flex-wrap lg:px-0">
            {WORLD_LIST.map((world, index) => (
              <WorldOrb key={world.id} world={world} delay={index * 0.3} />
            ))}
          </div>
          <Link to="/credits" className="mx-4 mt-6 inline-block text-xs text-subtle hover:text-text lg:mx-0">
            3D models by Sketchfab artists · credits
          </Link>
        </div>
      </div>
    </div>
  )
}

function Row({ title, clashes, children }: { title: string; clashes: Clash[]; children?: ReactNode }) {
  return (
    <>
      <h2 className="mx-4 mt-6 mb-3 text-[15px] font-extrabold lg:mx-0">{title}</h2>
      {clashes.length === 0 ? (
        children
      ) : (
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-3 lg:px-0">
          {clashes.map((clash) => (
            <ClashCard key={clash.id} clash={clash} />
          ))}
        </div>
      )}
    </>
  )
}
