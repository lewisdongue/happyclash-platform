import { TrimSheet } from '@/components/create/TrimSheet'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { MAX_UPLOAD_BYTES, publishEntry, uploadMedia } from '@/api/publish'
import { useClash, useEntry } from '@/api/queries'
import { useAuthUi } from '@/app/auth'
import { useSession } from '@/app/session'
import { CameraRecorder, type Recording } from '@/components/create/CameraRecorder'
import { BoltIcon } from '@/components/icons/ActionIcons'
import { BackIcon, CameraIcon, CloseIcon, PlusIcon } from '@/components/icons/UiIcons'
import { LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { WorldPicker } from '@/components/ui/WorldPicker'
import { supabase } from '@/lib/supabase'
import { inspectVideo, type VideoFacts } from '@/lib/videoFile'
import { useWorldTheme } from '@/theme/WorldThemeProvider'
import { WORLDS } from '@/theme/worlds'
import type { WorldId } from '@/types/domain'

/** Every video on happyClash lasts one minute at most, recorded or uploaded. */
const MAX_SECONDS = 60
const CAPTION_LIMIT = 300

interface Draft {
  file: File
  previewUrl: string
  facts: VideoFacts
}

type Step = 'pick' | 'camera' | 'details' | 'publishing'

/**
 * One screen for every way of posting: a new video, a Clash Back
 * (`?answer=<entryId>`) or an entry into a Clash (`?clash=<clashId>`).
 */
export function CreatePage() {
  const [params] = useSearchParams()
  const answerId = params.get('answer') ?? undefined
  const clashId = params.get('clash') ?? undefined
  const navigate = useNavigate()
  const session = useSession()
  const { openAuth } = useAuthUi()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { worldId: themeWorld, setWorld } = useWorldTheme()

  const { data: original, isLoading: loadingOriginal } = useEntry(answerId)
  const { data: clash, isLoading: loadingClash } = useClash(clashId)

  const [step, setStep] = useState<Step>('pick')
  const [draft, setDraft] = useState<Draft | null>(null)
  const requestedWorld = params.get('world')
  const [worldId, setWorldId] = useState<WorldId>(requestedWorld && requestedWorld in WORLDS ? (requestedWorld as WorldId) : themeWorld)
  const [caption, setCaption] = useState('')
  const [progress, setProgress] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const filePicker = useRef<HTMLInputElement>(null)
  const systemCamera = useRef<HTMLInputElement>(null)

  const contextWorld = clash?.worldId ?? original?.worldId
  const maxSeconds = Math.min(MAX_SECONDS, clash?.maxSeconds ?? MAX_SECONDS)

  // The screen takes the color of the world the video is going to.
  useEffect(() => {
    if (!contextWorld) setWorld(worldId)
    // Only on arrival: later changes go through the picker.
  }, [])

  useEffect(() => {
    if (contextWorld) {
      setWorldId(contextWorld)
      setWorld(contextWorld)
    }
  }, [contextWorld, setWorld])

  useEffect(() => {
    // Ask the stored session directly: the context is still empty on first render.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) openAuth('signup', 'Create your account to publish your talent.')
    })
  }, [openAuth])

  useEffect(() => () => {
    if (draft) URL.revokeObjectURL(draft.previewUrl)
  }, [draft])

  const [longVideo, setLongVideo] = useState<{ file: File; durationMs: number } | null>(null)

  const accept = useCallback(
    async (file: File, knownDurationMs?: number) => {
      setProblem(null)
      try {
        const facts = await inspectVideo(file, knownDurationMs)
        // Too long: let the talent pick the minute to keep instead of refusing the video.
        if (facts.durationMs > maxSeconds * 1000 + 500) {
          setLongVideo({ file, durationMs: facts.durationMs })
          return
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          setProblem(`This video is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is 50 MB: record in the app or pick a shorter clip.`)
          setStep('pick')
          return
        }
        setDraft({ file, previewUrl: URL.createObjectURL(file), facts })
        setStep('details')
      } catch (error) {
        setProblem(error instanceof Error ? error.message : 'This video could not be read.')
        setStep('pick')
      }
    },
    [maxSeconds],
  )

  const onRecorded = useCallback((recording: Recording) => void accept(recording.file, recording.durationMs), [accept])
  const onCameraUnavailable = useCallback((reason: string) => {
    setStep('pick')
    setProblem(reason)
    // Phones still have their own camera app behind a file input.
    systemCamera.current?.click()
  }, [])

  const publish = async () => {
    if (!draft) return
    if (!session) return openAuth('signup', 'Create your account to publish your talent.')
    setStep('publishing')
    setProgress(0)
    try {
      const userId = session.user.id
      const posterUpload = draft.facts.poster ? uploadMedia(draft.facts.poster, userId) : Promise.resolve(null)
      const [videoUrl, posterUrl] = await Promise.all([uploadMedia(draft.file, userId, setProgress), posterUpload])
      const id = await publishEntry({
        authorId: userId,
        caption,
        worldId,
        videoUrl,
        posterUrl,
        width: draft.facts.width,
        height: draft.facts.height,
        durationMs: draft.facts.durationMs,
        answersEntryId: answerId ?? null,
        clashId: clashId ?? null,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
        queryClient.invalidateQueries({ queryKey: ['author-entries', userId] }),
        answerId && queryClient.invalidateQueries({ queryKey: ['clash-backs', answerId] }),
        clashId && queryClient.invalidateQueries({ queryKey: ['clash-entries', clashId] }),
        clashId && queryClient.invalidateQueries({ queryKey: ['clashes'] }),
      ])
      toast(answerId ? 'Your Clash Back is live' : clashId ? 'You are in the Clash' : 'Your video is live')
      if (answerId) navigate(`/duel/${answerId}/${id}`, { replace: true })
      else if (clashId) navigate(`/c/${clashId}`, { replace: true })
      else navigate(`/?v=${id}`, { replace: true })
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Publishing failed. Try again.')
      setStep('details')
    }
  }

  const heading = useMemo(() => {
    if (clash) return { kicker: 'Enter the Clash', title: clash.title }
    if (original) return { kicker: 'Clash Back', title: `Answer @${original.author.handle}` }
    return { kicker: 'New video', title: 'Show your talent' }
  }, [clash, original])

  if ((answerId && loadingOriginal) || (clashId && loadingClash)) {
    return <div className="fixed inset-0 z-50 bg-ink"><LoadingState /></div>
  }
  const missing = (answerId && !original) || (clashId && !clash)
  const clashClosed = clash && clash.status !== 'open'

  const close = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink bg-[radial-gradient(90%_55%_at_50%_0%,var(--world-soft),transparent_65%)]">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 pt-[calc(var(--safe-top)+14px)] pb-[calc(var(--safe-bottom)+24px)] lg:px-8 lg:pt-8">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={step === 'details' ? () => setStep('pick') : close}
            disabled={step === 'publishing'}
            aria-label={step === 'details' ? 'Choose another video' : 'Close'}
            className="pressable grid size-10 place-items-center rounded-xl bg-fg/7 disabled:opacity-30"
          >
            {step === 'details' ? <BackIcon /> : <CloseIcon />}
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-widest text-world uppercase">{heading.kicker}</p>
            <h1 className="truncate text-lg font-extrabold">{heading.title}</h1>
          </div>
        </header>

        {missing ? (
          <Notice>This {answerId ? 'video' : 'Clash'} is no longer available.</Notice>
        ) : clashClosed ? (
          <Notice>{clash.status === 'scheduled' ? 'This Clash has not opened yet.' : 'This Clash has ended.'}</Notice>
        ) : step === 'details' || step === 'publishing' ? (
          draft && (
            <div className="mt-5 flex flex-1 flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
              <div className="relative mx-auto aspect-[9/16] w-[min(62vw,280px)] shrink-0 overflow-hidden rounded-[26px] bg-black shadow-[0_0_0_2px_var(--world-a),0_30px_70px_var(--world-glow)] lg:w-[340px]">
                <PreviewVideo src={draft.previewUrl} />
                <span className="tabular absolute top-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-extrabold backdrop-blur-md">
                  {(draft.facts.durationMs / 1000).toFixed(1)}s
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-5">
                {original && (
                  <div className="flex items-center gap-3 rounded-2xl border border-line bg-fg/4 p-3">
                    <BoltIcon size={20} />
                    <p className="text-sm text-muted">
                      Your answer joins the chain of <span className="font-extrabold text-text"><span translate="no" className="notranslate">@{original.author.handle}</span></span> and opens a duel.
                    </p>
                  </div>
                )}
                {clash && (
                  <div className="rounded-2xl border border-line bg-fg/4 p-3 text-sm text-muted">
                    One entry per talent. {clash.judging === 'community' ? 'Sparks decide the winner.' : `@${clash.creator.handle} picks the winner.`}
                  </div>
                )}

                <WorldPicker
                  value={worldId}
                  onChange={(world) => {
                    setWorldId(world)
                    setWorld(world)
                  }}
                  locked={Boolean(contextWorld)}
                />

                <label className="block">
                  <span className="mb-2 flex justify-between text-[11px] font-extrabold tracking-widest text-muted uppercase">
                    Caption <span className="tabular">{caption.length}/{CAPTION_LIMIT}</span>
                  </span>
                  <textarea
                    value={caption}
                    onChange={(event) => setCaption(event.target.value.slice(0, CAPTION_LIMIT))}
                    rows={3}
                    placeholder="What's your talent saying?"
                    className="w-full resize-none rounded-2xl border border-line bg-fg/5 px-4 py-3 text-[15px] outline-none placeholder:text-subtle focus:border-world"
                  />
                </label>

                {problem && <p role="alert" className="text-sm font-semibold text-[#ff8fa3]">{problem}</p>}

                <button
                  type="button"
                  onClick={publish}
                  disabled={step === 'publishing'}
                  className="pressable relative mt-auto h-[60px] w-full overflow-hidden rounded-[20px] bg-fg/8 text-base font-extrabold text-world-ink shadow-[0_14px_34px_var(--world-glow)] lg:mt-2"
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-[linear-gradient(180deg,var(--world-a),var(--world-b))] transition-[width] duration-300"
                    style={{ width: step === 'publishing' ? `${Math.max(6, progress * 100)}%` : '100%' }}
                  />
                  <span className={clsx('relative', step === 'publishing' && progress < 0.5 && 'text-text')}>
                    {step === 'publishing' ? (progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : 'Publishing…') : 'Publish'}
                  </span>
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="mt-8 flex flex-1 flex-col">
            <div className="grid gap-3 sm:grid-cols-2 lg:mt-6 lg:gap-5">
              <SourceCard
                title="Record"
                hint={`Film yourself, up to ${maxSeconds}s`}
                icon={<CameraIcon size={28} />}
                primary
                onClick={() => {
                  setProblem(null)
                  setStep('camera')
                }}
              />
              <SourceCard title="Upload" hint="Pick a video from your device" icon={<PlusIcon size={28} />} onClick={() => filePicker.current?.click()} />
            </div>
            {longVideo && (
              <TrimSheet
                file={longVideo.file}
                durationMs={longVideo.durationMs}
                maxSeconds={maxSeconds}
                onCancel={() => setLongVideo(null)}
                onDone={(clip, clipMs) => {
                  setLongVideo(null)
                  void accept(clip, clipMs)
                }}
              />
            )}
            {problem && <p role="alert" className="mt-5 text-center text-sm font-semibold text-[#ff8fa3]">{problem}</p>}
            <p className="mt-auto pt-10 text-center text-xs text-muted">Up to 1 minute · vertical looks best · MP4, MOV or WebM</p>
          </div>
        )}
      </div>

      <input
        ref={filePicker}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void accept(file)
        }}
      />
      <input
        ref={systemCamera}
        type="file"
        accept="video/*"
        capture="user"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void accept(file)
        }}
      />

      {step === 'camera' && <CameraRecorder maxSeconds={maxSeconds} onDone={onRecorded} onCancel={() => setStep('pick')} onUnavailable={onCameraUnavailable} />}
    </div>
  )
}

function SourceCard({ title, hint, icon, primary = false, onClick }: { title: string; hint: string; icon: ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'pressable group relative flex h-[150px] flex-col justify-end overflow-hidden rounded-[26px] p-5 text-left lg:h-[260px]',
        primary
          ? 'bg-[linear-gradient(160deg,var(--world-a),var(--world-b))] text-world-ink shadow-[0_20px_50px_var(--world-glow),inset_0_1px_0_rgba(255,255,255,.5)]'
          : 'border border-line bg-fg/5',
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'absolute top-5 right-5 grid size-16 place-items-center rounded-2xl transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-6 lg:size-24',
          primary ? 'bg-black/12 shadow-[inset_0_-6px_14px_rgba(0,0,0,.18)]' : 'bg-fg/7',
        )}
      >
        {icon}
      </span>
      <span className="text-2xl font-extrabold lg:text-3xl">{title}</span>
      <span className={clsx('mt-1 text-sm', primary ? 'text-world-ink/75' : 'text-muted')}>{hint}</span>
    </button>
  )
}

/** Plays the draft with sound; falls back to muted if the browser refuses. */
function PreviewVideo({ src }: { src: string }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = video.current
    if (!element) return
    element.play().catch(() => {
      element.muted = true
      void element.play().catch(() => undefined)
    })
  }, [src])
  return <video ref={video} src={src} loop playsInline onClick={(event) => (event.currentTarget.muted = !event.currentTarget.muted)} className="size-full object-cover" />
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="mt-16 rounded-3xl border border-dashed border-fg/12 px-6 py-10 text-center text-base font-extrabold">{children}</p>
}
