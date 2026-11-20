import { useShare } from '@/components/ui/ShareSheet'
import { useRef, useState, type ReactNode } from 'react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import clsx from 'clsx'
import { deleteEntry } from '@/api/entries'
import { useSession } from '@/app/session'
import { ReportSheet } from '@/components/safety/ReportSheet'
import { useBlockTalent } from '@/components/safety/useBlockTalent'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import type { Entry } from '@/types/domain'

type View = 'menu' | 'delete'

/** Removes an entry from every list on screen, without waiting for a refetch. */
export function useForgetEntry() {
  const queryClient = useQueryClient()
  return (entryId: string) => {
    queryClient.setQueriesData<InfiniteData<Entry[]>>({ queryKey: ['feed'] }, (data) =>
      data ? { ...data, pages: data.pages.map((page) => page.filter((entry) => entry.id !== entryId)) } : data,
    )
    for (const key of ['author-entries', 'clash-backs', 'clash-entries']) {
      queryClient.setQueriesData<Entry[]>({ queryKey: [key] }, (list) => list?.filter((entry) => entry.id !== entryId))
    }
    queryClient.removeQueries({ queryKey: ['entry', entryId] })
    void queryClient.invalidateQueries({ queryKey: ['profile-stats'] })
    void queryClient.invalidateQueries({ queryKey: ['ranking'] })
  }
}

/** The ⋯ menu of a video: share its link, report it, or delete it when it is yours. */
export function EntryOptions({ entry, className }: { entry: Entry; className?: string }) {
  const session = useSession()
  const toast = useToast()
  const shareLink = useShare()
  const forget = useForgetEntry()
  const blockTalent = useBlockTalent()
  const [reporting, setReporting] = useState(false)
  const reported = useRef(false)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('menu')
  const [busy, setBusy] = useState(false)
  const mine = session?.user.id === entry.author.id

  const close = () => {
    setOpen(false)
    setView('menu')
  }

  const copyLink = () => {
    close()
    shareLink({ title: `${entry.author.displayName} on happyClash`, url: `${window.location.origin}/?v=${entry.id}` })
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteEntry(entry)
      forget(entry.id)
      toast('Your video was deleted')
      close()
    } catch {
      toast('The video could not be deleted. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="More options"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
        className={clsx('pressable grid size-[30px] place-items-center rounded-full border border-line bg-ink/45 backdrop-blur-md', className)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      <Sheet open={open} title={view === 'delete' ? 'Delete this video?' : 'Video'} onClose={close}>
        {view === 'menu' && (
          <div className="flex flex-col gap-2">
            {mine && entry.hidden && (
              <p className="mb-2 rounded-2xl bg-[#ff4d6d]/12 p-3 text-sm text-[#ffb3c1]">
                Several talents reported this video, so only you can see it now.
              </p>
            )}
            <MenuButton onClick={copyLink}>Share the video link</MenuButton>
            {mine ? (
              <MenuButton danger onClick={() => setView('delete')}>
                Delete the video
              </MenuButton>
            ) : (
              <>
                <MenuButton
                  danger
                  onClick={() => {
                    close()
                    setReporting(true)
                  }}
                >
                  Report the video
                </MenuButton>
                <MenuButton
                  danger
                  onClick={() => {
                    close()
                    blockTalent(entry.author, true)
                  }}
                >
                  Block <span translate="no" className="notranslate">@{entry.author.handle}</span>
                </MenuButton>
              </>
            )}
          </div>
        )}

        {view === 'delete' && (
          <div>
            <p className="mb-5 text-sm text-muted">It disappears from the feed, your profile, Clashes and rankings. This cannot be undone.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setView('menu')} className="pressable h-12 rounded-2xl bg-fg/8 text-sm font-extrabold">
                Keep it
              </button>
              <button type="button" onClick={remove} disabled={busy} className="pressable h-12 rounded-2xl bg-[#ff4d6d] text-sm font-extrabold text-white disabled:opacity-60">
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <ReportSheet
        open={reporting}
        onClose={() => {
          setReporting(false)
          // The reporter stops seeing the video once the confirmation is closed.
          if (reported.current) forget(entry.id)
        }}
        target="entry"
        targetId={entry.id}
        onReported={() => {
          reported.current = true
        }}
        onBlock={() => blockTalent(entry.author, true)}
        blockLabel={`Block @${entry.author.handle}`}
      />
    </>
  )
}

function MenuButton({ children, onClick, danger = false, disabled = false }: { children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx('pressable h-12 w-full rounded-2xl border border-line bg-fg/4 px-4 text-left text-[15px] font-bold disabled:opacity-50', danger && 'text-[#ff8fa3]')}
    >
      {children}
    </button>
  )
}
