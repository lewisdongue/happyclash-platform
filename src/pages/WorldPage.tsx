import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useClashes, useWorldEntries } from '@/api/queries'
import { ClashCard } from '@/components/clash/ClashCard'
import { liveStatus, useNow } from '@/components/clash/Countdown'
import { SparkIcon } from '@/components/icons/ActionIcons'
import { PlusIcon } from '@/components/icons/UiIcons'
import { PageHeader } from '@/components/layout/PageHeader'
import { Model3D } from '@/components/three/Model3D'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { compactNumber } from '@/lib/format'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import { WORLDS } from '@/theme/worlds'
import type { Author, WorldId } from '@/types/domain'

/**
 * One Talent World: its emblem in 3D, the talents leading it, its live
 * Clashes and its best videos. Everything comes from the database.
 */
export function WorldPage({ fixedWorld }: { fixedWorld?: WorldId } = {}) {
  const { worldId = fixedWorld } = useParams()
  const world = worldId && worldId in WORLDS ? WORLDS[worldId as WorldId] : undefined
  const navigate = useNavigate()
  const { setWorld } = useWorldTheme()
  const { data: entries = [], isLoading } = useWorldEntries(world?.id)
  const { data: clashes = [] } = useClashes()
  const now = useNow(30_000)

  useEffect(() => {
    if (world) setWorld(world.id)
  }, [world, setWorld])

  const leaders = useMemo(() => {
    const totals = new Map<string, { author: Author; sparks: number; videos: number }>()
    for (const entry of entries) {
      const current = totals.get(entry.author.id) ?? { author: entry.author, sparks: 0, videos: 0 }
      current.sparks += entry.sparks
      current.videos += 1
      totals.set(entry.author.id, current)
    }
    return [...totals.values()].sort((a, b) => b.sparks - a.sparks || b.videos - a.videos).slice(0, 5)
  }, [entries])

  if (!world) {
    return (
      <div className="pt-32">
        <EmptyState title="This world does not exist" />
      </div>
    )
  }

  const worldClashes = clashes.filter((clash) => clash.worldId === world.id && liveStatus(clash, now) !== 'ended')
  const totalSparks = entries.reduce((sum, entry) => sum + entry.sparks, 0)

  return (
    <div className="relative mx-auto min-h-dvh max-w-6xl pb-36 lg:px-8 lg:pb-12">
      <div aria-hidden="true" className="animate-breathe pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(70%_80%_at_50%_0%,var(--world-soft),transparent_70%)]" />
      <div className="relative">
        <PageHeader back title="" />

        <section className="flex flex-col items-center px-4 text-center lg:flex-row lg:items-center lg:gap-10 lg:text-left">
          <Model3D model={world.id} label={`${world.name} emblem`} interactive spin={14} className="size-[220px] shrink-0 lg:size-[300px]" />
          <div>
            <p className="text-[11px] font-extrabold tracking-[.3em] text-world uppercase">Talent World</p>
            <h1 className="mt-1 text-[44px] leading-none font-extrabold tracking-tight lg:text-[64px]">{world.name}</h1>
            <p className="mt-3 text-sm text-muted">
              {entries.length} {entries.length === 1 ? 'video' : 'videos'} · {leaders.length} {leaders.length === 1 ? 'talent' : 'talents'} ·{' '}
              {compactNumber(totalSparks)} Sparks
            </p>
            <div className="mt-5 flex justify-center gap-2 lg:justify-start">
              <button
                type="button"
                onClick={() => navigate(`/create?world=${world.id}`)}
                className="pressable flex h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] px-5 text-sm font-extrabold text-world-ink shadow-[0_12px_30px_var(--world-glow)]"
              >
                <PlusIcon size={18} /> Post in {world.name}
              </button>
              <Link to={`/clash/new?world=${world.id}`} className="pressable grid h-12 place-items-center rounded-2xl border border-fg/12 bg-fg/6 px-5 text-sm font-extrabold">
                Start a Clash
              </Link>
            </div>
          </div>
        </section>

        {leaders.length > 0 && (
          <>
            <h2 className="mx-4 mt-10 mb-3 text-[15px] font-extrabold lg:mx-0">Leading {world.name}</h2>
            <ol className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 lg:px-0">
              {leaders.map((leader, index) => (
                <li key={leader.author.id}>
                  <Link to={`/u/${leader.author.handle}`} className="pressable flex w-[132px] flex-col items-center rounded-3xl border border-line bg-fg/[.035] p-4 text-center">
                    <span className="relative">
                      <Avatar name={leader.author.displayName} src={leader.author.avatarUrl} size={56} ring={index === 0} />
                      <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-world text-[11px] font-extrabold text-world-ink">{index + 1}</span>
                    </span>
                    <span className="mt-2 w-full truncate text-sm font-extrabold"><span translate="no" className="notranslate">{leader.author.displayName}</span></span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-muted">
                      <SparkIcon size={11} /> {compactNumber(leader.sparks)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )}

        {worldClashes.length > 0 && (
          <>
            <h2 className="mx-4 mt-8 mb-3 text-[15px] font-extrabold lg:mx-0">Clashes in {world.name}</h2>
            <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:px-0">
              {worldClashes.map((clash) => (
                <ClashCard key={clash.id} clash={clash} />
              ))}
            </div>
          </>
        )}

        <h2 className="mx-4 mt-8 mb-3 text-[15px] font-extrabold lg:mx-0">Best videos</h2>
        {isLoading ? (
          <LoadingState />
        ) : entries.length === 0 ? (
          <EmptyState title={`No ${world.name} video yet`}>Be the first talent of this world.</EmptyState>
        ) : (
          <ul className="grid grid-cols-3 gap-1.5 px-4 sm:grid-cols-4 lg:grid-cols-6 lg:gap-3 lg:px-0">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link to={`/?v=${entry.id}`} data-theme="dark" className="group relative block aspect-[9/16] overflow-hidden rounded-xl lg:rounded-2xl" style={{ background: world.scene }}>
                  {entry.posterUrl && <img src={entry.posterUrl} alt={entry.caption} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-[linear-gradient(transparent,rgba(5,6,8,.85))] p-2 text-[11px] font-extrabold">
                    <SparkIcon size={11} /> {compactNumber(entry.sparks)}
                    <span className="ml-auto truncate pl-1 text-fg/70"><span translate="no" className="notranslate">@{entry.author.handle}</span></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
