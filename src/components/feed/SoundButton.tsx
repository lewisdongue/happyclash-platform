import { useSound } from '@/app/sound'

export function SoundButton() {
  const { muted, toggle, justUnlocked } = useSound()
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        if (!justUnlocked()) toggle()
      }}
      data-guest-ok
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
      className="pressable grid size-[30px] place-items-center rounded-full border border-line bg-ink/45 backdrop-blur-md"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
        {muted ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
      </svg>
    </button>
  )
}
