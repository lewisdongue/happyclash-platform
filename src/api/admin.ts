import { supabase } from '@/lib/supabase'
import type { ReportReasonId, ReportTarget } from './safety'

/**
 * Admin Console data. Every call goes through a database function that
 * checks the caller's role first, so the console is only a view: nothing
 * here grants rights by itself.
 */

export type AdminRole = 'owner' | 'admin' | 'moderator'

export const ROLE_RANK: Record<AdminRole, number> = { moderator: 1, admin: 2, owner: 3 }

export const canAct = (role: AdminRole | null | undefined, needed: AdminRole) => Boolean(role && ROLE_RANK[role] >= ROLE_RANK[needed])

async function call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data as T
}

export const fetchMyAdminRole = () => call<AdminRole | null>('my_admin_role')

export interface AdminOverview {
  talents: number
  talents_today: number
  talents_week: number
  videos: number
  videos_today: number
  views_today: number
  sparks_today: number
  comments_today: number
  clashes_open: number
  clashes_scheduled: number
  groups: number
  verified: number
  suspended: number
  hidden_videos: number
  reports_open: number
  reports_child_safety: number
  approvals_pending: number
}

export const fetchAdminOverview = () => call<AdminOverview>('admin_overview')

export interface AdminReport {
  case_number: number
  status: 'open' | 'reviewing' | 'actioned' | 'dismissed'
  reason: ReportReasonId
  details: string | null
  target_type: ReportTarget
  target_label: string
  entry_id: string | null
  profile_id: string | null
  clash_id: string | null
  group_id: string | null
  comment_id: string | null
  target_handle: string | null
  reporter_handle: string | null
  moderator_note: string | null
  created_at: string
  same_target_reports: number
}

export const fetchAdminReports = (status: 'active' | 'closed') => call<AdminReport[]>('admin_reports', { p_status: status })

export const setReportStatus = (caseNumber: number, status: AdminReport['status'], note?: string) =>
  call<void>('admin_set_report_status', { p_case: caseNumber, p_status: status, p_note: note ?? null })

export interface AdminEntry {
  id: string
  caption: string
  world_id: string
  poster_url: string | null
  video_url: string
  author_handle: string
  reports_count: number
  sparks_count: number
  views_count: number
  hidden_at: string | null
  created_at: string
}

export const fetchAdminEntries = (filter: 'reported' | 'hidden' | 'recent') => call<AdminEntry[]>('admin_entries', { p_filter: filter })

export const setEntryHidden = (entryId: string, hidden: boolean) => call<void>('admin_set_entry_hidden', { p_entry: entryId, p_hidden: hidden })

export const deleteCommentAsAdmin = (commentId: string) => call<void>('admin_delete_comment', { p_comment: commentId })

export interface AdminUser {
  id: string
  handle: string
  display_name: string
  avatar_url: string | null
  email: string | null
  country: string | null
  verified: boolean
  verified_url: string | null
  suspended_at: string | null
  suspended_reason: string | null
  role: AdminRole | null
  videos: number
  followers: number
  reports_against: number
  created_at: string
  last_sign_in_at: string | null
}

export const fetchAdminUsers = (search: string) => call<AdminUser[]>('admin_users', { p_search: search })

export const unsuspendUser = (userId: string) => call<void>('admin_unsuspend', { p_user: userId })

export const revokeVerification = (userId: string) => call<void>('admin_revoke_verification', { p_user: userId })

export const setAdminRole = (userId: string, role: AdminRole | null) => call<void>('admin_set_role', { p_user: userId, p_role: role })

export interface AdminClash {
  id: string
  title: string
  world_id: string
  access: string
  format: string
  creator_handle: string
  starts_at: string
  ends_at: string
  entries: number
  status: 'scheduled' | 'open' | 'ended'
  created_at: string
}

export const fetchAdminClashes = () => call<AdminClash[]>('admin_clashes')

export const endClash = (clashId: string) => call<void>('admin_end_clash', { p_clash: clashId })

export interface AdminGroup {
  id: string
  name: string
  world_id: string
  visibility: string
  owner_handle: string
  members: number
  created_at: string
}

export const fetchAdminGroups = () => call<AdminGroup[]>('admin_groups')

export type ApprovalAction = 'suspend_user' | 'delete_entry' | 'delete_group'

export interface AdminApproval {
  id: string
  action: ApprovalAction
  target_id: string
  target_label: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requested_by_handle: string | null
  requested_at: string
  decided_by_handle: string | null
  decided_at: string | null
  mine: boolean
}

export const fetchApprovals = () => call<AdminApproval[]>('admin_approvals_list')

/** Critical actions need a second admin: this only files the request. */
export const requestApproval = (action: ApprovalAction, targetId: string, reason: string) =>
  call<string>('admin_request', { p_action: action, p_target: targetId, p_reason: reason })

export const decideApproval = (requestId: string, approve: boolean) => call<void>('admin_decide', { p_request: requestId, p_approve: approve })

export interface AuditEvent {
  id: number
  actor_handle: string | null
  action: string
  target_type: string
  target_id: string | null
  target_label: string | null
  details: Record<string, unknown>
  created_at: string
}

export const fetchAuditLog = () => call<AuditEvent[]>('admin_audit_log')

export interface TeamMember {
  user_id: string
  handle: string
  display_name: string
  avatar_url: string | null
  role: AdminRole
  created_at: string
}

export const fetchTeam = () => call<TeamMember[]>('admin_team')

export function describeAdminError(error: unknown): string {
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : ''
  if (message.includes('second_admin_required')) return 'Another admin must approve this. Four eyes on critical actions.'
  if (message.includes('already_requested')) return 'This is already waiting for approval.'
  if (message.includes('not_allowed')) return 'Your role does not allow this.'
  if (message.includes('not_found')) return 'It no longer exists or was already done.'
  return 'That did not work. Try again.'
}
