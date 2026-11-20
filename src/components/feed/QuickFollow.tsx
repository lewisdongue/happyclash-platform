import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useQueryClient } from '@tanstack/react-query'
import { useMyFollowing } from '@/api/queries'
import { describeSafetyError } from '@/api/safety'
import { setFollow } from '@/api/social'
import { useRequireSession } from '@/app/requireSession'
import { useSession } from '@/app/session'
import { useToast } from '@/components/ui/Toast'
import type { Author } from '@/types/domain'

type State = 'idle' | 'busy' | 'done'

/**
 * Gold-to-red "+" beside a talent's name in the feed: follow without
 * leaving the video. It turns into a check, then steps aside.
 */
export function QuickFollow({ author }: { author: Pick<Author, 'id' | 'handle'> }) {
  const session = useSession()
  const requireSession = useRequireSession()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: following } = useMyFollowing(session?.user.id)
  const [state, setState] = useState<State>('idle')

  // After the check has been seen, the button leaves for good.
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (state !== 'done') return
    const timer = window.setTimeout(() => setGone(true), 1400)
    return () => window.clearTimeout(timer)
  }, [state])

  const isMe = session?.user.id === author.id
  const alreadyFollowing = state !== 'done' && Boolean(following?.has(author.id))
  if (isMe || alreadyFollowing || (session && !following)) return null

  const follow = () =>
    requireSession(`follow @${author.handle}`, async (current) => {
      if (current.user.id === author.id || state !== 'idle') return
      setState('busy')
      try {
        await setFollow(current.user.id, author.id, true)
        setState('done')
        queryClient.setQueryData<Set<string>>(['my-following', current.user.id], (set) => new Set(set ?? []).add(author.id))
        void queryClient.invalidateQueries({ queryKey: ['is-following'] })
        void queryClient.invalidateQueries({ queryKey: ['profile-stats'] })
        void queryClient.invalidateQueries({ queryKey: ['feed', 'following'] })
      } catch (caught) {
        setState('idle')
        // Already following (another tab, another device): just reflect it.
        if (typeof caught === 'object' && caught && 'code' in caught && caught.code === '23505') {
          void queryClient.invalidateQueries({ queryKey: ['my-following'] })
          return
        }
        toast(describeSafetyError(caught))
      }
    })

  return (
    <AnimatePresence>
      {!gone && (
        <motion.button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            follow()
          }}
          disabled={state !== 'idle'}
          aria-label={state === 'done' ? `Following @${author.handle}` : `Follow @${author.handle}`}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          whileTap={{ scale: 0.85 }}
          className="relative grid size-[26px] shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#FFE27A_0%,#FFB23E_45%,#FF3D5A_100%)] text-[#2a0a0e] shadow-[0_4px_14px_rgba(255,90,70,.55),inset_0_1px_0_rgba(255,255,255,.7)]"
        >
          {state === 'idle' && <span aria-hidden="true" className="animate-ping-ring absolute inset-0 rounded-full border-2 border-[#FFB23E]/70" />}
          <AnimatePresence mode="wait" initial={false}>
            {state === 'done' ? (
              <motion.svg key="check" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            ) : (
              <motion.svg key="plus" exit={{ scale: 0 }} viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className={state === 'busy' ? 'animate-spin-slow' : undefined}>
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
