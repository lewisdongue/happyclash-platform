import clsx from 'clsx'
import { initialsOf } from '@/lib/initials'

interface AvatarProps {
  name: string
  src?: string | null
  size?: number
  /** Ring in the current world color, used for creators and the signed-in user. */
  ring?: boolean
  className?: string
}

export function Avatar({ name, src, size = 38, ring = false, className }: AvatarProps) {
  return (
    <span
      className={clsx('inline-flex shrink-0 rounded-full', ring ? 'bg-world p-[2px]' : 'border border-fg/10', className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" className="size-full rounded-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center rounded-full bg-raised font-extrabold" style={{ fontSize: Math.round(size * 0.34) }}>
          {initialsOf(name)}
        </span>
      )}
    </span>
  )
}
