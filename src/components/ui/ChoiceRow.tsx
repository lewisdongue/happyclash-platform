import clsx from 'clsx'

export interface Choice<T extends string | number> {
  value: T
  label: string
  hint?: string
}

interface ChoiceRowProps<T extends string | number> {
  label: string
  choices: Choice<T>[]
  value: T
  onChange: (value: T) => void
}

/** A row of equal tiles where exactly one is chosen. */
export function ChoiceRow<T extends string | number>({ label, choices, value, onChange }: ChoiceRowProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-extrabold tracking-widest text-muted uppercase">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}>
        {choices.map((choice) => {
          const active = choice.value === value
          return (
            <button
              key={String(choice.value)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(choice.value)}
              className={clsx(
                'pressable flex min-w-0 flex-col items-center gap-0.5 rounded-2xl border px-1 py-3 transition-colors',
                active ? 'border-world bg-world-soft' : 'border-line bg-fg/4',
              )}
            >
              <span className={clsx('text-sm font-extrabold', active && 'text-world')}>{choice.label}</span>
              {choice.hint && <span className="truncate text-[11px] text-muted">{choice.hint}</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
