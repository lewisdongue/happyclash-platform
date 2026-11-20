import { supabase } from '@/lib/supabase'

export type ReportTarget = 'entry' | 'user' | 'clash' | 'group' | 'comment'

export type ReportReasonId =
  | 'spam'
  | 'nudity'
  | 'violence'
  | 'hate'
  | 'harassment'
  | 'minor_safety'
  | 'impersonation'
  | 'copyright'
  | 'other'

export type CaseStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed'

/** HC-001042: the number a reporter quotes when following up on a case. */
export const formatCase = (caseNumber: number) => `HC-${String(caseNumber).padStart(6, '0')}`

export async function submitReport(
  target: ReportTarget,
  targetId: string,
  reason: ReportReasonId,
  details: string,
): Promise<{ caseId: string; alreadyReported: boolean }> {
  const { data, error } = await supabase.rpc('submit_report', {
    p_target_type: target,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details || null,
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as { case_number: number; already_reported: boolean }
  return { caseId: formatCase(row.case_number), alreadyReported: row.already_reported }
}

export interface MyReport {
  caseId: string
  target: ReportTarget
  label: string
  reason: ReportReasonId
  status: CaseStatus
  createdAt: string
}

export async function fetchMyReports(): Promise<MyReport[]> {
  const { data, error } = await supabase
    .from('safety_reports')
    .select('case_number, target_type, target_label, reason, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []).map((row) => ({
    caseId: formatCase(row.case_number),
    target: row.target_type as ReportTarget,
    label: row.target_label,
    reason: row.reason as ReportReasonId,
    status: row.status as CaseStatus,
    createdAt: row.created_at,
  }))
}

export interface BlockedTalent {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  blockedAt: string
}

export async function fetchBlocked(): Promise<BlockedTalent[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('created_at, blocked:profiles!blocks_blocked_id_fkey(id, handle, display_name, avatar_url)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).flatMap((row) => {
    const blocked = Array.isArray(row.blocked) ? row.blocked[0] : row.blocked
    if (!blocked) return []
    return [{ id: blocked.id, handle: blocked.handle, displayName: blocked.display_name, avatarUrl: blocked.avatar_url, blockedAt: row.created_at }]
  })
}

export async function setBlocked(userId: string, targetId: string, blocked: boolean): Promise<void> {
  const { error } = blocked
    ? await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: targetId })
    : await supabase.from('blocks').delete().match({ blocker_id: userId, blocked_id: targetId })
  if (error && error.code !== '23505') throw error
}

/** Database messages turned into words a talent understands. */
export function describeSafetyError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : ''
  if (message.includes('rate_limited')) return 'Slow down a little and try again in a moment.'
  if (message.includes('suspended')) return 'Your account is suspended. Contact support to appeal.'
  if (message.includes('own_content')) return 'You cannot report your own content.'
  if (message.includes('not_found')) return 'This content no longer exists.'
  return 'That did not work. Try again.'
}
