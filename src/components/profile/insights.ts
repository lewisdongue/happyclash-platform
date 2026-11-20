import type { WorldId } from '@/types/domain'

/** Consecutive days with a post, counting back from today (or yesterday). */
export function currentStreak(activeDays: string[], today = new Date()): number {
  const days = new Set(activeDays)
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const key = () => cursor.toISOString().slice(0, 10)
  if (!days.has(key())) cursor.setUTCDate(cursor.getUTCDate() - 1)
  let streak = 0
  while (days.has(key())) {
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

/** Worlds sorted by share of the talent's videos. */
export function worldShares(worlds: Partial<Record<WorldId, number>>): { id: WorldId; share: number }[] {
  const total = Object.values(worlds).reduce((sum, value) => sum + (value ?? 0), 0)
  if (total === 0) return []
  return (Object.entries(worlds) as [WorldId, number][])
    .map(([id, count]) => ({ id, share: count / total }))
    .sort((a, b) => b.share - a.share)
}

/** The last `weeks` × 7 days as ISO dates, oldest first, ending today (UTC). */
export function heatmapDays(weeks = 12, today = new Date()): string[] {
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Array.from({ length: weeks * 7 }, (_, index) => new Date(end - (weeks * 7 - 1 - index) * 86_400_000).toISOString().slice(0, 10))
}
