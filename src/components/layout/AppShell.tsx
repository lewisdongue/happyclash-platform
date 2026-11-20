import { Outlet } from 'react-router'
import { useRouteAppearance } from '@/app/appearance'
import { useNotificationsRealtime } from '@/app/realtime'
import { useSession } from '@/app/session'
import { Dock } from './Dock'
import { TopNav } from './TopNav'

/** Phones get the floating dock, desktops get the top bar. Pages decide the rest. */
export function AppShell() {
  useRouteAppearance()
  useNotificationsRealtime(useSession()?.user.id)
  return (
    <div className="relative min-h-full">
      <TopNav />
      <Outlet />
      <Dock />
    </div>
  )
}
