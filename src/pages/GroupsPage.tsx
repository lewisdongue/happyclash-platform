import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { createGroup } from '@/api/groups'
import { useGroups } from '@/api/queries'
import { useRequireSession } from '@/app/requireSession'
import { PageHeader } from '@/components/layout/PageHeader'
import { ChoiceRow } from '@/components/ui/ChoiceRow'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { WorldPicker } from '@/components/ui/WorldPicker'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import { WORLDS } from '@/theme/worlds'
import type { Group, WorldId } from '@/types/domain'

/** Your groups first, then public groups to discover. */
export function GroupsPage() {
  const { data: groups = [], isLoading } = useGroups()
  const requireSession = useRequireSession()
  const [creating, setCreating] = useState(false)

  const mine = groups.filter((group) => group.isMember)
  const others = groups.filter((group) => !group.isMember)

  return (
    <div className="mx-auto min-h-dvh max-w-5xl pb-36 lg:px-8 lg:pb-12">
      <PageHeader
        back
        title="Groups"
        subtitle="Crews, schools, cities: clash together"
        actions={
          <button
            type="button"
            onClick={() => requireSession('create a group', () => setCreating(true))}
            className="pressable h-10 rounded-xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] px-4 text-sm font-extrabold text-world-ink shadow-[0_8px_20px_var(--world-glow)]"
          >
            New group
          </button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <h2 className="mx-4 mt-6 mb-3 text-[15px] font-extrabold lg:mx-0">Your groups</h2>
          {mine.length === 0 ? <EmptyState title="You are not in a group yet">Create one or join a group below.</EmptyState> : <GroupGrid groups={mine} />}

          <h2 className="mx-4 mt-8 mb-3 text-[15px] font-extrabold lg:mx-0">Discover</h2>
          {others.length === 0 ? <EmptyState title="No other public group yet" /> : <GroupGrid groups={others} />}
        </>
      )}

      <CreateGroupSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

export function GroupGrid({ groups }: { groups: Group[] }) {
  return (
    <ul className="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-0">
      {groups.map((group) => (
        <li key={group.id}>
          <GroupTile group={group} />
        </li>
      ))}
    </ul>
  )
}

export function GroupTile({ group }: { group: Group }) {
  const world = WORLDS[group.worldId]
  return (
    <Link
      to={`/g/${group.id}`}
      className="pressable flex items-center gap-3.5 rounded-[22px] border border-fg/8 p-3.5 transition-transform hover:-translate-y-0.5"
      style={{ background: `radial-gradient(100% 120% at 0% 0%, ${world.accent}26, transparent 60%), rgba(255,255,255,.03)` }}
    >
      <GroupBadge name={group.name} worldId={group.worldId} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold">{group.name}</span>
        <span className="block text-xs text-muted">
          {world.name} · {group.membersCount} {group.membersCount === 1 ? 'member' : 'members'}
          {group.visibility === 'private' && ' · Private'}
        </span>
      </span>
    </Link>
  )
}

/** A raised 3D tile with the group's initials, lit in its world color. */
export function GroupBadge({ name, worldId, size = 48 }: { name: string; worldId: WorldId; size?: number }) {
  const world = WORLDS[worldId]
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl font-extrabold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: `linear-gradient(160deg, ${world.accent}, ${world.accentDeep})`,
        color: world.onAccent,
        boxShadow: `inset 0 2px 0 rgba(255,255,255,.45), inset 0 -6px 12px rgba(0,0,0,.25), 0 10px 24px ${world.accent}55`,
      }}
    >
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('')}
    </span>
  )
}

function CreateGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const requireSession = useRequireSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { worldId: themeWorld } = useWorldTheme()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [worldId, setWorldId] = useState<WorldId>(themeWorld)
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = () =>
    requireSession('create a group', async (session) => {
      if (name.trim().length < 2) return setProblem('Give your group a name (2 characters or more).')
      setSaving(true)
      try {
        const id = await createGroup(session.user.id, { name, description, worldId, visibility })
        await queryClient.invalidateQueries({ queryKey: ['groups'] })
        onClose()
        navigate(`/g/${id}`)
      } catch {
        setProblem('The group could not be created. Try again.')
      } finally {
        setSaving(false)
      }
    })

  return (
    <Sheet open={open} title="New group" onClose={onClose}>
      <div className="flex max-h-[70dvh] flex-col gap-5 overflow-y-auto pb-1">
        <input
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          placeholder="Group name"
          className="h-12 w-full rounded-2xl border border-line bg-fg/5 px-4 text-[15px] outline-none placeholder:text-subtle focus:border-world"
        />
        <textarea
          value={description}
          maxLength={280}
          rows={2}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What brings this group together? (optional)"
          className="w-full resize-none rounded-2xl border border-line bg-fg/5 px-4 py-3 text-[15px] outline-none placeholder:text-subtle focus:border-world"
        />
        <WorldPicker value={worldId} onChange={setWorldId} />
        <ChoiceRow
          label="Who can join"
          value={visibility}
          onChange={setVisibility}
          choices={[
            { value: 'public', label: 'Anyone', hint: 'Listed publicly' },
            { value: 'private', label: 'Invite link', hint: 'Hidden from others' },
          ]}
        />
        {problem && <p role="alert" className="text-sm font-semibold text-[#ff8fa3]">{problem}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="pressable h-14 w-full rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-base font-extrabold text-world-ink shadow-[0_14px_34px_var(--world-glow)] disabled:opacity-60"
        >
          {saving ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </Sheet>
  )
}
