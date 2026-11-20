import { createPortal } from 'react-dom'
import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CloseIcon } from '@/components/icons/UiIcons'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Bottom sheet on phones, centered panel on desktop. Closes on Escape or backdrop tap. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Rendered on <body>: a sheet opened from inside a moving card must still cover the whole screen.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/65"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', ease: [0.2, 0.9, 0.3, 1], duration: 0.18 }}
            className="relative w-full max-w-lg rounded-t-[28px] border-t border-line bg-surface px-5 pt-3 pb-[calc(var(--safe-bottom)+24px)] shadow-2xl lg:rounded-[28px] lg:border"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-fg/20 lg:hidden" />
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="pressable grid size-9 place-items-center rounded-xl bg-fg/7 text-muted">
                <CloseIcon size={18} />
              </button>
            </header>
            {children}
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
