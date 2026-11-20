import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { CloseIcon, FlipIcon } from '@/components/icons/UiIcons'
import { pickRecordingType } from '@/lib/videoFile'

export interface Recording {
  file: File
  durationMs: number
}

interface CameraRecorderProps {
  maxSeconds: number
  onDone: (recording: Recording) => void
  onCancel: () => void
  /** Called when the camera cannot be opened, so the page can fall back to the system camera. */
  onUnavailable: (reason: string) => void
}

type Facing = 'user' | 'environment'

const RING = 2 * Math.PI * 40

/** In-app camera: portrait preview, one-tap record with a countdown ring, front/back switch. */
export function CameraRecorder({ maxSeconds, onDone, onCancel, onUnavailable }: CameraRecorderProps) {
  const preview = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const startedAt = useRef(0)
  const [facing, setFacing] = useState<Facing>('user')
  const [recording, setRecording] = useState(false)
  const [ready, setReady] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onUnavailable('This browser cannot open the camera here. Upload a video instead.')
      return
    }
    let cancelled = false
    setReady(false)
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop())
        stream.current = media
        if (preview.current) preview.current.srcObject = media
        setReady(true)
      })
      .catch((error: unknown) => {
        const denied = error instanceof DOMException && error.name === 'NotAllowedError'
        onUnavailable(denied ? 'Camera access was refused. Allow it in your browser settings, or upload a video.' : 'No camera was found on this device.')
      })
    return () => {
      cancelled = true
      stream.current?.getTracks().forEach((track) => track.stop())
      stream.current = null
    }
  }, [facing, onUnavailable])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  useEffect(() => {
    if (!recording) return
    const tick = window.setInterval(() => {
      const seconds = (performance.now() - startedAt.current) / 1000
      setElapsed(seconds)
      if (seconds >= maxSeconds) stop()
    }, 100)
    return () => window.clearInterval(tick)
  }, [recording, maxSeconds, stop])

  const start = () => {
    const media = stream.current
    const mimeType = pickRecordingType()
    if (!media || !mimeType) return onUnavailable('This browser cannot record video here. Upload a video instead.')

    const chunks: Blob[] = []
    // 1.9 Mbps keeps a 3-minute take under the 50 MB upload limit at sharp 1080p quality.
    const instance = new MediaRecorder(media, { mimeType, videoBitsPerSecond: 1_900_000, audioBitsPerSecond: 128_000 })
    instance.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data)
    instance.onstop = () => {
      const durationMs = Math.round(performance.now() - startedAt.current)
      const type = mimeType.split(';')[0]
      const extension = type === 'video/mp4' ? 'mp4' : 'webm'
      setRecording(false)
      onDone({ file: new File(chunks, `happyclash-${Date.now()}.${extension}`, { type }), durationMs })
    }
    recorder.current = instance
    startedAt.current = performance.now()
    setElapsed(0)
    instance.start(1000)
    setRecording(true)
  }

  const remaining = Math.max(0, Math.ceil(maxSeconds - elapsed))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
      <video
        ref={preview}
        autoPlay
        muted
        playsInline
        className={clsx('h-full w-full object-cover lg:h-[calc(100dvh-48px)] lg:w-auto lg:rounded-[30px]', facing === 'user' && '-scale-x-100')}
        style={{ aspectRatio: '9 / 16' }}
      />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(var(--safe-top)+16px)]">
        <button type="button" onClick={onCancel} disabled={recording} aria-label="Close camera" className="pressable grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur-md disabled:opacity-30">
          <CloseIcon />
        </button>
        <span className="tabular rounded-full bg-black/40 px-3.5 py-1.5 text-sm font-extrabold backdrop-blur-md">
          {recording ? <span className="flex items-center gap-2"><span className="size-2 animate-pulse rounded-full bg-[#ff4d6d]" />{remaining}s left</span> : `Up to ${maxSeconds}s`}
        </span>
        <button
          type="button"
          onClick={() => setFacing((value) => (value === 'user' ? 'environment' : 'user'))}
          disabled={recording}
          aria-label="Switch camera"
          className="pressable grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur-md disabled:opacity-30"
        >
          <FlipIcon size={20} />
        </button>
      </div>

      {!ready && (
        <p className="absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-sm font-bold text-fg/80">
          Allow camera and microphone access to start filming.
        </p>
      )}

      <div className="absolute inset-x-0 bottom-[calc(var(--safe-bottom)+36px)] flex justify-center">
        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={!ready}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
          className="pressable relative grid size-[92px] place-items-center disabled:opacity-40"
        >
          <svg viewBox="0 0 92 92" className="absolute inset-0 -rotate-90">
            <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="6" />
            <circle
              cx="46"
              cy="46"
              r="40"
              fill="none"
              stroke="var(--world-a)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - Math.min(1, elapsed / maxSeconds))}
            />
          </svg>
          <span
            className={clsx(
              'transition-all duration-200',
              recording ? 'size-8 rounded-lg bg-[#ff4d6d]' : 'size-[68px] rounded-full bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] shadow-[0_0_30px_var(--world-glow)]',
            )}
          />
        </button>
      </div>
    </div>
  )
}
