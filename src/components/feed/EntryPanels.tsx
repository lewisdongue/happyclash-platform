import { useShare } from '@/components/ui/ShareSheet'
import { useState } from 'react'
import { boostEntry } from '@/api/social'
import { useSession } from '@/app/session'
import { useRequireSession } from '@/app/requireSession'
import { BoostIcon } from '@/components/icons/ActionIcons'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import type { Entry } from '@/types/domain'
import type { EntryPanel } from './ActionString'
import { TalkPanel } from './TalkPanel'

interface EntryPanelsProps {
  entry: Entry
  panel: EntryPanel | null
  onClose: () => void
}

/** Talk, Boost and Pass panels for one entry. */
export function EntryPanels({ entry, panel, onClose }: EntryPanelsProps) {
  const toast = useToast()
  const shareLink = useShare()
  const requireSession = useRequireSession()
  const session = useSession()
  const [boosting, setBoosting] = useState(false)

  const passOn = () => {
    onClose()
    shareLink({ title: `${entry.author.displayName} on happyClash`, url: `${window.location.origin}/?v=${entry.id}` })
  }

  const sendBoost = () =>
    requireSession('boost this talent', async (current) => {
      setBoosting(true)
      try {
        await boostEntry(entry.id, current.user.id)
        toast(`${entry.author.displayName} is boosted`)
        onClose()
      } catch (error) {
        toast(error instanceof Error ? error.message : 'The Boost did not go through. Try again.')
      } finally {
        setBoosting(false)
      }
    })

  return (
    <>
      <TalkPanel entry={entry} open={panel === 'talk'} onClose={onClose} />

      <Sheet open={panel === 'boost'} title={`Boost ${entry.author.displayName}`} onClose={onClose}>
        <div className="mb-5 flex items-center gap-4 rounded-3xl border border-line bg-world-soft p-4">
          <span className="animate-float grid size-16 shrink-0 place-items-center rounded-2xl bg-black/20">
            <BoostIcon size={40} />
          </span>
          <p className="text-sm leading-relaxed text-text/85">
            A Boost pushes this video higher in everyone's feed. Boost it as often as you like.
          </p>
        </div>
        {session?.user.id === entry.author.id ? (
          <p className="rounded-2xl border border-dashed border-fg/12 p-4 text-center text-sm text-muted">
            This is your video. Boosts come from the talents who love it: share it with Pass.
          </p>
        ) : (
        <button
          type="button"
          onClick={sendBoost}
          disabled={boosting}
          className="pressable h-14 w-full rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-base font-extrabold text-world-ink shadow-[0_14px_34px_var(--world-glow)] disabled:opacity-50"
        >
          {boosting ? 'Boosting…' : 'Boost this video'}
        </button>
        )}
      </Sheet>

      <Sheet open={panel === 'pass'} title="Pass it on" onClose={onClose}>
        <p className="mb-5 text-sm text-muted">Share this video by <span translate="no" className="notranslate">{entry.author.displayName}</span>. Every share brings people back to happyClash.</p>
        <button type="button" onClick={passOn} className="pressable h-14 w-full rounded-2xl bg-text text-base font-extrabold text-ink">
          Share
        </button>
      </Sheet>
    </>
  )
}
