import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Sheet } from './Sheet'
import { useToast } from './Toast'

interface ShareRequest {
  title: string
  url: string
}

const ShareContext = createContext<(request: ShareRequest) => void>(() => {})

/** Phones get their native share sheet; elsewhere an in-app sheet that never overflows. */
const prefersNative = () => typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches

export function ShareProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [request, setRequest] = useState<ShareRequest | null>(null)

  const share = useCallback((next: ShareRequest) => {
    if (prefersNative()) {
      navigator.share({ title: next.title, url: next.url }).catch(() => undefined)
      return
    }
    setRequest(next)
  }, [])

  const copy = async () => {
    if (!request) return
    try {
      await navigator.clipboard.writeText(request.url)
      toast('Link copied')
      setRequest(null)
    } catch {
      toast('Select the link and copy it')
    }
  }

  const targets = useMemo(() => {
    if (!request) return []
    const url = encodeURIComponent(request.url)
    const text = encodeURIComponent(request.title)
    return [
      { label: 'WhatsApp', href: `https://wa.me/?text=${text}%20${url}` },
      { label: 'X', href: `https://x.com/intent/post?text=${text}&url=${url}` },
      { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
      { label: 'Telegram', href: `https://t.me/share/url?url=${url}&text=${text}` },
    ]
  }, [request])

  return (
    <ShareContext.Provider value={share}>
      {children}
      <Sheet open={request !== null} title="Share" onClose={() => setRequest(null)}>
        <p className="mb-3 truncate text-sm font-bold">{request?.title}</p>
        <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-line bg-fg/5 p-1.5 pl-4">
          <input
            readOnly
            value={request?.url ?? ''}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Link"
            className="min-w-0 flex-1 truncate bg-transparent text-sm text-muted outline-none"
          />
          <button type="button" onClick={copy} className="pressable h-10 shrink-0 rounded-xl bg-world px-4 text-sm font-extrabold text-world-ink">
            Copy
          </button>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {targets.map((target) => (
            <a
              key={target.label}
              href={target.href}
              target="_blank"
              rel="noreferrer"
              className="pressable grid h-12 place-items-center rounded-2xl bg-fg/6 text-[13px] font-extrabold"
            >
              {target.label}
            </a>
          ))}
        </div>
      </Sheet>
    </ShareContext.Provider>
  )
}

export const useShare = () => useContext(ShareContext)
