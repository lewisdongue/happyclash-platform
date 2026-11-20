export interface VideoFacts {
  width: number
  height: number
  durationMs: number
  /** A JPEG still for the feed, or null when the browser cannot decode the video. */
  poster: Blob | null
}

const POSTER_LONG_EDGE = 960
const LOAD_TIMEOUT_MS = 12_000

/**
 * Reads a local video's size and length and grabs a poster frame,
 * all in the browser, before anything is uploaded.
 * `knownDurationMs` covers in-app recordings, whose WebM files report no duration.
 */
export function inspectVideo(file: Blob, knownDurationMs?: number): Promise<VideoFacts> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  const cleanup = () => {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }

  return new Promise<VideoFacts>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('This video could not be read. Try another file.'))
    }, LOAD_TIMEOUT_MS)

    const finish = (facts: VideoFacts) => {
      window.clearTimeout(timer)
      cleanup()
      resolve(facts)
    }

    video.onerror = () => {
      window.clearTimeout(timer)
      cleanup()
      reject(new Error('This video format cannot be played here. Try an MP4 file.'))
    }

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration * 1000 : (knownDurationMs ?? 0)
      const facts = { width: video.videoWidth, height: video.videoHeight, durationMs: Math.round(duration), poster: null as Blob | null }
      if (!facts.width || !facts.height) return finish(facts)

      video.onseeked = () => {
        captureFrame(video).then((poster) => finish({ ...facts, poster }))
      }
      // A frame just after the start avoids black fade-ins.
      video.currentTime = Math.min(0.5, duration / 2000 || 0.1)
    }

    video.src = url
  })
}

function captureFrame(video: HTMLVideoElement): Promise<Blob | null> {
  const scale = Math.min(1, POSTER_LONG_EDGE / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) return Promise.resolve(null)
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
}

/** Picks the best format this browser can record. MP4 plays everywhere, so it comes first. */
export function pickRecordingType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
}

/** Square-crops and shrinks a photo to a small JPEG for avatars. */
export function squareAvatar(file: File, size = 320): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const side = Math.min(image.naturalWidth, image.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d')?.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('This photo could not be read.'))), 'image/jpeg', 0.86)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This photo could not be read. Try a JPEG or PNG.'))
    }
    image.src = url
  })
}
