import clsx from 'clsx'

interface SegmentedTabsProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  variant?: 'pill' | 'underline'
}

/** Accessible tab switcher in two looks: pill (compact) or underline (page level). */
export function SegmentedTabs<T extends string>({ label, options, value, onChange, variant = 'pill' }: SegmentedTabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div role="tablist" aria-label={label} className="flex gap-6 border-b border-line">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={clsx('relative pb-3 text-sm transition-colors', active ? 'font-extrabold text-text' : 'font-semibold text-muted')}
            >
              {option.label}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-world shadow-[0_0_10px_var(--world-glow)]" />}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-xl bg-fg/6 p-[3px]">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={clsx('h-8 rounded-[9px] px-3 text-xs transition-colors', active ? 'bg-text font-extrabold text-ink' : 'font-semibold text-muted')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
