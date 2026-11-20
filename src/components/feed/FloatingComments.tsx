import { useComments } from '@/api/queries'

/** The two latest comments drift up the edge of the active video. Nothing shows when there are none. */
export function FloatingComments({ entryId, active }: { entryId: string; active: boolean }) {
  const { data: comments = [] } = useComments(entryId, active)
  if (!active || comments.length === 0) return null

  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      {comments.slice(0, 2).map((comment, index) => (
        <span
          key={comment.id}
          className="animate-bubble max-w-[200px] rounded-[14px_14px_14px_4px] bg-fg/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-md"
          style={{ animationDelay: `${index * 2}s` }}
        >
          {comment.body}
        </span>
      ))}
    </div>
  )
}
