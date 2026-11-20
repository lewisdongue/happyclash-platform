import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { describeSafetyError, submitReport, type ReportReasonId, type ReportTarget } from '@/api/safety'
import { useRequireSession } from '@/app/requireSession'
import { Sheet } from '@/components/ui/Sheet'

const REASONS: { value: ReportReasonId; label: string }[] = [
  { value: 'spam', label: 'Spam, scam or fake engagement' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'violence', label: 'Violence or dangerous acts' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'minor_safety', label: 'A child may be at risk' },
  { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'copyright', label: 'Stolen content' },
  { value: 'other', label: 'Something else' },
]

const NOUNS: Record<ReportTarget, string> = { entry: 'video', user: 'talent', clash: 'Clash', group: 'group', comment: 'comment' }

interface ReportSheetProps {
  open: boolean
  onClose: () => void
  target: ReportTarget
  targetId: string
  /** Called once the report is filed, for example to hide the reported video. */
  onReported?: () => void
  /** Offered after the report: block the talent behind the content. */
  onBlock?: () => void
  blockLabel?: string
}

type Step = 'reason' | 'details' | 'done'

/** Report anything on happyClash. Every report opens a case the reporter can follow in the Safety Center. */
export function ReportSheet({ open, onClose, target, targetId, onReported, onBlock, blockLabel }: ReportSheetProps) {
  const requireSession = useRequireSession()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('reason')
  const [reason, setReason] = useState<ReportReasonId | null>(null)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ caseId: string; alreadyReported: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
    setStep('reason')
    setReason(null)
    setDetails('')
    setError(null)
    setResult(null)
  }, [open])

  const send = () =>
    requireSession(`report this ${NOUNS[target]}`, async () => {
      if (!reason) return
      setBusy(true)
      setError(null)
      try {
        const filed = await submitReport(target, targetId, reason, details.trim())
        setResult(filed)
        setStep('done')
        void queryClient.invalidateQueries({ queryKey: ['my-reports'] })
        onReported?.()
      } catch (caught) {
        setError(describeSafetyError(caught))
      } finally {
        setBusy(false)
      }
    })

  const title = step === 'done' ? 'Report received' : step === 'details' ? 'Anything to add?' : `Report this ${NOUNS[target]}`

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      {step === 'reason' && (
        <div className="flex max-h-[62dvh] flex-col gap-2 overflow-y-auto">
          {REASONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setReason(option.value)
                setStep('details')
              }}
              className="pressable h-12 w-full shrink-0 rounded-2xl border border-line bg-fg/4 px-4 text-left text-[15px] font-bold"
            >
              {option.label}
            </button>
          ))}
          <p className="mt-2 text-xs text-muted">The talent is never told who reported them.</p>
        </div>
      )}

      {step === 'details' && (
        <div>
          <p className="mb-3 text-sm text-muted">{REASONS.find((option) => option.value === reason)?.label}</p>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 1000))}
            rows={4}
            placeholder="Optional: what happened? Details help our team act faster."
            className="w-full resize-none rounded-2xl border border-line bg-fg/4 px-4 py-3 text-[15px] outline-none placeholder:text-subtle focus:border-world"
          />
          {reason === 'minor_safety' && (
            <p className="mt-3 rounded-2xl bg-[#ff4d6d]/10 p-3 text-xs leading-relaxed text-[#ff6b81]">
              If a child is in immediate danger, call your local emergency number first.
            </p>
          )}
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-[#ff6b81]">{error}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setStep('reason')} className="pressable h-12 rounded-2xl bg-fg/8 text-sm font-extrabold">
              Back
            </button>
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="pressable h-12 rounded-2xl bg-[#ff4d6d] text-sm font-extrabold text-white disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="text-center">
          <p className="text-sm text-muted">{result.alreadyReported ? 'You already reported this. Your case is still open:' : 'Thank you. Your case number is'}</p>
          <p className="tabular mt-2 text-3xl font-extrabold tracking-wider text-world">{result.caseId}</p>
          <p className="mt-3 text-sm text-muted">Our team reviews every case. Follow its status in the Safety Center.</p>
          <div className={clsx('mt-6 grid gap-2', onBlock ? 'grid-cols-2' : 'grid-cols-1')}>
            {onBlock && (
              <button
                type="button"
                onClick={() => {
                  onBlock()
                  onClose()
                }}
                className="pressable h-12 truncate rounded-2xl bg-fg/8 px-3 text-sm font-extrabold"
              >
                {blockLabel ?? 'Block'}
              </button>
            )}
            <Link to="/safety" onClick={onClose} className="pressable grid h-12 place-items-center rounded-2xl bg-text text-sm font-extrabold text-ink">
              Safety Center
            </Link>
          </div>
        </div>
      )}
    </Sheet>
  )
}
