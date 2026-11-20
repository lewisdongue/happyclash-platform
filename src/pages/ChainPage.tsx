import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useClashBacks, useEntry } from '@/api/queries'
import { useRequireSession } from '@/app/requireSession'
import { BoltIcon, SparkIcon } from '@/components/icons/ActionIcons'
import { CameraIcon } from '@/components/icons/UiIcons'
import { PageHeader } from '@/components/layout/PageHeader'
import { VideoPlayer } from '@/components/feed/VideoPlayer'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { compactNumber } from '@/lib/format'
import { useWorldTheme } from '@/theme/WorldThemeProvider'

/** Every answer to one video, linked as a chain. Each answer opens a blind duel. */
export function ChainPage() {
  const { entryId } = useParams()
  const { data: original, isLoading } = useEntry(entryId)
  const { data: answers = [] } = useClashBacks(entryId)
  const { setWorld } = useWorldTheme()
  const requireSession = useRequireSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (original) setWorld(original.worldId)
  }, [original, setWorld])

  if (isLoading) return <LoadingState />
  if (!original) return <div className="pt-32"><EmptyState title="This video is no longer available" /></div>

  return (
    <div className="mx-auto min-h-dvh max-w-5xl bg-[radial-gradient(90%_50%_at_30%_0%,var(--world-soft),transparent_60%)] pb-48 lg:px-8 lg:pb-12">
      <PageHeader back title="Clash Backs" subtitle={answers.length === 0 ? 'No answers yet' : `${answers.length} talents answered this video`} />

      <section className="mx-4 mt-2 flex items-center gap-4 lg:mx-0">
        <Link to={`/?v=${original.id}`} className="relative block h-[164px] w-[92px] shrink-0 overflow-hidden rounded-[18px] shadow-[0_0_0_2px_var(--world-a),0_12px_30px_var(--world-glow)]">
          <VideoPlayer entry={original} active />
        </Link>
        <div className="min-w-0">
          <span className="inline-flex h-[22px] items-center rounded-full bg-world-soft px-2.5 text-[10.5px] font-extrabold tracking-wider text-world">ORIGINAL</span>
          <Link to={`/u/${original.author.handle}`} className="mt-2 block text-base font-extrabold"><span translate="no" className="notranslate">@{original.author.handle}</span></Link>
          <p className="mt-1 text-[13px] leading-snug text-muted">{original.caption}</p>
        </div>
      </section>

      <h2 className="mx-4 mt-8 mb-3 text-[15px] font-extrabold lg:mx-0">The chain</h2>
      {answers.length === 0 ? (
        <EmptyState title="Nobody has answered yet">Record your take on this video. The first Clash Back starts the chain.</EmptyState>
      ) : (
        <div className="relative">
          <span aria-hidden="true" className="absolute inset-x-0 top-[131px] h-0.5 bg-[linear-gradient(90deg,var(--world-a),var(--world-soft))] shadow-[0_0_12px_var(--world-glow)]" />
          <ol className="no-scrollbar relative flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:px-0">
            {answers.map((answer, index) => (
              <li key={answer.id} className="relative shrink-0 snap-start">
                <Link to={`/duel/${original.id}/${answer.id}`} className="pressable relative block h-[262px] w-[148px] overflow-hidden rounded-[22px] border border-fg/8">
                  <VideoPlayer entry={answer} active={false} />
                  <span className="absolute inset-x-0 bottom-0 p-2.5">
                    <span className="block text-[13px] font-extrabold"><span translate="no" className="notranslate">{answer.author.displayName}</span></span>
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-world">
                      <SparkIcon size={12} /> {compactNumber(answer.sparks)}
                    </span>
                  </span>
                </Link>
                {index < answers.length - 1 && (
                  <span aria-hidden="true" className="absolute top-1/2 -right-[17px] z-10 grid size-[22px] -translate-y-1/2 place-items-center rounded-full border-[1.5px] border-world bg-ink">
                    <BoltIcon size={12} />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="fixed inset-x-4 bottom-[calc(var(--safe-bottom)+104px)] z-10 lg:static lg:mt-10 lg:max-w-md">
        <button
          type="button"
          onClick={() => requireSession('post a Clash Back', () => navigate(`/create?answer=${original.id}`))}
          className="pressable flex h-[62px] w-full items-center justify-center gap-3 rounded-[22px] bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-base font-extrabold text-world-ink shadow-[0_14px_34px_var(--world-glow)]"
        >
          <span className="grid size-[38px] place-items-center rounded-xl bg-black/14">
            <CameraIcon />
          </span>
          Answer with your talent
        </button>
        <p className="mt-2.5 text-center text-xs text-muted">Up to 60 seconds · your answer joins the chain</p>
      </div>
    </div>
  )
}
