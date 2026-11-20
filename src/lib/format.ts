/** 24800 → "24.8k", 1204 → "1,204". Short enough for buttons, exact when small. */
export function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`
  if (value >= 10_000) return `${trim(value / 1_000)}k`
  return value.toLocaleString('en-US')
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}


/** "now", "5m", "3h", "2d", then a date: short enough for comment rows. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (seconds < 45) return 'now'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`
  if (seconds < 7 * 86_400) return `${Math.round(seconds / 86_400)}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

