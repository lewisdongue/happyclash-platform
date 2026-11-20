import type { ReactNode } from 'react'

/** Shared loading, empty and error states, so no screen ever shows invented content. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-sm text-muted">
      <span className="size-9 animate-spin rounded-full border-2 border-fg/15 border-t-[var(--world-a)]" />
      {label}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-4 rounded-3xl border border-dashed border-fg/12 px-6 py-10 text-center lg:mx-0">
      <p className="text-base font-extrabold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-base font-extrabold">Something went wrong.</p>
      <button type="button" onClick={onRetry} className="pressable h-11 rounded-xl bg-fg/10 px-5 text-sm font-bold">Try again</button>
    </div>
  )
}
