import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { RouteError } from '@/components/layout/RouteError'
import { LoadingState } from '@/components/ui/States'
import { isStaleBuildError, reloadForNewBuild } from '@/lib/chunkReload'
import { HomePage } from '@/pages/HomePage'

/**
 * Home ships in the main bundle; every other page loads on first visit.
 * A page file missing after a deploy triggers one reload onto the new build.
 */
const loaders: (() => Promise<unknown>)[] = []

/**
 * Once the first screen is idle, every page's code is fetched ahead of time,
 * so later taps never wait on the network or meet a file a newer deploy removed.
 */
export function prefetchPages() {
  const run = () => loaders.forEach((load) => void load().catch(() => undefined))
  // Safari has no requestIdleCallback.
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2500)
}

function page(load: () => Promise<{ default: ComponentType }>) {
  loaders.push(load)
  const Page = lazy(() =>
    load().catch((error: unknown) => {
      if (isStaleBuildError(error) && reloadForNewBuild()) return new Promise<never>(() => {})
      throw error
    }),
  )
  return (
    <Suspense fallback={<LoadingState />}>
      <Page />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'create', element: page(() => import('@/pages/CreatePage').then((m) => ({ default: m.CreatePage }))) },
      { path: 'clash/new', element: page(() => import('@/pages/ClashBuilderPage').then((m) => ({ default: m.ClashBuilderPage }))) },
      { path: 'c/:clashId', element: page(() => import('@/pages/ClashDetailPage').then((m) => ({ default: m.ClashDetailPage }))) },
      { path: 'world/:worldId', element: page(() => import('@/pages/WorldPage').then((m) => ({ default: m.WorldPage }))) },
      { path: 'activity', element: page(() => import('@/pages/ActivityPage').then((m) => ({ default: m.ActivityPage }))) },
      { path: 'live', element: page(() => import('@/pages/LivesPage').then((m) => ({ default: m.LivesPage }))) },
      { path: 'live/:clashId', element: page(() => import('@/pages/LivePage').then((m) => ({ default: m.LivePage }))) },
      { path: 'admin', element: page(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage }))) },
      { path: 'safety', element: page(() => import('@/pages/SafetyCenterPage').then((m) => ({ default: m.SafetyCenterPage }))) },
      { path: 'settings', element: page(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))) },
      { path: 'legal/:docId', element: page(() => import('@/pages/LegalPage').then((m) => ({ default: m.LegalPage }))) },
      { path: 'credits', element: page(() => import('@/pages/CreditsPage').then((m) => ({ default: m.CreditsPage }))) },
      { path: 'groups', element: page(() => import('@/pages/GroupsPage').then((m) => ({ default: m.GroupsPage }))) },
      { path: 'g/:groupId', element: page(() => import('@/pages/GroupPage').then((m) => ({ default: m.GroupPage }))) },
      { path: 'join/:code', element: page(() => import('@/pages/GroupPage').then((m) => ({ default: m.JoinGroupPage }))) },
      { path: 'clash', element: page(() => import('@/pages/ClashPage').then((m) => ({ default: m.ClashPage }))) },
      { path: 'clash-back/:entryId', element: page(() => import('@/pages/ChainPage').then((m) => ({ default: m.ChainPage }))) },
      { path: 'duel/:entryId/:answerId', element: page(() => import('@/pages/DuelPage').then((m) => ({ default: m.DuelPage }))) },
      { path: 'animals', element: page(() => import('@/pages/AnimalsPage').then((m) => ({ default: m.AnimalsPage }))) },
      { path: 'ranking', element: page(() => import('@/pages/RankingPage').then((m) => ({ default: m.RankingPage }))) },
      { path: 'u/:handle', element: page(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))) },
      { path: 'life', element: page(() => import('@/pages/LifePage').then((m) => ({ default: m.LifePage }))) },
      { path: '*', element: <HomePage /> },
    ],
  },
])
