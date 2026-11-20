import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { markNotificationsRead, type Notification, type NotificationKind } from '@/api/notifications'
import { formatCase } from '@/api/safety'
import { useNotifications } from '@/api/queries'
import { useAuthUi } from '@/app/auth'
import { useSession } from '@/app/session'
import { SparkIcon } from '@/components/icons/ActionIcons'
import { ClashIcon } from '@/components/icons/TabIcons'
import { BellIcon } from '@/components/icons/UiIcons'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { timeAgo } from '@/lib/format'
import { WORLDS } from '@/theme/worlds'

type Filter = 'all' | 'clashes' | 'comments' | 'people'

const FILTERS: Record<Filter, NotificationKind[] | null> = {
  all: null,
  clashes: ['clash_back', 'clash_entry', 'clash_invite', 'clash_starting', 'clash_open', 'clash_ended', 'group_join'],
  comments: ['comment', 'reply', 'comment_like'],
  people: ['follow', 'spark'],
}

/** Everything that happened around the signed-in talent, newest first, live. */
export function ActivityPage() {
  const session = useSession()
  const { openAuth } = useAuthUi()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useNotifications(session?.user.id)
  const notifications = useMemo(() => data?.pages.flat() ?? [], [data])

  // Opening Activity marks everything as seen. Rows keep their highlight until the next visit.
  const marked = useRef(false)
  const hasUnread = notifications.some((item) => !item.read)
  useEffect(() => {
    if (!session || !hasUnread || marked.current) return
    marked.current = true
    void markNotificationsRead()
      .then(() => queryClient.setQueryData(['notifications-unread', session.user.id], 0))
      .catch(() => {
        marked.current = false
      })
  }, [session, hasUnread, queryClient])

  const kinds = FILTERS[filter]
  const visible = kinds ? notifications.filter((item) => kinds.includes(item.kind)) : notifications
  const sections = groupByAge(visible)

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-36 lg:pb-12">
      <PageHeader back title="Activity" />

      {!session ? (
        <div className="pt-6">
          <EmptyState title="Your Activity lives here">
            <p>Follows, Sparks, comments, Clash Backs and Clash invites show up the moment they happen.</p>
            <button
              type="button"
              onClick={() => openAuth('signup', 'Create your account to see your Activity.')}
              className="pressable mt-5 h-12 rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] px-6 text-sm font-extrabold text-world-ink"
            >
              Sign up or log in
            </button>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="no-scrollbar overflow-x-auto px-4 pt-1 pb-4 lg:px-0">
            <SegmentedTabs
              label="Filter Activity"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'clashes', label: 'Clashes' },
                { value: 'comments', label: 'Comments' },
                { value: 'people', label: 'Fans' },
              ]}
            />
          </div>

          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : visible.length === 0 ? (
            <EmptyState title={filter === 'all' ? 'Nothing yet' : 'Nothing here yet'}>
              Post a video or start a Clash: every reaction will appear here.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-6 px-4 lg:px-0">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2 className="mb-2 px-1 text-[11px] font-extrabold tracking-widest text-muted uppercase">{section.title}</h2>
                  <ul className="overflow-hidden rounded-[22px] border border-line bg-fg/[.035]">
                    {section.items.map((item) => (
                      <li key={item.id} className="border-b border-line last:border-b-0">
                        <ActivityRow item={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {hasNextPage && (
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="pressable mx-auto h-11 rounded-xl bg-fg/8 px-5 text-sm font-bold disabled:opacity-50"
                >
                  {isFetchingNextPage ? 'Loading…' : 'Show older'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ActivityRow({ item }: { item: Notification }) {
  const { href, text } = describe(item)
  const world = WORLDS[item.entry?.worldId ?? item.clash?.worldId ?? item.group?.worldId ?? 'music']

  return (
    <Link to={href} className={clsx('flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-fg/5', !item.read && 'bg-world-soft')}>
      {item.actor ? (
        <Avatar name={item.actor.displayName} src={item.actor.avatarUrl} size={44} />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-fg/10" style={{ background: `${world.accent}22` }}>
          <ClashIcon size={26} accent={world.accent} />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[14px] leading-snug break-words">{text}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <KindIcon kind={item.kind} />
          {timeAgo(item.createdAt)}
        </span>
      </span>

      {item.entry?.posterUrl ? (
        <span data-theme="dark" className="h-14 w-10 shrink-0 overflow-hidden rounded-lg" style={{ background: world.scene }}>
          <img src={item.entry.posterUrl} alt="" loading="lazy" className="size-full object-cover" />
        </span>
      ) : (
        !item.read && <span aria-label="New" className="size-2.5 shrink-0 rounded-full bg-world shadow-[0_0_10px_var(--world-glow)]" />
      )}
    </Link>
  )
}

function KindIcon({ kind }: { kind: NotificationKind }) {
  if (kind === 'spark') return <SparkIcon size={13} />
  if (kind.startsWith('clash') || kind === 'group_join') return <ClashIcon size={14} accent="var(--world-a)" />
  return <BellIcon size={12} />
}

function Name({ children }: { children: ReactNode }) {
  return <strong className="font-extrabold">{children}</strong>
}

function quote(body: string | undefined) {
  if (!body) return null
  return <span className="text-muted"> “{body.length > 80 ? `${body.slice(0, 80)}…` : body}”</span>
}

/** Where a notification leads and how it reads. */
function describe(item: Notification): { href: string; text: ReactNode } {
  const who = <Name>{item.actor?.displayName ?? 'Someone'}</Name>
  const clash = <Name>{item.clash?.title ?? 'a Clash'}</Name>
  const video = item.entry ? `/?v=${item.entry.id}` : '/'
  const clashPage = item.clash ? `/c/${item.clash.id}` : '/clash'

  switch (item.kind) {
    case 'follow':
      return { href: item.actor ? `/u/${item.actor.handle}` : '/', text: <>{who} started following you</> }
    case 'spark':
      return { href: video, text: <>{who} sparked your video</> }
    case 'comment':
      return { href: video, text: <>{who} commented:{quote(item.comment?.body)}</> }
    case 'reply':
      return { href: video, text: <>{who} replied to your comment:{quote(item.comment?.body)}</> }
    case 'comment_like':
      return { href: video, text: <>{who} liked your comment:{quote(item.comment?.body)}</> }
    case 'clash_back':
      return { href: item.entry ? `/clash-back/${item.entry.id}` : '/', text: <>{who} answered your video with a Clash Back</> }
    case 'clash_entry':
      return { href: clashPage, text: <>{who} entered your Clash {clash}</> }
    case 'clash_invite':
      return { href: clashPage, text: <>{who} invited you to the Clash {clash}</> }
    case 'group_join':
      return { href: item.group ? `/g/${item.group.id}` : '/groups', text: <>{who} joined your group <Name>{item.group?.name ?? ''}</Name></> }
    case 'clash_starting':
      return { href: clashPage, text: <>{clash} starts in less than 15 minutes</> }
    case 'clash_open':
      return { href: clashPage, text: <>{clash} is open. Post your entry now</> }
    case 'clash_ended':
      return { href: clashPage, text: <>{clash} has ended. See who won</> }
    case 'report_update':
      return { href: '/safety', text: <>Your report <Name>{item.reportCase ? formatCase(item.reportCase) : ''}</Name> was reviewed by our team</> }
  }
}

/** Today, this week, then everything older. */
function groupByAge(items: Notification[]) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const weekAgo = startOfToday.getTime() - 6 * 86_400_000
  const sections = [
    { title: 'Today', items: [] as Notification[] },
    { title: 'This week', items: [] as Notification[] },
    { title: 'Earlier', items: [] as Notification[] },
  ]
  for (const item of items) {
    const time = Date.parse(item.createdAt)
    sections[time >= startOfToday.getTime() ? 0 : time >= weekAgo ? 1 : 2].items.push(item)
  }
  return sections.filter((section) => section.items.length > 0)
}
