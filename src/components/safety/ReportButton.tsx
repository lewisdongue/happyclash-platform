import { useState } from 'react'
import type { ReportTarget } from '@/api/safety'
import { ReportSheet } from './ReportSheet'

/** A flag in a page header that opens the report flow for that Clash or group. */
export function ReportButton({ target, targetId }: { target: ReportTarget; targetId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Report" className="pressable grid size-10 shrink-0 place-items-center rounded-xl bg-fg/7 text-muted hover:text-[#ff6b81]">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 21V4" />
          <path d="M5 4h11l-2 4 2 4H5" />
        </svg>
      </button>
      <ReportSheet open={open} onClose={() => setOpen(false)} target={target} targetId={targetId} />
    </>
  )
}
