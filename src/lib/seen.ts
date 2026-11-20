const KEY = 'hc:seen'
const LIMIT = 300

/** Videos this browser already watched, so guests also get a fresh feed on return. */
export function readSeen(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function markSeen(id: string) {
  try {
    const seen = readSeen().filter((other) => other !== id)
    seen.unshift(id)
    localStorage.setItem(KEY, JSON.stringify(seen.slice(0, LIMIT)))
  } catch {
    // Storage may be unavailable; the feed simply does not personalise for guests then.
  }
}
