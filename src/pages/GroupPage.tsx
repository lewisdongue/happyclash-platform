import { useShare } from '@/components/ui/ShareSheet'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { deleteGroup, joinGroup, joinGroupWithCode, leaveGroup } from '@/api/groups'
import { useGroup, useGroupClashes, useGroupMembers } from '@/api/queries'
import { useRequireSession } from '@/app/requireSession'
import { useSession } from '@/app/session'
import { ClashCard } from '@/components/clash/ClashCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReportButton } from '@/components/safety/ReportButton'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmSheet } from '@/components/ui/ConfirmSheet'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import { WORLDS } from '@/theme/worlds'
import { GroupBadge } from './GroupsPage'

export function GroupPage() {
  const { groupId } = useParams()
  const session = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const shareLink = useShare()
  const queryClient = useQueryClient()
  const requireSession = useRequireSession()
  const { setWorld } = useWorldTheme()
  const { data: group, isLoading } = useGroup(groupId)
  const { data: members = [] } = useGroupMembers(groupId)
  const { data: clashes = [] } = useGroupClashes(groupId)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (group) setWorld(group.worldId)
  }, [group, setWorld])

  if (isLoading) return <LoadingState />
  if (!group) {
    return (
      <div className="pt-32">
        <EmptyState title="This group is not available">Private groups open with their invite link.</EmptyState>
      </div>
    )
  }

  const isOwner = session?.user.id === group.ownerId
  const refresh = () =>
    Promise.all(['group', 'group-members', 'groups', 'clashes'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))

  const membership = () =>
    requireSession('join this group', async (current) => {
      setBusy(true)
      try {
        if (group.isMember) await leaveGroup(group.id, current.user.id)
        else await joinGroup(group.id, current.user.id)
        await refresh()
        toast(group.isMember ? `You left ${group.name}` : `Welcome to ${group.name}`)
      } catch {
        toast('That did not work. Try again.')
      } finally {
        setBusy(false)
      }
    })

  const copyInvite = () => {
    if (group.inviteCode) shareLink({ title: `Join ${group.name} on happyClash`, url: `${window.location.origin}/join/${group.inviteCode}` })
  }

  const world = WORLDS[group.worldId]

  return (
    <div className="mx-auto min-h-dvh max-w-5xl pb-36 lg:px-8 lg:pb-12">
      <PageHeader back title="Group" actions={!isOwner ? <ReportButton target="group" targetId={group.id} /> : undefined} />

      <section
        data-theme="dark"
        className="relative mx-4 mt-3 overflow-hidden rounded-[30px] border border-fg/10 p-5 lg:mx-0"
        style={{ background: `radial-gradient(120% 90% at 0% 0%, ${world.accent}44, transparent 60%), linear-gradient(180deg, ${world.scene}, #08090d)` }}
      >
        <div className="flex items-center gap-4">
          <GroupBadge name={group.name} worldId={group.worldId} size={72} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold">{group.name}</h1>
            <p className="text-sm text-fg/70">
              {world.name} · {group.membersCount} {group.membersCount === 1 ? 'member' : 'members'}
              {group.visibility === 'private' && ' · Private'}
            </p>
          </div>
        </div>
        {group.description && <p className="mt-4 text-[15px] leading-relaxed text-fg/85">{group.description}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          {group.isMember ? (
            <>
              <button
                type="button"
                onClick={() => navigate(`/clash/new?group=${group.id}`)}
                className="pressable h-11 flex-1 rounded-xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] px-4 text-sm font-extrabold text-world-ink shadow-[0_10px_24px_var(--world-glow)]"
              >
                Start a group Clash
              </button>
              <button type="button" onClick={copyInvite} className="pressable h-11 rounded-xl bg-fg/8 px-4 text-sm font-extrabold">
                Invite
              </button>
              {!isOwner && (
                <button type="button" onClick={membership} disabled={busy} className="pressable h-11 rounded-xl bg-fg/8 px-4 text-sm font-extrabold text-muted">
                  Leave
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={membership}
              disabled={busy}
              className="pressable h-11 flex-1 rounded-xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] px-4 text-sm font-extrabold text-world-ink shadow-[0_10px_24px_var(--world-glow)]"
            >
              Join the group
            </button>
          )}
        </div>
      </section>

      <h2 className="mx-4 mt-8 mb-3 text-[15px] font-extrabold lg:mx-0">Clashes</h2>
      {clashes.length === 0 ? (
        <EmptyState title="No group Clash yet">{group.isMember ? 'Start one and challenge another group.' : null}</EmptyState>
      ) : (
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:px-0">
          {clashes.map((clash) => (
            <ClashCard key={clash.id} clash={clash} />
          ))}
        </div>
      )}

      <h2 className="mx-4 mt-8 mb-3 text-[15px] font-extrabold lg:mx-0">Members</h2>
      <ul className="grid gap-2 px-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-0">
        {members.map((member) => (
          <li key={member.id}>
            <Link to={`/u/${member.handle}`} className="pressable flex items-center gap-3 rounded-2xl border border-line bg-fg/4 p-3">
              <Avatar name={member.displayName} src={member.avatarUrl} size={40} ring={member.role === 'owner'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold"><span translate="no" className="notranslate">{member.displayName}</span></span>
                <span className="block truncate text-xs text-muted"><span translate="no" className="notranslate">@{member.handle}</span></span>
              </span>
              {member.role === 'owner' && <span className="text-[10.5px] font-extrabold tracking-wider text-world uppercase">Owner</span>}
            </Link>
          </li>
        ))}
      </ul>

      <ConfirmSheet
        open={confirmingDelete}
        title={`Delete ${group.name}?`}
        message="The group and its group Clashes are deleted for every member."
        confirmLabel="Delete"
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() =>
          deleteGroup(group.id)
            .then(refresh)
            .then(() => navigate('/groups', { replace: true }))
            .catch(() => toast('The group could not be deleted.'))
        }
      />

      {isOwner && (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="mx-4 mt-10 text-sm font-semibold text-muted underline-offset-4 hover:underline lg:mx-0"
        >
          Delete this group
        </button>
      )}
    </div>
  )
}

/** Landing page of a private group's invite link. */
export function JoinGroupPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const requireSession = useRequireSession()
  const queryClient = useQueryClient()
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!session || !code) return
    joinGroupWithCode(code)
      .then(async (groupId) => {
        await queryClient.invalidateQueries({ queryKey: ['groups'] })
        navigate(`/g/${groupId}`, { replace: true })
      })
      .catch((error: Error) => setProblem(error.message))
  }, [session, code, navigate, queryClient])

  return (
    <div className="mx-auto max-w-md px-4 pt-32 text-center">
      {problem ? (
        <EmptyState title={problem}>
          <Link to="/groups" className="font-bold text-world">
            See all groups
          </Link>
        </EmptyState>
      ) : session ? (
        <LoadingState label="Joining the group…" />
      ) : (
        <>
          <p className="text-2xl font-extrabold">You are invited to a group</p>
          <p className="mt-2 text-sm text-muted">Create your account or sign in to join it.</p>
          <button
            type="button"
            onClick={() => requireSession('join this group', () => undefined)}
            className="pressable mt-6 h-14 w-full rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-base font-extrabold text-world-ink"
          >
            Continue
          </button>
        </>
      )}
    </div>
  )
}
