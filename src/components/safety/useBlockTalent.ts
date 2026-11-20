import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { describeSafetyError, setBlocked } from '@/api/safety'
import { useRequireSession } from '@/app/requireSession'
import { useToast } from '@/components/ui/Toast'
import type { Entry } from '@/types/domain'

/**
 * Block or unblock a talent. Everything they posted disappears from the
 * viewer's screens at once, and follows between the two are removed.
 */
export function useBlockTalent() {
  const requireSession = useRequireSession()
  const queryClient = useQueryClient()
  const toast = useToast()

  return (talent: { id: string; handle: string }, block: boolean) =>
    requireSession(block ? `block @${talent.handle}` : `unblock @${talent.handle}`, async (session) => {
      try {
        await setBlocked(session.user.id, talent.id, block)
        if (block) {
          // The feed is never reshuffled under the viewer: their videos are just taken out.
          queryClient.setQueriesData<InfiniteData<Entry[]>>({ queryKey: ['feed'] }, (data) =>
            data ? { ...data, pages: data.pages.map((page) => page.filter((entry) => entry.author.id !== talent.id)) } : data,
          )
        }
        // Comments, rankings, profiles and lists all depend on who is blocked.
        await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'feed' })
        toast(block ? `@${talent.handle} is blocked` : `@${talent.handle} is unblocked`)
      } catch (caught) {
        toast(describeSafetyError(caught))
      }
    })
}
