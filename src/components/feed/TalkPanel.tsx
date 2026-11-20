import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { useComments } from '@/api/queries'
import { deleteComment, fetchMyCommentLikes, postComment, setCommentLike } from '@/api/social'
import { adjustEntryCounts, useEntryCounts } from '@/app/realtime'
import { useRequireSession } from '@/app/requireSession'
import { useSession } from '@/app/session'
import { ReportSheet } from '@/components/safety/ReportSheet'
import { useBlockTalent } from '@/components/safety/useBlockTalent'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { compactNumber, timeAgo } from '@/lib/format'
import type { Comment, Entry } from '@/types/domain'

/** One tap sends these as a whole comment. */
const QUICK_REACTIONS = ['🔥', '👏', '😂', '😍', '💯', '🤯']

/**
 * The conversation under a video: likes, one level of replies, quick
 * reactions, and deletion by the comment's author or the video's owner.
 * Everything updates live for every viewer through the entry broadcast.
 */
export function TalkPanel({ entry, open, onClose }: { entry: Entry; open: boolean; onClose: () => void }) {
  const session = useSession()
  const toast = useToast()
  const queryClient = useQueryClient()
  const requireSession = useRequireSession()
  const counts = useEntryCounts(entry, open)
  const { data: comments = [], isLoading, isError, refetch } = useComments(entry.id, open)
  const { data: liked = new Set<string>() } = useQuery({
    queryKey: ['comment-likes', entry.id, session?.user.id],
    queryFn: () => fetchMyCommentLikes(entry.id, session!.user.id),
    enabled: open && Boolean(session),
  })
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [reporting, setReporting] = useState<Comment | null>(null)
  const blockTalent = useBlockTalent()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const input = useRef<HTMLInputElement>(null)

  const threads = useMemo(() => {
    const tops = comments.filter((comment) => comment.parentId === null)
    return tops.map((top) => ({ top, replies: comments.filter((comment) => comment.parentId === top.id) }))
  }, [comments])

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['comments', entry.id] }),
    queryClient.invalidateQueries({ queryKey: ['comment-likes', entry.id] }),
  ])

  const send = (text: string = draft) =>
    requireSession('join the conversation', async (current) => {
      const body = text.trim()
      if (!body) return
      const parent = replyTo
      // Counted before the request: the live broadcast then sets the exact total.
      adjustEntryCounts(queryClient, entry.id, { comments: 1 })
      if (text === draft) setDraft('')
      setReplyTo(null)
      if (parent) setExpanded((set) => new Set(set).add(parent.parentId ?? parent.id))
      try {
        await postComment(entry.id, current.user.id, body, parent?.parentId ?? parent?.id ?? null)
        await refresh()
      } catch {
        adjustEntryCounts(queryClient, entry.id, { comments: -1 })
        if (text === draft) setDraft(body)
        toast('Your comment could not be sent. Try again.')
      }
    })

  const toggleLike = (comment: Comment) =>
    requireSession('like this comment', async (current) => {
      const on = !liked.has(comment.id)
      const key = ['comment-likes', entry.id, current.user.id]
      queryClient.setQueryData<Set<string>>(key, (set) => {
        const next = new Set(set)
        if (on) next.add(comment.id)
        else next.delete(comment.id)
        return next
      })
      queryClient.setQueryData<Comment[]>(['comments', entry.id], (list) =>
        list?.map((item) => (item.id === comment.id ? { ...item, likes: Math.max(0, item.likes + (on ? 1 : -1)) } : item)),
      )
      navigator.vibrate?.(8)
      try {
        await setCommentLike(comment.id, current.user.id, on)
      } catch {
        await refresh()
      }
    })

  const remove = async (comment: Comment) => {
    const removed = 1 + (comment.parentId === null ? comment.replies : 0)
    adjustEntryCounts(queryClient, entry.id, { comments: -removed })
    queryClient.setQueryData<Comment[]>(['comments', entry.id], (list) => list?.filter((item) => item.id !== comment.id && item.parentId !== comment.id))
    try {
      await deleteComment(comment.id)
      await refresh()
    } catch {
      adjustEntryCounts(queryClient, entry.id, { comments: removed })
      await refresh()
      toast('The comment could not be deleted.')
    }
  }

  const canDelete = (comment: Comment) => Boolean(session && (session.user.id === comment.author.id || session.user.id === entry.author.id))

  const row = (comment: Comment, reply = false) => {
    const isLiked = liked.has(comment.id)
    return (
      <motion.div layout="position" key={comment.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={clsx('flex gap-3', reply && 'mt-3 ml-11')}>
        <Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size={reply ? 28 : 36} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            <span className="font-extrabold text-text/90"><span translate="no" className="notranslate">{comment.author.handle}</span></span>
            {comment.author.id === entry.author.id && <span className="ml-1.5 rounded bg-world-soft px-1.5 py-px text-[10px] font-extrabold text-world">Creator</span>}
            <span className="ml-2">{timeAgo(comment.createdAt)}</span>
          </p>
          <p className="mt-0.5 text-[14.5px] leading-snug break-words whitespace-pre-line">{comment.body}</p>
          <div className="mt-1.5 flex items-center gap-4 text-xs font-bold text-muted">
            <button
              type="button"
              onClick={() => {
                setReplyTo(comment)
                input.current?.focus()
              }}
              className="hover:text-text"
            >
              Reply
            </button>
            {canDelete(comment) && (
              <button type="button" onClick={() => void remove(comment)} className="hover:text-[#ff8fa3]">
                Delete
              </button>
            )}
            {session?.user.id !== comment.author.id && (
              <button type="button" onClick={() => setReporting(comment)} className="hover:text-[#ff8fa3]">
                Report
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => toggleLike(comment)}
          aria-pressed={isLiked}
          aria-label={isLiked ? 'Unlike comment' : 'Like comment'}
          className="pressable flex w-9 shrink-0 flex-col items-center pt-1"
        >
          <motion.svg key={String(isLiked)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.2 1.7-2 3.2-3.2 5.3-3.2 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"
              fill={isLiked ? '#ff4d6d' : 'none'}
              stroke={isLiked ? '#ff4d6d' : 'currentColor'}
              strokeWidth="1.8"
            />
          </motion.svg>
          <span className={clsx('tabular mt-0.5 text-[11px] font-bold', isLiked ? 'text-[#ff8fa3]' : 'text-muted')}>{comment.likes > 0 ? compactNumber(comment.likes) : ''}</span>
        </button>
      </motion.div>
    )
  }

  return (
    <>
      <Sheet open={open} title={`Talk · ${counts.comments.toLocaleString('en-US')}`} onClose={onClose}>
        <div className="no-scrollbar mb-3 max-h-[46dvh] min-h-[120px] overflow-y-auto overscroll-contain">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : isError ? (
            <button type="button" onClick={() => void refetch()} className="w-full py-8 text-center text-sm text-muted">
              The conversation could not load. Tap to retry.
            </button>
          ) : threads.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No comments yet. Start the conversation.</p>
          ) : (
            <div className="space-y-5 pb-1">
              {threads.map(({ top, replies }) => {
                const open = expanded.has(top.id)
                return (
                  <div key={top.id}>
                    {row(top)}
                    {replies.length > 0 && (
                      <>
                        <AnimatePresence initial={false}>{open && replies.map((reply) => row(reply, true))}</AnimatePresence>
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((set) => {
                              const next = new Set(set)
                              if (open) next.delete(top.id)
                              else next.add(top.id)
                              return next
                            })
                          }
                          className="mt-2 ml-11 flex items-center gap-2 text-xs font-extrabold text-muted hover:text-text"
                        >
                          <span className="h-px w-6 bg-fg/20" />
                          {open ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => send(emoji)} aria-label={`Send ${emoji}`} className="pressable grid h-9 min-w-11 place-items-center rounded-full bg-fg/6 text-lg">
              {emoji}
            </button>
          ))}
        </div>

        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-world-soft px-3 py-1.5 text-xs font-bold">
            <span>
              Replying to <span className="text-world"><span translate="no" className="notranslate">@{replyTo.author.handle}</span></span>
            </span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="px-1 text-base leading-none text-muted">
              ×
            </button>
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
        >
          <label className="sr-only" htmlFor={`talk-${entry.id}`}>
            Add a comment
          </label>
          <input
            ref={input}
            id={`talk-${entry.id}`}
            value={draft}
            maxLength={500}
            enterKeyHint="send"
            onChange={(event) => setDraft(event.target.value)}
            placeholder={replyTo ? `Reply to @${replyTo.author.handle}…` : 'Say something kind…'}
            className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-fg/5 px-4 text-[16px] outline-none placeholder:text-subtle focus:border-world"
          />
          <button type="submit" disabled={!draft.trim()} className="pressable h-12 rounded-2xl bg-world px-5 text-sm font-extrabold text-world-ink disabled:opacity-40">
            Send
          </button>
        </form>
      </Sheet>

      {reporting && (
        <ReportSheet
          open
          onClose={() => setReporting(null)}
          target="comment"
          targetId={reporting.id}
          onBlock={() => blockTalent(reporting.author, true)}
          blockLabel={`Block @${reporting.author.handle}`}
        />
      )}
    </>
  )
}
