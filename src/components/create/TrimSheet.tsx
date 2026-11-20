import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { trimVideo } from '@/lib/trimVideo'

/**
 * Long video: pick the minute to keep. One slider moves a fixed window over
 * the video, the preview loops inside it, and the chosen part is cut out.
 */
export function TrimSheet({
  file,
  durationMs,
  maxSeconds,
  onDone,
  onCancel,
}: {
  file: File
  durationMs: number
  maxSeconds: number
  onDone: (clip: File, clipMs: number) => void
  onCancel: () => void
}) {
  const total = durationMs / 1000
  const length = Math.min(maxSeconds, total)
  const [start, setStart] = useState(0)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [url] = useState(() => URL.createObjectURL(file))
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  // Preview loops inside the chosen window.
  useEffect(() => {
    const element = video.current
    if (!element) return
    element.currentTime = start
    void element.play().catch(() => undefined)
    const keepInside = () => {
      if (element.currentTime >= start + length || element.currentTime < start) element.currentTime = start
    }
    element.addEventListener('timeupdate', keepInside)
    return () => element.removeEventListener('timeupdate', keepInside)
  }, [start, length])

  const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

  const confirm = async () => {
    setError(null)
    setBusy(0)
    try {
      const clip = await trimVideo(file, start, length, setBusy)
      onDone(clip, Math.round(length * 1000))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The cut failed. Try again.')
      setBusy(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm lg:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-[#121219] p-5 pb-[calc(var(--safe-bottom)+20px)] text-white lg:rounded-3xl">
        <p className="text-lg font-extrabold">Choose your {Math.round(length)} seconds</p>
        <p className="mt-1 text-sm text-white/60">
          Your video lasts {format(total)}. Slide to pick the part you want to publish.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl bg-black">
          <video ref={video} src={url} playsInline muted loop={false} className="mx-auto max-h-[42vh] w-full object-contain" />
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, total - length)}
          step={0.1}
          value={start}
          disabled={busy !== null}
          onChange={(event) => setStart(Number(event.target.value))}
          aria-label="Start of the clip"
          className="mt-5 w-full accent-[var(--world-a,#ffd54f)]"
        />
        <div className="mt-1 flex justify-between text-xs font-bold text-white/70 tabular-nums">
          <span>{format(start)}</span>
          <span>→ {format(start + length)}</span>
        </div>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-[#ff8fa3]">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} disabled={busy !== null} className="pressable h-12 rounded-2xl bg-white/10 font-extrabold">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={busy !== null} className="pressable h-12 rounded-2xl bg-white font-extrabold text-[#111]">
            {busy === null ? 'Use this part' : `Cutting… ${Math.round(busy * 100)}%`}
          </button>
        </div>
      </div>
    </div>
    ,
    document.body,
  )
}
