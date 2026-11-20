import { useShare } from '@/components/ui/ShareSheet'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthorEntries, useIsFollowing, useProfile, useProfileStats } from '@/api/queries'
import { setFollow } from '@/api/social'
import { useSession } from '@/app/session'
import { useRequireSession } from '@/app/requireSession'
import { BoltIcon, PassIcon, SparkIcon } from '@/components/icons/ActionIcons'
import { GearIcon } from '@/components/icons/GearIcon'
import { VerifiedBadge } from '@/components/icons/UiIcons'
import { PageHeader } from '@/components/layout/PageHeader'
import { TalentOptions, useHasBlocked } from '@/components/safety/TalentOptions'
import { useBlockTalent } from '@/components/safety/useBlockTalent'
import { ActivityHeatmap } from '@/components/profile/ActivityHeatmap'
import { EditProfileSheet } from '@/components/profile/EditProfileSheet'
import { FollowListSheet } from '@/components/profile/FollowListSheet'
import { currentStreak, worldShares } from '@/components/profile/insights'
import { TalentDna } from '@/components/profile/TalentDna'
import { PLATFORM_NAMES } from '@/components/profile/VerificationSheet'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { compactNumber } from '@/lib/format'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import { WORLDS } from '@/theme/worlds'

const countryName = new Intl.DisplayNames(['en'], { type: 'region' })

export function ProfilePage() {
  const { handle } = useParams()
  const { data: profile, isLoading } = useProfile(handle)
  const { data: stats } = useProfileStats(profile?.id)
  const { data: videos = [] } = useAuthorEntries(profile?.id)
  const { setWorld } = useWorldTheme()
  const requireSession = useRequireSession()
  const toast = useToast()
  const shareLink = useShare()
  const session = useSession()
  const queryClient = useQueryClient()
  const { data: following = false } = useIsFollowing(session?.user.id, profile?.id)
  const isMe = Boolean(session && profile && session.user.id === profile.id)
  const blocked = useHasBlocked(profile?.id)
  const blockTalent = useBlockTalent()
  const [editing, setEditing] = useState(false)
  const [list, setList] = useState<'followers' | 'following' | null>(null)

  // The profile takes the color of the talent's main world.
  const mainWorld = stats ? worldShares(stats.worlds)[0]?.id : undefined
  useEffect(() => {
    if (mainWorld) setWorld(mainWorld)
  }, [mainWorld, setWorld])

  if (isLoading) return <LoadingState />
  if (!profile) return <div className="pt-32"><EmptyState title="This talent does not exist">Check the link and try again.</EmptyState></div>

  const joined = new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const share = () => shareLink({ title: `${profile.displayName} on happyClash`, url: `${window.location.origin}/u/${profile.handle}` })

  return (
    <div className="relative mx-auto min-h-dvh max-w-6xl overflow-x-clip pb-36 lg:px-8 lg:pb-12">
      <div aria-hidden="true" className="animate-breathe pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(70%_80%_at_50%_0%,var(--world-soft),transparent_70%)]" />

      <div className="relative">
        <PageHeader
          back
          title=""
          actions={
            isMe ? (
              <Link to="/settings" aria-label="Settings" className="pressable grid size-10 place-items-center rounded-xl bg-fg/7">
                <GearIcon />
              </Link>
            ) : profile ? (
              <TalentOptions talent={profile} />
            ) : undefined
          }
        />

        <div className="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-10">
          <section className="flex flex-col items-center px-4 pt-2 text-center lg:sticky lg:top-24 lg:rounded-[32px] lg:border lg:border-line lg:bg-fg/[.035] lg:p-8">
            <div className="relative">
              <span aria-hidden="true" className="animate-breathe absolute -inset-6 rounded-full bg-[radial-gradient(closest-side,var(--world-glow),transparent)]" />
              <Avatar name={profile.displayName} src={profile.avatarUrl} size={112} ring className="relative" />
            </div>
            <h1 className="mt-5 flex items-center gap-2 text-[28px] font-extrabold tracking-tight">
              <span translate="no" className="notranslate">{profile.displayName}</span>
              {profile.verified && <VerifiedBadge size={20} />}
            </h1>
            <p className="mt-1 text-sm text-muted">
              <span translate="no" className="notranslate">@{profile.handle}</span>
              {profile.country && ` · ${countryName.of(profile.country)}`}
            </p>
            {profile.verified && profile.verifiedUrl && profile.verifiedPlatform && (
              <a
                href={profile.verifiedUrl}
                target="_blank"
                rel="noreferrer"
                className="pressable mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#1D9BF0]/35 bg-[#1D9BF0]/10 px-3 py-1.5 text-xs font-bold text-[#1D9BF0]"
              >
                <VerifiedBadge size={14} />
                <span className="truncate">Verified with {PLATFORM_NAMES[profile.verifiedPlatform]}</span>
              </a>
            )}
            {profile.bio && <p className="mt-3 max-w-sm text-sm leading-relaxed">{profile.bio}</p>}
            <p className="mt-2 text-xs text-subtle">On happyClash since {joined}</p>

            <div className="mt-6 grid w-full max-w-sm grid-cols-3 divide-x divide-fg/8 rounded-2xl border border-line bg-fg/[.03] py-4">
              <Stat value={stats?.followers} label="Followers" onClick={() => setList('followers')} />
              <Stat value={stats?.following} label="Following" onClick={() => setList('following')} />
              <Stat value={stats?.sparksReceived} label="Sparks" accent />
            </div>

            <div className="mt-4 flex w-full max-w-sm gap-2.5">
              {isMe ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="pressable h-12 flex-1 rounded-2xl border border-fg/12 bg-fg/6 text-[15px] font-extrabold"
                >
                  Edit profile
                </button>
              ) : blocked ? (
                <button
                  type="button"
                  onClick={() => blockTalent(profile, false)}
                  className="pressable h-12 flex-1 rounded-2xl border border-[#ff4d6d]/40 bg-[#ff4d6d]/10 text-[15px] font-extrabold text-[#ff6b81]"
                >
                  Blocked · Unblock
                </button>
              ) : (
                <button
                  type="button"
                  aria-pressed={following}
                  onClick={() =>
                    requireSession(`follow ${profile.displayName}`, async (active) => {
                      try {
                        await setFollow(active.user.id, profile.id, !following)
                        await Promise.all([
                          queryClient.invalidateQueries({ queryKey: ['is-following'] }),
                          queryClient.invalidateQueries({ queryKey: ['my-following'] }),
                          queryClient.invalidateQueries({ queryKey: ['profile-stats'] }),
                          queryClient.invalidateQueries({ queryKey: ['feed', 'following'] }),
                        ])
                      } catch {
                        toast('That did not work. Try again.')
                      }
                    })
                  }
                  className={
                    following
                      ? 'pressable h-12 flex-1 rounded-2xl border border-fg/12 bg-fg/6 text-[15px] font-extrabold'
                      : 'pressable h-12 flex-1 rounded-2xl bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] text-[15px] font-extrabold text-world-ink shadow-[0_12px_30px_var(--world-glow)]'
                  }
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
              <button type="button" onClick={share} aria-label="Share profile" className="pressable grid size-12 place-items-center rounded-2xl border border-line bg-fg/6">
                <PassIcon size={22} />
              </button>
            </div>
          </section>

          <div className="mt-8 flex flex-col gap-4 px-4 lg:mt-0 lg:px-0">
            {stats && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Insight icon={<BoltIcon size={20} />} value={stats.clashBacksReceived} label="Clash Backs received" />
                  <Insight icon={<Eye />} value={stats.views} label="Views" />
                  <Insight icon={<Globe />} value={stats.countriesReached} label="Countries reached" />
                  <Insight icon={<Flame />} value={currentStreak(stats.activeDays)} label="Day streak" />
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <TalentDna stats={stats} />
                  <ActivityHeatmap activeDays={stats.activeDays} />
                </div>
              </>
            )}

            <div className="mt-2 flex items-baseline justify-between">
              <h2 className="text-[15px] font-extrabold">Videos</h2>
              <span className="text-xs text-muted">{videos.length}</span>
            </div>
            {videos.length === 0 ? (
              <EmptyState title="No videos yet" />
            ) : (
              <ul className="grid grid-cols-3 gap-1.5 lg:grid-cols-4 lg:gap-3">
                {videos.map((video) => (
                  <li key={video.id}>
                    <Link to={`/?v=${video.id}`} data-theme="dark" className="group relative block aspect-[9/16] overflow-hidden rounded-xl lg:rounded-2xl" style={{ background: WORLDS[video.worldId].scene }}>
                      {video.posterUrl && <img src={video.posterUrl} alt={video.caption} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                      <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-[linear-gradient(transparent,rgba(5,6,8,.85))] p-2 text-[11px] font-extrabold">
                        <SparkIcon size={11} /> {compactNumber(video.sparks)}
                        <span className="ml-auto text-fg/70">{compactNumber(video.views)} views</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    <FollowListSheet profileId={profile.id} direction={list} onClose={() => setList(null)} />
      {isMe && <EditProfileSheet profile={profile} open={editing} onClose={() => setEditing(false)} />}
    </div>
  )
}

function Stat({ value, label, accent = false, onClick }: { value?: number; label: string; accent?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag {...(onClick ? { type: 'button' as const, onClick } : {})} className="flex flex-col items-center">
      <span className={accent ? 'tabular text-xl font-extrabold text-world' : 'tabular text-xl font-extrabold'}>{value === undefined ? '–' : compactNumber(value)}</span>
      <span className="mt-0.5 text-[11px] font-semibold text-muted">{label}</span>
    </Tag>
  )
}

function Insight({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-3xl border border-line bg-fg/[.035] p-4">
      <span className="grid size-9 place-items-center rounded-xl bg-world-soft text-world">{icon}</span>
      <p className="tabular mt-3 text-2xl font-extrabold">{compactNumber(value)}</p>
      <p className="text-xs font-semibold text-muted">{label}</p>
    </div>
  )
}

const iconProps = { width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
const Eye = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const Globe = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
)
const Flame = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3 1-5.5 1-7.5z" />
  </svg>
)
