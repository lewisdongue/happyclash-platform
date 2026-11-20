import { useId } from 'react'

/**
 * Tab icons drawn as small glossy objects. `accent` paints the detail that
 * picks up the current world color; inactive tabs pass a neutral tone.
 */
interface TabIconProps {
  size?: number
  accent?: string
}

export function HomeIcon({ size = 28, accent = '#FFD54F' }: TabIconProps) {
  const id = useId()
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2F4FF" />
          <stop offset="1" stopColor="#9AA2C8" />
        </linearGradient>
        <linearGradient id={`${id}door`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} />
          <stop offset="1" stopColor="#FF8A3D" />
        </linearGradient>
      </defs>
      <path d="M7 22 24 8l17 14v17a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3z" fill={`url(#${id}body)`} />
      <path d="M7 21 24 7l17 14" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="19" y="27" width="10" height="15" rx="3" fill={`url(#${id}door)`} />
    </svg>
  )
}

export function ClashIcon({ size = 28, accent = '#FFD54F' }: TabIconProps) {
  const id = useId()
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}orb`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".35" stopColor="#C9CFEA" />
          <stop offset="1" stopColor="#5A6188" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="18" fill={`url(#${id}orb)`} />
      <path d="M26 10 16 27h8l-3 12 11-18h-8z" fill={accent} stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

export function RankingIcon({ size = 28, accent = '#FFD54F' }: TabIconProps) {
  const id = useId()
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}step`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#A3AACB" />
        </linearGradient>
      </defs>
      <rect x="5" y="26" width="11" height="15" rx="2.5" fill={`url(#${id}step)`} opacity=".75" />
      <rect x="18.5" y="16" width="11" height="25" rx="2.5" fill={`url(#${id}step)`} />
      <rect x="32" y="31" width="11" height="10" rx="2.5" fill={`url(#${id}step)`} opacity=".6" />
      <path d="m24 4 2.4 4.8 5.3.8-3.8 3.7.9 5.2-4.8-2.5-4.8 2.5.9-5.2-3.8-3.7 5.3-.8z" fill={accent} />
    </svg>
  )
}

export function LifeIcon({ size = 28, accent = '#FFD54F' }: TabIconProps) {
  const id = useId()
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}planet`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".4" stopColor="#B7BEDF" />
          <stop offset="1" stopColor="#4A5078" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="14" fill={`url(#${id}planet)`} />
      <ellipse cx="24" cy="25" rx="22" ry="7" fill="none" stroke={accent} strokeWidth="2.5" transform="rotate(-18 24 25)" />
    </svg>
  )
}

export function AnimalsIcon({ size = 28, accent = '#FFB86B' }: TabIconProps) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <ellipse cx="24" cy="31" rx="9.5" ry="8" fill={accent} />
      <ellipse cx="12" cy="21" rx="4" ry="5" fill="#E7EAF7" />
      <ellipse cx="19.5" cy="13" rx="4" ry="5.2" fill="#E7EAF7" />
      <ellipse cx="28.5" cy="13" rx="4" ry="5.2" fill="#E7EAF7" />
      <ellipse cx="36" cy="21" rx="4" ry="5" fill="#E7EAF7" />
    </svg>
  )
}
