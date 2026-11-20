import { AnimatePresence, motion } from 'motion/react'

/** Appears when talents publish while you watch; tapping reloads the feed with them on top. */
export function NewVideosPill({ count, onShow, className }: { count: number; onShow: () => void; className?: string }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.button
          type="button"
          onClick={onShow}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className={`pressable z-30 flex h-9 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] px-4 text-[13px] font-extrabold text-world-ink shadow-[0_10px_24px_var(--world-glow)] ${className ?? ''}`}
        >
          <span className="size-1.5 animate-pulse rounded-full bg-world-ink" />
          {count} new {count === 1 ? 'video' : 'videos'}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
