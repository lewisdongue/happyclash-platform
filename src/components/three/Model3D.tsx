import { useEffect, useState, type CSSProperties } from 'react'
import clsx from 'clsx'
import { MODEL_URL, type ModelKey } from '@/lib/assets'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>
    }
  }
}

let viewerReady: Promise<unknown> | null = null
/** The viewer library loads once, the first time any 3D model is on screen. */
const loadViewer = () => (viewerReady ??= import('@google/model-viewer'))

interface Model3DProps {
  model: ModelKey
  className?: string
  style?: CSSProperties
  /** Lets the viewer turn the model with a finger or the mouse. */
  interactive?: boolean
  /** Seconds per full turn; 0 stops the spin. */
  spin?: number
  label: string
}

/**
 * A real 3D model that turns slowly in place. It renders nothing until the
 * viewer library is ready, so pages never wait on it.
 */
export function Model3D({ model, className, style, interactive = false, spin = 12, label }: Model3DProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    loadViewer().then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  if (!ready) return <span className={clsx('block', className)} style={style} aria-hidden="true" />

  return (
    <model-viewer
      src={MODEL_URL[model]}
      alt={label}
      loading="lazy"
      reveal="auto"
      {...(spin > 0 ? { 'auto-rotate': true, 'rotation-per-second': `${Math.round(360 / spin)}deg`, 'auto-rotate-delay': 0 } : {})}
      {...(interactive ? { 'camera-controls': true, 'disable-zoom': true, 'disable-pan': true, 'interaction-prompt': 'none' } : {})}
      shadow-intensity="0.6"
      exposure="1.1"
      environment-image="neutral"
      camera-orbit="30deg 62deg auto"
      field-of-view="auto"
      // Decorative spins are hidden from assistive tech and the tab order;
      // their link or page already names them.
      {...(interactive ? {} : { 'aria-hidden': 'true', tabIndex: -1 })}
      className={clsx('block isolate', !interactive && 'pointer-events-none', className)}
      style={{ background: 'transparent', ['--poster-color' as string]: 'transparent', ['--progress-bar-height' as string]: '0px', ...style }}
    />
  )
}
