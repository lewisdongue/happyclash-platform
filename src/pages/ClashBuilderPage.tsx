import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { createClash } from '@/api/clashes'
import { useGroups } from '@/api/queries'
import { useAuthUi } from '@/app/auth'
import { useSession } from '@/app/session'
import { formatRemaining } from '@/components/clash/Countdown'
import { PeoplePicker, type Person } from '@/components/clash/PeoplePicker'
import { BackIcon, CloseIcon } from '@/components/icons/UiIcons'
import { ChoiceRow } from '@/components/ui/ChoiceRow'
import { useToast } from '@/components/ui/Toast'
import { WorldPicker } from '@/components/ui/WorldPicker'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import { WORLDS } from '@/theme/worlds'
import type { ClashAccess, ClashFormat, ClashJudging, WorldId } from '@/types/domain'

const STEPS = ['Setup', 'Experience', 'People', 'Launch'] as const
type StepName = (typeof STEPS)[number]

const HOUR = 3600 * 1000
const DURATIONS = [
  { value: 1, label: '1 hour' },
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
]
const LENGTHS = [15, 30, 45, 60].map((value) => ({ value, label: `${value}s` }))

/** Local datetime for an `<input type="datetime-local">`, one hour from now by default. */
function localInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

/**
 * The Clash builder: four short steps with a live preview of the card
 * people will see. Everything is validated before the last step.
 */
export function ClashBuilderPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const session = useSession()
  const { openAuth } = useAuthUi()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { worldId: themeWorld, setWorld } = useWorldTheme()
  const { data: groups = [] } = useGroups()

  const presetGroup = params.get('group')
  const [step, setStep] = useState(0)
  const [access, setAccess] = useState<ClashAccess>(presetGroup ? 'group' : 'public')
  const [startNow, setStartNow] = useState(true)
  const [startAt, setStartAt] = useState(() => localInputValue(new Date(Date.now() + HOUR)))
  const [hours, setHours] = useState(24)
  const [title, setTitle] = useState('')
  const requestedWorld = params.get('world')
  const [worldId, setWorldId] = useState<WorldId>(requestedWorld && requestedWorld in WORLDS ? (requestedWorld as WorldId) : themeWorld)
  const [description, setDescription] = useState('')
  const [prize, setPrize] = useState('')
  const [rules, setRules] = useState('')
  const [maxSeconds, setMaxSeconds] = useState(60)
  const [judging, setJudging] = useState<ClashJudging>('community')
  const [format, setFormat] = useState<ClashFormat>(params.get('format') === 'live' ? 'live' : 'video')
  const [invitees, setInvitees] = useState<Person[]>([])
  const [groupId, setGroupId] = useState<string | null>(presetGroup)
  const [rivalGroupId, setRivalGroupId] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => setWorld(worldId), [worldId, setWorld])

  const myGroups = groups.filter((group) => group.isMember)
  const rivals = groups.filter((group) => group.id !== groupId && group.visibility === 'public')

  const startsAt = startNow ? new Date() : new Date(startAt)
  const endsAt = new Date(startsAt.getTime() + hours * HOUR)

  const stepErrors: Record<StepName, string | null> = {
    Setup: !startNow && !(startsAt.getTime() > Date.now()) ? 'Pick a start time in the future.' : null,
    Experience: title.trim().length < 3 ? 'Give your Clash a title (3 characters or more).' : null,
    People:
      access === 'group' && !groupId
        ? myGroups.length === 0
          ? 'Create or join a group first to start a group Clash.'
          : 'Choose the group that hosts this Clash.'
        : null,
    Launch: null,
  }
  const current = STEPS[step]

  const next = () => {
    const error = stepErrors[current]
    if (error) return setProblem(error)
    setProblem(null)
    setStep((value) => Math.min(STEPS.length - 1, value + 1))
  }

  const launch = async () => {
    if (!session) return openAuth('signup', 'Create your account to start a Clash.')
    const firstError = STEPS.map((name) => stepErrors[name]).find(Boolean)
    if (firstError) return setProblem(firstError)
    setLaunching(true)
    try {
      const id = await createClash(session.user.id, {
        title,
        description,
        worldId,
        access,
        groupId,
        rivalGroupId,
        prize,
        rules,
        maxSeconds,
        judging,
        format,
        startsAt: startNow ? null : startsAt,
        endsAt,
        inviteeIds: invitees.map((person) => person.id),
      })
      await queryClient.invalidateQueries({ queryKey: ['clashes'] })
      toast(format === 'live' ? 'Your live is ready' : startNow ? 'Your Clash is open' : 'Your Clash is scheduled')
      navigate(format === 'live' ? `/live/${id}` : `/c/${id}`, { replace: true })
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The Clash could not be created. Try again.')
      setLaunching(false)
    }
  }

  const preview = useMemo(
    () => ({ title: title.trim() || 'Your Clash title', worldId, access, hours, startNow, prize: prize.trim(), maxSeconds }),
    [title, worldId, access, hours, startNow, prize, maxSeconds],
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink bg-[radial-gradient(90%_55%_at_50%_0%,var(--world-soft),transparent_65%)]">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 pt-[calc(var(--safe-top)+14px)] pb-[calc(var(--safe-bottom)+24px)] lg:px-8 lg:pt-8">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}
            aria-label={step === 0 ? 'Close' : 'Previous step'}
            className="pressable grid size-10 place-items-center rounded-xl bg-fg/7"
          >
            {step === 0 ? <CloseIcon /> : <BackIcon />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold tracking-widest text-world uppercase">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="text-lg font-extrabold">{current === 'Launch' ? 'Ready to launch' : current}</h1>
          </div>
        </header>

        <ol aria-hidden="true" className="mt-4 grid grid-cols-4 gap-1.5">
          {STEPS.map((name, index) => (
            <li key={name} className={clsx('h-1 rounded-full transition-colors duration-500', index <= step ? 'bg-world shadow-[0_0_10px_var(--world-glow)]' : 'bg-fg/10')} />
          ))}
        </ol>

        <div className="mt-6 flex flex-1 flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-1 flex-col">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col gap-6"
              >
                {current === 'Setup' && (
                  <>
                    <ChoiceRow
                      label="Format"
                      value={format}
                      onChange={setFormat}
                      choices={[
                        { value: 'video', label: 'Videos', hint: 'Talents post entries' },
                        { value: 'live', label: 'Live', hint: 'On stage, in real time' },
                      ]}
                    />
                    <ChoiceRow
                      label="Who can join"
                      value={access}
                      onChange={setAccess}
                      choices={[
                        { value: 'public', label: 'Public', hint: 'Open to all' },
                        { value: 'private', label: 'Private', hint: 'Invited talents' },
                        { value: 'group', label: 'Group', hint: 'Group vs group' },
                      ]}
                    />
                    <ChoiceRow
                      label="Start"
                      value={startNow ? 'now' : 'later'}
                      onChange={(value) => setStartNow(value === 'now')}
                      choices={[
                        { value: 'now', label: 'Now', hint: 'Opens instantly' },
                        { value: 'later', label: 'Later', hint: 'With countdown' },
                      ]}
                    />
                    {!startNow && (
                      <Field label="Opens on">
                        <input
                          type="datetime-local"
                          value={startAt}
                          min={localInputValue(new Date())}
                          onChange={(event) => setStartAt(event.target.value)}
                          className="h-12 w-full rounded-2xl border border-line bg-fg/5 px-4 text-[15px] outline-none [color-scheme:dark] focus:border-world"
                        />
                      </Field>
                    )}
                    <ChoiceRow label="Open for" value={hours} onChange={setHours} choices={DURATIONS} />
                  </>
                )}

                {current === 'Experience' && (
                  <>
                    <Field label="Title" counter={`${title.length}/80`}>
                      <input
                        value={title}
                        maxLength={80}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Best freestyle on a 90s beat"
                        className="h-12 w-full rounded-2xl border border-line bg-fg/5 px-4 text-[15px] outline-none placeholder:text-subtle focus:border-world"
                      />
                    </Field>
                    <WorldPicker value={worldId} onChange={setWorldId} />
                    <Field label="The challenge" counter={`${description.length}/500`}>
                      <textarea
                        value={description}
                        maxLength={500}
                        rows={3}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Tell talents exactly what to show."
                        className="w-full resize-none rounded-2xl border border-line bg-fg/5 px-4 py-3 text-[15px] outline-none placeholder:text-subtle focus:border-world"
                      />
                    </Field>
                    <Field label="Prize (optional)" counter={`${prize.length}/120`}>
                      <input
                        value={prize}
                        maxLength={120}
                        onChange={(event) => setPrize(event.target.value)}
                        placeholder="A feature on the happyClash home"
                        className="h-12 w-full rounded-2xl border border-line bg-fg/5 px-4 text-[15px] outline-none placeholder:text-subtle focus:border-world"
                      />
                    </Field>
                    <Field label="Rules (optional)" counter={`${rules.length}/500`}>
                      <textarea
                        value={rules}
                        maxLength={500}
                        rows={2}
                        onChange={(event) => setRules(event.target.value)}
                        placeholder="One take, no filters, original sound."
                        className="w-full resize-none rounded-2xl border border-line bg-fg/5 px-4 py-3 text-[15px] outline-none placeholder:text-subtle focus:border-world"
                      />
                    </Field>
                    {format === 'video' && <ChoiceRow label="Video length" value={maxSeconds} onChange={setMaxSeconds} choices={LENGTHS} />}
                    <ChoiceRow
                      label="Winner"
                      value={judging}
                      onChange={setJudging}
                      choices={[
                        { value: 'community', label: 'Community', hint: 'Most Sparks wins' },
                        { value: 'creator', label: 'Me', hint: 'I pick the winner' },
                      ]}
                    />
                  </>
                )}

                {current === 'People' && access === 'public' && (
                  <p className="rounded-3xl border border-line bg-fg/4 p-5 text-sm leading-relaxed text-muted">
                    Everyone on happyClash can see and enter a public Clash. Once it is live, share its link to bring talents in.
                  </p>
                )}
                {current === 'People' && access === 'private' && (
                  <Field label="Invite talents">
                    <PeoplePicker selected={invitees} onChange={setInvitees} selfId={session?.user.id} />
                    <p className="mt-3 text-xs text-muted">Only the people you invite can see and enter. You can invite more later.</p>
                  </Field>
                )}
                {current === 'People' && access === 'group' && (
                  <>
                    <GroupChooser
                      label="Your group"
                      empty="You are not in a group yet. Create one from the Clash tab, then come back."
                      groups={myGroups}
                      value={groupId}
                      onChange={(id) => {
                        setGroupId(id)
                        if (id === rivalGroupId) setRivalGroupId(null)
                      }}
                    />
                    <GroupChooser
                      label="Rival group (optional)"
                      empty="No other public group yet. Without a rival, your group clashes among itself."
                      groups={rivals}
                      value={rivalGroupId}
                      onChange={(id) => setRivalGroupId(id === rivalGroupId ? null : id)}
                    />
                  </>
                )}

                {current === 'Launch' && (
                  <dl className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-fg/4">
                    <Summary label="Title" value={title.trim()} />
                    <Summary label="World" value={WORLDS[worldId].name} />
                    <Summary label="Access" value={access === 'group' ? `Group · ${groups.find((g) => g.id === groupId)?.name ?? ''}${rivalGroupId ? ` vs ${groups.find((g) => g.id === rivalGroupId)?.name ?? ''}` : ''}` : access === 'private' ? `Private · ${invitees.length} invited` : 'Public'} />
                    <Summary label="Opens" value={startNow ? 'Right after launch' : startsAt.toLocaleString()} />
                    <Summary label="Closes" value={endsAt.toLocaleString()} />
                    <Summary label="Videos" value={`Up to ${maxSeconds}s`} />
                    <Summary label="Winner" value={judging === 'community' ? 'Most Sparks' : 'Picked by you'} />
                    {prize.trim() && <Summary label="Prize" value={prize.trim()} />}
                  </dl>
                )}
              </motion.div>
            </AnimatePresence>

            {problem && <p role="alert" className="mt-5 text-sm font-semibold text-[#ff8fa3]">{problem}</p>}

            <button
              type="button"
              onClick={current === 'Launch' ? launch : next}
              disabled={launching}
              className="pressable mt-8 h-[60px] w-full rounded-[20px] bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-base font-extrabold text-world-ink shadow-[0_14px_34px_var(--world-glow)] disabled:opacity-60 lg:max-w-md"
            >
              {current === 'Launch' ? (launching ? 'Launching…' : 'Launch the Clash') : 'Continue'}
            </button>
          </div>

          <aside className="mx-auto w-full max-w-[320px] lg:sticky lg:top-8 lg:mx-0 lg:w-[340px] lg:max-w-none">
            <p className="mb-3 text-center text-[11px] font-extrabold tracking-widest text-muted uppercase lg:text-left">Live preview</p>
            <PreviewCard {...preview} />
          </aside>
        </div>
      </div>
    </div>
  )
}

function Field({ label, counter, children }: { label: string; counter?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex justify-between text-[11px] font-extrabold tracking-widest text-muted uppercase">
        {label}
        {counter && <span className="tabular">{counter}</span>}
      </p>
      {children}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-3.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-extrabold">{value}</dd>
    </div>
  )
}

interface GroupChooserProps {
  label: string
  empty: string
  groups: { id: string; name: string; membersCount: number; worldId: WorldId }[]
  value: string | null
  onChange: (id: string) => void
}

function GroupChooser({ label, empty, groups, value, onChange }: GroupChooserProps) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-extrabold tracking-widest text-muted uppercase">{label}</p>
      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-fg/12 p-4 text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.map((group) => {
            const active = group.id === value
            return (
              <button
                key={group.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(group.id)}
                className={clsx('pressable flex items-center gap-3 rounded-2xl border p-3 text-left', active ? 'border-world bg-world-soft' : 'border-line bg-fg/4')}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold" style={{ background: WORLDS[group.worldId].accent, color: WORLDS[group.worldId].onAccent }}>
                  {group.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold">{group.name}</span>
                  <span className="text-xs text-muted">
                    {group.membersCount} {group.membersCount === 1 ? 'member' : 'members'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface PreviewCardProps {
  title: string
  worldId: WorldId
  access: ClashAccess
  hours: number
  startNow: boolean
  prize: string
  maxSeconds: number
}

/** The card exactly as talents will discover it, floating in 3D. */
function PreviewCard({ title, worldId, access, hours, startNow, prize, maxSeconds }: PreviewCardProps) {
  const world = WORLDS[worldId]
  return (
    <div className="[perspective:1000px]">
      <motion.div
        animate={{ rotateY: [-8, 8, -8], rotateX: [4, -2, 4] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        data-theme="dark"
        className="relative h-[400px] overflow-hidden rounded-[30px] border border-fg/10 p-6 [transform-style:preserve-3d]"
        style={{
          background: `radial-gradient(120% 80% at 15% 0%, ${world.accent}66, transparent 60%), radial-gradient(90% 70% at 100% 100%, ${world.accentDeep}44, transparent 60%), linear-gradient(180deg, ${world.scene}, #07080c)`,
          boxShadow: `0 40px 90px ${world.accent}33, 0 30px 60px rgba(0,0,0,.6)`,
        }}
      >
        <span className="absolute -top-16 -right-16 size-56 rounded-full blur-3xl" style={{ background: `${world.accent}40` }} />
        <div className="relative flex h-full flex-col [transform:translateZ(40px)]">
          <div className="flex gap-1.5">
            <span className="flex h-6 items-center rounded-full px-3 text-[10.5px] font-extrabold tracking-wider uppercase" style={{ background: world.accent, color: world.onAccent }}>
              {world.name}
            </span>
            <span className="flex h-6 items-center rounded-full bg-black/40 px-3 text-[10.5px] font-extrabold tracking-wider text-fg/85 uppercase">{access}</span>
          </div>
          <p className="mt-auto text-[28px] leading-[1.05] font-extrabold tracking-tight break-words">{title}</p>
          {prize && <p className="mt-3 text-sm font-bold" style={{ color: world.accent }}>🏆 {prize}</p>}
          <div className="mt-5 flex justify-between border-t border-fg/10 pt-4 text-xs font-bold text-fg/70">
            <span>{startNow ? 'Opens now' : 'Countdown to start'}</span>
            <span className="tabular">Open {formatRemaining(hours * HOUR)}</span>
            <span>{maxSeconds}s videos</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
