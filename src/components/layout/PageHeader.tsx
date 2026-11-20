import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BackIcon } from '@/components/icons/UiIcons'

interface PageHeaderProps {
  title: string
  subtitle?: string
  back?: boolean
  actions?: ReactNode
}

/** Title row for inner pages. Large title on tab roots, back button on detail pages. */
export function PageHeader({ title, subtitle, back = false, actions }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="flex items-center gap-3 px-4 pt-[calc(var(--safe-top)+16px)] pb-2 lg:px-0 lg:pt-2">
      {back && (
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="pressable grid size-10 place-items-center rounded-xl bg-fg/7">
          <BackIcon />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className={clsx('truncate', back ? 'text-lg font-extrabold' : 'text-[28px] font-extrabold tracking-tight')}>{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}
