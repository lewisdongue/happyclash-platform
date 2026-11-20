/** Small line icons for UI chrome. They inherit `currentColor`. */
interface IconProps {
  size?: number
  className?: string
}

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export const SearchIcon = ({ size = 20, className }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...line}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const BackIcon = ({ size = 20, className }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...line}>
    <path d="m15 5-7 7 7 7" />
  </svg>
)

export const ChevronIcon = ({ size = 16, className }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...line}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)

export const CameraIcon = ({ size = 20, className }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...line}>
    <rect x="3" y="6" width="13" height="12" rx="3" />
    <path d="m16 10 5-3v10l-5-3" />
  </svg>
)

export const FlipIcon = ({ size = 18, className }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...line}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
)

export const PlusIcon = ({ size = 18, className }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...line} strokeWidth={3}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const CloseIcon = ({ size = 20, className }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...line}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

/** The blue badge of a talent verified with one of their social accounts. */
export const VerifiedBadge = ({ size = 15 }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Verified" className="shrink-0 drop-shadow-[0_1px_3px_rgba(29,155,240,.5)]">
    <path
      d="M12 1.8l2.6 1.9 3.2-.2 1 3 2.6 1.9-1 3 1 3-2.6 1.9-1 3-3.2-.2L12 22.2l-2.6-1.9-3.2.2-1-3-2.6-1.9 1-3-1-3 2.6-1.9 1-3 3.2.2z"
      fill="#1D9BF0"
    />
    <path d="m8 12.2 2.8 2.8 5.2-6" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const CrownIcon = ({ size = 26 }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z" fill="#FFD54F" />
  </svg>
)

export const BellIcon = ({ size = 20, className }: IconProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" {...line}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
)
