import { supabase } from '@/lib/supabase'
import { initialsOf } from '@/lib/initials'
import type { RankingRow } from '@/types/domain'

export type RankingBoard = 'talents' | 'groups' | 'countries'
export type RankingPeriod = 'week' | 'month' | 'all'

const PERIOD_DAYS: Record<RankingPeriod, number | null> = { week: 7, month: 30, all: null }

function sinceOf(period: RankingPeriod): string {
  const days = PERIOD_DAYS[period]
  return days === null ? '-infinity' : new Date(Date.now() - days * 86_400_000).toISOString()
}

const countryName = new Intl.DisplayNames(['en'], { type: 'region' })

/** DE → 🇩🇪 */
const flagOf = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((letter) => 0x1f1a5 + letter.charCodeAt(0)))

export async function fetchRanking(board: RankingBoard, period: RankingPeriod): Promise<RankingRow[]> {
  if (board === 'groups') {
    const { data, error } = await supabase.rpc('group_ranking', { p_since: sinceOf(period) })
    if (error) throw error
    return (data ?? []).map((row: { group_id: string; name: string; members: number; sparks: number }, index: number) => ({
      rank: index + 1,
      id: row.group_id,
      name: row.name,
      initials: initialsOf(row.name),
      detail: `${row.members} ${Number(row.members) === 1 ? 'member' : 'members'}`,
      points: Number(row.sparks),
      href: `/g/${row.group_id}`,
    }))
  }

  if (board === 'countries') {
    const { data, error } = await supabase.rpc('country_ranking', { p_since: sinceOf(period) })
    if (error) throw error
    return (data ?? []).map((row: { country: string; talents: number; sparks: number; videos: number }, index: number) => ({
      rank: index + 1,
      id: row.country,
      name: countryName.of(row.country) ?? row.country,
      initials: flagOf(row.country),
      detail: `${row.talents} ${Number(row.talents) === 1 ? 'talent' : 'talents'} · ${row.videos} ${Number(row.videos) === 1 ? 'video' : 'videos'}`,
      points: Number(row.sparks),
    }))
  }

  const { data, error } = await supabase.rpc('talent_ranking', { p_since: sinceOf(period) })
  if (error) throw error
  return (data ?? []).map(
    (row: { profile_id: string; handle: string; display_name: string; country: string | null; avatar_url: string | null; sparks: number; videos: number }, index: number) => ({
      rank: index + 1,
      id: row.profile_id,
      name: row.display_name,
      initials: initialsOf(row.display_name),
      imageUrl: row.avatar_url,
      detail: [row.country ? countryName.of(row.country) : null, `${row.videos} ${Number(row.videos) === 1 ? 'video' : 'videos'}`].filter(Boolean).join(' · '),
      points: Number(row.sparks),
      href: `/u/${row.handle}`,
    }),
  )
}
