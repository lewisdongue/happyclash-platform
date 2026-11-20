import { PageHeader } from '@/components/layout/PageHeader'
import { Model3D } from '@/components/three/Model3D'
import { MODEL_CREDITS } from '@/lib/assets'
import { LIFE_CREDITS } from '@/life/assets'

/** Attribution for the 3D models, as their CC BY 4.0 license requires. */
export function CreditsPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-4xl pb-36 lg:px-8 lg:pb-12">
      <PageHeader back title="3D credits" subtitle="Models from Sketchfab, licensed CC BY 4.0" />
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 sm:grid-cols-2 lg:px-0">
        {MODEL_CREDITS.map((credit) => (
          <li key={credit.key} className="flex min-w-0 items-center gap-4 rounded-3xl border border-line bg-fg/[.035] p-3">
            <Model3D model={credit.key} label={credit.title} className="size-20 shrink-0" />
            <div className="min-w-0 flex-1 text-sm">
              <a href={credit.url} target="_blank" rel="noreferrer" className="block truncate font-extrabold hover:text-world">
                {credit.title}
              </a>
              <p className="text-muted">by {credit.author}</p>
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="text-xs text-subtle hover:text-text">
                CC BY 4.0
              </a>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 mb-3 px-5 text-[11px] font-extrabold tracking-widest text-muted uppercase lg:px-1">Life world</h2>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 px-4 sm:grid-cols-2 lg:px-0">
        {LIFE_CREDITS.map((credit) => (
          <li key={credit.url} className="min-w-0 rounded-2xl border border-line bg-fg/[.035] px-4 py-3 text-sm">
            <a href={credit.url} target="_blank" rel="noreferrer" className="block truncate font-extrabold hover:text-world">
              {credit.title}
            </a>
            <p className="text-muted">
              by {credit.author} ·{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="hover:text-text">
                CC BY 4.0
              </a>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
