import { useState } from 'react'
import { Sheet } from './Sheet'

interface ConfirmSheetProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => Promise<unknown>
  onClose: () => void
}

/** In-app confirmation for destructive actions; never the browser's blocking dialog. */
export function ConfirmSheet({ open, title, message, confirmLabel, onConfirm, onClose }: ConfirmSheetProps) {
  const [busy, setBusy] = useState(false)
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <p className="mb-5 text-sm text-muted">{message}</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} className="pressable h-12 rounded-2xl bg-fg/8 text-sm font-extrabold">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onConfirm()
            } finally {
              setBusy(false)
            }
          }}
          className="pressable h-12 rounded-2xl bg-[#ff4d6d] text-sm font-extrabold text-white disabled:opacity-60"
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}
