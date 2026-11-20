import { PlusIcon } from '@/components/icons/UiIcons'

/** Pulsing points where Clashes are happening. Positions are % of the globe. */
const HOTSPOTS = [
  { x: 38, y: 30, color: '#FFD54F', delay: 0 },
  { x: 62, y: 42, color: '#FF6FB1', delay: 0.6 },
  { x: 48, y: 58, color: '#6FB8FF', delay: 1.2 },
  { x: 28, y: 52, color: '#FFD54F', delay: 1.8 },
  { x: 70, y: 26, color: '#5FE0A8', delay: 0.9 },
  { x: 56, y: 70, color: '#FF6FB1', delay: 1.5 },
]

/** The living globe of the Clash tab. The globe itself is the "start a Clash" button. */
export function Globe({ onCreate }: { onCreate: () => void }) {
  return (
    <button type="button" onClick={onCreate} aria-label="Start a Clash" className="pressable group relative block size-[236px] rounded-full lg:size-[320px]">
      <span aria-hidden="true" className="animate-breathe absolute -inset-8 rounded-full bg-[radial-gradient(closest-side,rgba(111,140,255,.28),transparent)]" />
      <span
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden rounded-full shadow-[inset_-24px_-30px_50px_rgba(0,0,0,.7),inset_14px_16px_30px_rgba(170,190,255,.18),0_30px_60px_rgba(0,0,0,.6)]"
        style={{ background: 'radial-gradient(circle at 34% 28%, #3a4270 0%, #1a1e38 45%, #090a14 100%)' }}
      >
        <span className="animate-spin-slow absolute -inset-[40%] rounded-full bg-[repeating-linear-gradient(90deg,transparent_0_22px,rgba(160,180,255,.07)_22px_23px),repeating-linear-gradient(0deg,transparent_0_22px,rgba(160,180,255,.05)_22px_23px)]" />
        {HOTSPOTS.map((spot) => (
          <span key={`${spot.x}-${spot.y}`} className="absolute -mt-1 -ml-1 size-2" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
            <span className="absolute inset-0 rounded-full" style={{ background: spot.color, boxShadow: `0 0 10px ${spot.color}` }} />
            <span className="animate-ping-ring absolute inset-0 rounded-full border-[1.5px]" style={{ borderColor: spot.color, animationDelay: `${spot.delay}s` }} />
          </span>
        ))}
      </span>
      <span className="absolute -bottom-5 left-1/2 flex h-[46px] -translate-x-1/2 max-w-[calc(100vw-32px)] items-center gap-2 rounded-2xl bg-text px-5 text-[15px] font-extrabold whitespace-nowrap text-ink shadow-[0_14px_30px_rgba(0,0,0,.5)] transition-transform group-hover:-translate-y-0.5">
        <PlusIcon /> <span className="truncate">Start a Clash</span>
      </span>
    </button>
  )
}
