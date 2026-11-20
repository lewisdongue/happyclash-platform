import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { useRequireSession } from '@/app/requireSession'
import { supabase } from '@/lib/supabase'

interface LiveRow {
  id: string
  title: string
  world_id: string
  ends_at: string
  creator: { handle: string; display_name: string | null; avatar_url: string | null } | null
}

/** Every live Clash happening now, and the button to start your own. */
export function LivesPage() {
  const navigate = useNavigate()
  const requireSession = useRequireSession()
  const { data: lives = [], isLoading } = useQuery({
    queryKey: ['lives'],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clashes')
        .select('id, title, world_id, ends_at, creator:profiles!clashes_creator_id_fkey(handle, display_name, avatar_url)')
        .eq('format', 'live')
        .gt('ends_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as LiveRow[]
    },
  })

  const goLive = () => requireSession('go live', () => navigate('/clash/new?format=live'))

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-[calc(var(--safe-top)+18px)] pb-32 lg:pt-8">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold">Live</h1>
          <p className="text-sm text-muted">Talents on stage, right now.</p>
        </div>
        <button
          type="button"
          onClick={goLive}
          className="pressable flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#ff5b6e,#e0284a)] px-4 text-sm font-extrabold text-white shadow-[0_10px_26px_rgba(224,40,74,.45)]"
        >
          <span className="size-2.5 animate-pulse rounded-full bg-white" />
          Go live
        </button>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {isLoading && [0, 1].map((key) => <div key={key} className="h-28 animate-pulse rounded-2xl bg-fg/6" />)}
        {!isLoading &&
          lives.map((live) => (
            <Link key={live.id} to={`/live/${live.id}`} className="pressable flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-fg/5 p-4">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-fg/10 text-sm font-extrabold">
                {live.creator?.avatar_url ? <img src={live.creator.avatar_url} alt="" className="size-full object-cover" /> : (live.creator?.handle ?? '?').slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-[#ff5b6e] uppercase">
                  <span className="size-2 animate-pulse rounded-full bg-[#ff5b6e]" /> Live · {live.world_id}
                </span>
                <span className="block truncate text-[15px] font-bold">{live.title}</span>
                <span className="block truncate text-xs text-muted">@{live.creator?.handle ?? 'talent'}</span>
              </span>
            </Link>
          ))}
      </div>

      {!isLoading && lives.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="text-lg font-extrabold">No live right now</p>
          <p className="mt-1 text-sm text-muted">Be the first: go live and invite talents on stage.</p>
          <button type="button" onClick={goLive} className="pressable mt-5 h-11 rounded-2xl bg-fg px-5 text-sm font-extrabold text-ink">
            Go live
          </button>
        </div>
      )}
    </div>
  )
}
