import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEntry, useFeed, type FeedMode } from '@/api/queries'
import { useAuthUi } from '@/app/auth'
import { useNewVideosCount } from '@/app/realtime'
import { useSession } from '@/app/session'
import { DesktopStage } from '@/components/feed/DesktopStage'
import { FeedHeader } from '@/components/feed/FeedHeader'
import { FeedModeTabs } from '@/components/feed/FeedModeTabs'
import { PhoneFeed } from '@/components/feed/PhoneFeed'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import type { Entry } from '@/types/domain'

export function HomePage() {
  const isDesktop = useIsDesktop()
  const session = useSession()
  const { openAuth } = useAuthUi()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const mode: FeedMode = params.get('feed') === 'following' ? 'following' : 'for-you'
  const startId = params.get('v') ?? undefined

  const feed = useFeed(mode, session?.user.id)
  const { data: startEntry, isLoading: loadingStart } = useEntry(startId)
  const [newCount, clearNew] = useNewVideosCount()

  // Pages can overlap after a refresh; a shared link's video always comes first.
  const entries = useMemo(() => {
    const seen = new Set<string>()
    const list: Entry[] = []
    for (const entry of [...(startEntry ? [startEntry] : []), ...(feed.data?.pages.flat() ?? [])]) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      list.push(entry)
    }
    return list
  }, [feed.data, startEntry])

  const setMode = (next: FeedMode) => {
    if (next === 'following' && !session) return openAuth('signup', 'Create your account to follow talents.')
    setParams(next === 'following' ? { feed: 'following' } : {}, { replace: true })
  }

  const loadMore = () => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage()
  }

  const showNew = () => {
    clearNew()
    setParams(mode === 'following' ? { feed: 'following' } : {}, { replace: true })
    void queryClient.resetQueries({ queryKey: ['feed'] })
  }

  const header = isDesktop ? (
    <div className="flex justify-center pt-4">
      <FeedModeTabs mode={mode} onMode={setMode} />
    </div>
  ) : (
    <FeedHeader mode={mode} onMode={setMode} />
  )

  if (feed.isLoading || loadingStart) {
    return (
      <>
        {header}
        <div className="pt-32">
          <LoadingState />
        </div>
      </>
    )
  }
  if (feed.isError) {
    return (
      <>
        {header}
        <div className="pt-32">
          <ErrorState onRetry={() => feed.refetch()} />
        </div>
      </>
    )
  }
  if (entries.length === 0) {
    return (
      <>
        {header}
        <div className="pt-32">
          {mode === 'following' ? (
            <EmptyState title="Nobody to follow yet">Follow talents from their profile and their new videos land here.</EmptyState>
          ) : (
            <EmptyState title="No videos yet">The first talent to post opens the stage.</EmptyState>
          )}
        </div>
      </>
    )
  }

  const props = { entries, startId, onNearEnd: loadMore, newCount, onShowNew: showNew, mode, onMode: setMode }
  return isDesktop ? <DesktopStage key={mode} {...props} /> : <PhoneFeed key={mode} {...props} />
}
