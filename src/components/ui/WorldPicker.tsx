import clsx from 'clsx'
import { WORLD_LIST } from '@/theme/worlds'
import type { WorldId } from '@/types/domain'

interface WorldPickerProps {
  value: WorldId
  onChange: (world: WorldId) => void
  /** Shows only the chosen world, for flows where the world is set by context. */
  locked?: boolean
  label?: string
}

/** Talent World chooser: each chip glows in its own world's colors. */
export function WorldPicker({ value, onChange, locked = false, label = 'Talent World' }: WorldPickerProps) {
  const worlds = locked ? WORLD_LIST.filter((world) => world.id === value) : WORLD_LIST
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-extrabold tracking-widest text-muted uppercase">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {worlds.map((world) => {
          const active = world.id === value
          return (
            <button
              key={world.id}
              type="button"
              aria-pressed={active}
              disabled={locked}
              onClick={() => onChange(world.id)}
              className={clsx('pressable h-9 rounded-full px-4 text-[13px] font-extrabold transition-all', !active && 'border border-line text-muted')}
              style={active ? { background: `linear-gradient(180deg, ${world.accent}, ${world.accentDeep})`, color: world.onAccent, boxShadow: `0 8px 22px ${world.accent}55` } : undefined}
            >
              {world.name}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
