import { useState } from 'react'
import { useBlockedTalents } from '@/api/queries'
import { useSession } from '@/app/session'
import { Sheet } from '@/components/ui/Sheet'
import { ReportSheet } from './ReportSheet'
import { useBlockTalent } from './useBlockTalent'

interface Talent {
  id: string
  handle: string
}

/** True when the signed-in talent blocked this talent. */
export function useHasBlocked(talentId: string | undefined): boolean {
  const session = useSession()
  const { data: blocked = [] } = useBlockedTalents(session?.user.id)
  return Boolean(talentId && blocked.some((item) => item.id === talentId))
}

/** The ⋯ button on someone else's profile: report or block them. */
export function TalentOptions({ talent }: { talent: Talent }) {
  const blocked = useHasBlocked(talent.id)
  const blockTalent = useBlockTalent()
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)

  return (
    <>
      <button type="button" aria-label="More options" onClick={() => setMenu(true)} className="pressable grid size-10 place-items-center rounded-xl bg-fg/7">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      <Sheet open={menu} title={`@${talent.handle}`} onClose={() => setMenu(false)}>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setMenu(false)
              setReporting(true)
            }}
            className="pressable h-12 w-full rounded-2xl border border-line bg-fg/4 px-4 text-left text-[15px] font-bold text-[#ff6b81]"
          >
            Report <span translate="no" className="notranslate">@{talent.handle}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMenu(false)
              blockTalent(talent, !blocked)
            }}
            className="pressable h-12 w-full rounded-2xl border border-line bg-fg/4 px-4 text-left text-[15px] font-bold text-[#ff6b81]"
          >
            {blocked ? `Unblock @${talent.handle}` : `Block @${talent.handle}`}
          </button>
          <p className="mt-1 text-xs text-muted">
            Blocking hides their videos and comments from you and yours from them. They cannot follow you, comment or Clash Back. They are not notified.
          </p>
        </div>
      </Sheet>

      <ReportSheet
        open={reporting}
        onClose={() => setReporting(false)}
        target="user"
        targetId={talent.id}
        onBlock={blocked ? undefined : () => blockTalent(talent, true)}
        blockLabel={`Block @${talent.handle}`}
      />
    </>
  )
}
