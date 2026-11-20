import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { describeAdminError } from '@/api/admin'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'

/**
 * Runs an admin action. The screen changes at once (optimistic), the
 * database confirms in the background, and a failure puts things back.
 */
export function useAdminAction() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, action: () => Promise<unknown>, done: string, optimistic?: () => void) => {
    setBusy(key)
    optimistic?.()
    try {
      await action()
      toast(done)
      return true
    } catch (error) {
      toast(describeAdminError(error))
      return false
    } finally {
      setBusy(null)
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
    }
  }

  /** Edits every cached admin list under `key` in place. */
  const patch = <T,>(key: unknown[], update: (rows: T[]) => T[]) =>
    queryClient.setQueriesData<T[]>({ queryKey: key }, (rows) => (rows ? update(rows) : rows))

  return { run, busy, patch }
}

export function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="text-[11px] font-extrabold tracking-widest text-muted uppercase">{title}</h2>
        {aside}
      </div>
      <div className="overflow-hidden rounded-[22px] border border-line bg-fg/[.035]">{children}</div>
    </section>
  )
}

export function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-fg/6">{children}</ul>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-muted">{children}</p>
}

type Tone = 'neutral' | 'danger' | 'good' | 'info' | 'warn'

const TONES: Record<Tone, string> = {
  neutral: 'bg-fg/8 text-text',
  danger: 'bg-[#ff4d6d]/12 text-[#e5484d]',
  good: 'bg-[#22c55e]/12 text-[#16a34a]',
  info: 'bg-[#1D9BF0]/12 text-[#1D9BF0]',
  warn: 'bg-[#f59e0b]/14 text-[#d97706]',
}

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={clsx('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold', TONES[tone])}>{children}</span>
}

export function ActionButton({
  children,
  onClick,
  tone = 'neutral',
  disabled = false,
}: {
  children: ReactNode
  onClick: () => void
  tone?: 'neutral' | 'danger' | 'primary'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'pressable h-9 shrink-0 rounded-xl px-3 text-xs font-extrabold disabled:opacity-40',
        tone === 'danger' && 'bg-[#ff4d6d]/12 text-[#e5484d]',
        tone === 'primary' && 'bg-text text-ink',
        tone === 'neutral' && 'bg-fg/8',
      )}
    >
      {children}
    </button>
  )
}

/** Asks why before a critical action is sent for a second admin's approval. */
export function ReasonSheet({
  open,
  title,
  description,
  confirm,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirm: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<boolean>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <p className="text-sm text-muted">{description}</p>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value.slice(0, 500))}
        rows={3}
        placeholder="Reason (seen by the other admins and in the audit log)"
        className="mt-4 w-full resize-none rounded-2xl border border-line bg-fg/4 px-4 py-3 text-[15px] outline-none placeholder:text-subtle focus:border-world"
      />
      <button
        type="button"
        disabled={busy || reason.trim().length < 3}
        onClick={async () => {
          setBusy(true)
          const ok = await onConfirm(reason.trim())
          setBusy(false)
          if (ok) {
            setReason('')
            onClose()
          }
        }}
        className="pressable mt-4 h-12 w-full rounded-2xl bg-[#ff4d6d] text-sm font-extrabold text-white disabled:opacity-40"
      >
        {busy ? 'Sending…' : confirm}
      </button>
    </Sheet>
  )
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
