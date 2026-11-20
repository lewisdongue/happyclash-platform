import { Link } from 'react-router'
import { Model3D } from '@/components/three/Model3D'
import type { TalentWorld } from '@/types/domain'

/** A Talent World as a lit glass pedestal with its 3D emblem turning on top. */
export function WorldOrb({ world, delay = 0 }: { world: TalentWorld; delay?: number }) {
  return (
    <Link to={`/world/${world.id}`} className="pressable group flex w-[84px] shrink-0 flex-col items-center gap-1.5 text-xs font-bold text-text/80 lg:w-[96px]">
      <span
        className="relative grid size-[76px] place-items-center rounded-[26px] border border-fg/10 transition-transform duration-500 group-hover:-translate-y-1 lg:size-[88px]"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${world.accent}55, transparent 70%), linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02))`,
          boxShadow: `0 14px 30px ${world.accent}26, inset 0 1px 0 rgba(255,255,255,.12)`,
        }}
      >
        <Model3D model={world.id} label={`${world.name} emblem`} spin={10 + delay * 2} className="size-full" />
        <span aria-hidden="true" className="absolute bottom-2 h-1.5 w-10 rounded-full blur-[3px]" style={{ background: `${world.accent}88` }} />
      </span>
      {world.name}
    </Link>
  )
}
