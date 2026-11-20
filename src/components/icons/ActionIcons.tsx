import { useId } from 'react'

/**
 * The four video actions have their own shapes instead of generic circles:
 * Spark (like), Talk (comments), Boost (support) and Pass (share).
 * Colors that should follow the active world use the CSS variables.
 */
interface IconProps {
  size?: number
}

export function SparkIcon({ size = 30 }: IconProps) {
  const id = useId()
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".45" style={{ stopColor: 'var(--world-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--world-b)' }} />
        </radialGradient>
      </defs>
      <path
        d="M20 2l3.6 11.2L35 9l-7.2 9.4L38 20l-10.2 1.6L35 31l-11.4-4.2L20 38l-3.6-11.2L5 31l7.2-9.4L2 20l10.2-1.6L5 9l11.4 4.2z"
        fill={`url(#${id})`}
      />
      <circle cx="20" cy="20" r="4" fill="#FFFFFF" />
    </svg>
  )
}

export function TalkIcon({ size = 28 }: IconProps) {
  const id = useId()
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#AEB4CF" />
        </linearGradient>
      </defs>
      <path d="M6 8h28a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H18l-8 7v-7H6a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" fill={`url(#${id})`} />
      <circle cx="13" cy="18" r="2.4" fill="#2B2F45" />
      <circle cx="20" cy="18" r="2.4" fill="#2B2F45" />
      <circle cx="27" cy="18" r="2.4" fill="#2B2F45" />
    </svg>
  )
}

export function BoostIcon({ size = 30 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M12 6h16l8 10-16 20L4 16z" style={{ fill: 'var(--world-b)' }} />
      <path d="M12 6h16l-4 10H16z" style={{ fill: 'var(--world-a)' }} />
      <path d="M4 16h12l4 20z" style={{ fill: 'var(--world-a)' }} opacity=".85" />
      <path d="M36 16H24l-4 20z" fill="#FFFFFF" opacity=".35" />
      <path d="M16 16h8l-4 20z" fill="#FFFFFF" opacity=".55" />
      <path d="M12 6 4 16h12z" fill="#FFFFFF" opacity=".6" />
    </svg>
  )
}

export function PassIcon({ size = 28 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M3 19 37 4 27 36l-8-12z" fill="#E9ECF8" />
      <path d="M19 24 37 4 15 21z" fill="#AEB4CF" />
      <path d="m19 24-2 9 6-6z" fill="#8A90AE" />
    </svg>
  )
}

export function BoltIcon({ size = 22, color = 'var(--world-a)' }: IconProps & { color?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <path d="M23 2 7 23h11l-3 15 18-22H22z" style={{ fill: color }} stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
