import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'
import { isStaleBuildError, reloadForNewBuild } from '@/lib/chunkReload'

/** Shown instead of a raw stack trace when a page fails to render. */
export function RouteError() {
  const error = useRouteError()
  const stale = isStaleBuildError(error)

  useEffect(() => {
    if (stale) reloadForNewBuild()
  }, [stale])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-ink px-6 text-center text-text">
      <img src="/mark.png" alt="" className="size-14 object-contain" />
      <p className="text-xl font-extrabold">{stale ? 'happyClash just got better' : 'This page hit a snag'}</p>
      <p className="max-w-sm text-sm text-muted">{stale ? 'Loading the new version…' : 'Reload to try again. If it keeps happening, go back home.'}</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => window.location.reload()} className="pressable h-12 rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] px-6 text-sm font-extrabold text-world-ink">
          Reload
        </button>
        <Link to="/" reloadDocument className="pressable grid h-12 place-items-center rounded-2xl bg-fg/8 px-6 text-sm font-extrabold">
          Home
        </Link>
      </div>
    </div>
  )
}
