import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import clsx from 'clsx'
import { useDuelResults, useEntry } from '@/api/queries'
import { castDuelVote } from '@/api/social'
import { useRequireSession } from '@/app/requireSession'
import { BoltIcon } from '@/components/icons/ActionIcons'
import { FlipIcon } from '@/components/icons/UiIcons'
import { DuelCard } from '@/components/duel/DuelCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import type { Entry } from '@/types/domain'

type Side = 'original' | 'answer'
const SIDE_B_COLOR = '#6FB8FF'
const LABEL: Record<Side, string> = { original: 'Talent A', answer: 'Talent B' }

/**
 * Blind duel between a video and one of its answers. On phones the card
 * flips in 3D between both talents; on desktop they face each other.
 */
export function DuelPage() {
  const { entryId, answerId } = useParams()
  const { data: original, isLoading: loadingA } = useEntry(entryId)
  const { data: answer, isLoading: loadingB } = useEntry(answerId)
  const isDesktop = useIsDesktop()
  const { setWorld } = useWorldTheme()
  const requireSession = useRequireSession()
  const toast = useToast()
  const queryClient = useQueryClient()
  // One video at a time: A plays first, then B, then A again. Tapping a side gives it the turn.
  const [playing, setPlaying] = useState<Side>('original')
  const flipped = playing === 'answer'
  const other = (side: Side): Side => (side === 'original' ? 'answer' : 'original')
  const [vote, setVote] = useState<Side | null>(null)
  const { data: results } = useDuelResults(entryId, answerId, vote !== null)

  useEffect(() => {
    if (original) setWorld(original.worldId)
  }, [original, setWorld])

  if (loadingA || loadingB) return <LoadingState />
  if (!original || !answer) return <div className="pt-32"><EmptyState title="This duel is no longer available" /></div>

  const cast = (side: Side) =>
    requireSession('vote', async (session) => {
      navigator.vibrate?.(18)
      try {
        await castDuelVote(session.user.id, original.id, answer.id, side)
        setVote(side)
        await queryClient.invalidateQueries({ queryKey: ['duel-results', original.id, answer.id] })
      } catch {
        toast('You already voted in this duel')
        setVote(side)
      }
    })

  const header = (
    <div className="flex h-9 items-center gap-2 rounded-full bg-fg/7 px-3.5 text-xs font-extrabold">
      <BoltIcon size={14} /> Blind duel
    </div>
  )

  return (
    <div className="mx-auto min-h-dvh max-w-6xl bg-[radial-gradient(90%_55%_at_50%_35%,var(--world-soft),transparent_65%)] pb-40 lg:px-8 lg:pb-12">
      <PageHeader back title="Duel" actions={header} />

      {isDesktop ? (
        <div className="mt-4 flex items-center justify-center gap-12">
          <DesktopSide entry={original} side="original" tilt={6} playing={playing} onPlay={setPlaying} vote={vote} results={results} onVote={cast} />
          <div className="animate-float grid size-[84px] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#d9dceb_40%,#6e7598)] text-[26px] font-extrabold text-ink shadow-[0_20px_50px_rgba(0,0,0,.6)]">
            VS
          </div>
          <DesktopSide entry={answer} side="answer" tilt={-6} playing={playing} onPlay={setPlaying} vote={vote} results={results} onVote={cast} />
        </div>
      ) : (
        <>
          <div className="mt-2 flex justify-center [perspective:1400px]">
            <motion.div
              className="relative h-[min(60dvh,540px)] w-[min(76vw,304px)] [transform-style:preserve-3d]"
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <DuelCard entry={original} label={LABEL.original} active={!flipped} revealed={vote !== null} onEnded={() => setPlaying('answer')} />
              <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                <DuelCard entry={answer} label={LABEL.answer} active={flipped} revealed={vote !== null} onEnded={() => setPlaying('original')} />
              </div>
            </motion.div>
          </div>

          <div className="fixed inset-x-4 bottom-[calc(var(--safe-bottom)+100px)] flex flex-col gap-2.5">
            {vote ? (
              <Results vote={vote} results={results} />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPlaying(other)}
                  className="pressable flex h-[46px] items-center justify-center gap-2 rounded-2xl border border-fg/14 bg-fg/6 text-sm font-bold"
                >
                  <FlipIcon /> {flipped ? 'Flip back to Talent A' : 'Flip to Talent B'}
                </button>
                <div className="grid grid-cols-2 gap-2.5">
                  <VoteButton side="original" onVote={cast} />
                  <VoteButton side="answer" onVote={cast} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function VoteButton({ side, onVote }: { side: Side; onVote: (side: Side) => void }) {
  return (
    <button
      type="button"
      onClick={() => onVote(side)}
      className={clsx(
        'pressable h-14 w-full rounded-[18px] text-[15px] font-extrabold',
        side === 'original'
          ? 'bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-world-ink shadow-[0_12px_30px_var(--world-glow)]'
          : 'bg-[linear-gradient(180deg,#9ccbff,#4f8dd8)] text-[#06101a] shadow-[0_12px_30px_rgba(80,150,255,.4)]',
      )}
    >
      Vote {side === 'original' ? 'A' : 'B'}
    </button>
  )
}

function percent(results: { original: number; answer: number } | undefined, side: Side): number {
  if (!results) return 0
  const total = results.original + results.answer
  return total === 0 ? 0 : Math.round((results[side] / total) * 100)
}

function Results({ vote, results }: { vote: Side; results?: { original: number; answer: number } }) {
  const total = results ? results.original + results.answer : 0
  return (
    <div className="rounded-[20px] border border-fg/10 bg-fg/6 p-4" aria-live="polite">
      <p className="mb-3 text-sm font-extrabold">
        You voted for {LABEL[vote]} · {total} {total === 1 ? 'vote' : 'votes'} so far
      </p>
      {(['original', 'answer'] as const).map((side) => (
        <div key={side} className="mb-2 last:mb-0">
          <div className="flex justify-between text-[13px] font-bold">
            <span>{LABEL[side]}</span>
            <span>{percent(results, side)}%</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-fg/8">
            <motion.div
              className="h-full rounded-full"
              style={{ background: side === 'original' ? 'var(--world-a)' : SIDE_B_COLOR }}
              initial={{ width: 0 }}
              animate={{ width: `${percent(results, side)}%` }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

interface DesktopSideProps {
  entry: Entry
  side: Side
  tilt: number
  playing: Side
  onPlay: (side: Side) => void
  vote: Side | null
  results?: { original: number; answer: number }
  onVote: (side: Side) => void
}

function DesktopSide({ entry, side, tilt, playing, onPlay, vote, results, onVote }: DesktopSideProps) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative aspect-[9/16] h-[min(68vh,660px)]" style={{ transform: `perspective(1200px) rotateY(${tilt}deg)` }}>
        <DuelCard
          entry={entry}
          label={LABEL[side]}
          active={playing === side}
          revealed={vote !== null}
          onEnded={() => onPlay(side === 'original' ? 'answer' : 'original')}
          onSelect={() => onPlay(side)}
        />
      </div>
      {vote ? (
        <p className="text-2xl font-extrabold" style={{ color: side === 'original' ? 'var(--world-a)' : SIDE_B_COLOR }}>
          {percent(results, side)}%
        </p>
      ) : (
        <div className="w-56">
          <VoteButton side={side} onVote={onVote} />
        </div>
      )}
    </div>
  )
}
