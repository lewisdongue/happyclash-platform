import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import type * as THREE from 'three'
import { BackIcon } from '@/components/icons/UiIcons'
import { WORLDS } from '@/theme/worlds'
import type { City, DriveInput, Venue } from '@/life/city'
import type { Hall } from '@/life/hall'
import { startCrowdMurmur } from '@/life/crowd'
import { OUTFITS, VEHICLES, loadGarage, saveGarage, type Garage, type Vehicle } from '@/life/garage'
import { currentLanguage } from '@/lib/language'
import { useSession } from '@/app/session'
import { useAuthUi } from '@/app/auth'
import { findLiveByCode } from '@/api/live'
import { HallLive } from '@/life/HallLive'
import { LIFE_LANGUAGES, saveLifeLanguage, t, type LifeLanguage } from '@/life/i18n'

type Phase = 'language' | 'welcome' | 'loading' | 'driving' | 'elevator' | 'hall'

/**
 * Life: happyClash City in 3D. The visitor picks a language, gets in a car,
 * drives to one of the eight Talent World arenas (each marked by a beam of
 * light), opens the door, takes the elevator and sits in the hall.
 */
export function LifePage() {
  const navigate = useNavigate()
  // Life speaks the site's language, which itself follows the phone/browser language on a first visit.
  const [language, setLanguage] = useState<LifeLanguage>(() => currentLanguage())
  const [phase, setPhase] = useState<Phase>('welcome')
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)
  const [near, setNear] = useState<Venue | null>(null)
  const [target, setTarget] = useState<Venue | null>(null)
  const [venues, setVenues] = useState<Venue[]>([])
  const [currentVenue, setCurrentVenue] = useState<Venue | null>(null)
  const session = useSession()
  const { openAuth } = useAuthUi()
  const sessionRef = useRef(session)
  sessionRef.current = session
  const openAuthRef = useRef(openAuth)
  openAuthRef.current = openAuth
  const guestPromptAt = useRef(0)
  const [liveEvent, setLiveEvent] = useState<{ id: string; title: string; worldId: string } | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [liveStatus, setLiveStatus] = useState('')
  const [walking, setWalking] = useState(false)
  const [seated, setSeated] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [garage, setGarage] = useState<Garage>(loadGarage)

  const host = useRef<HTMLDivElement>(null)
  const minimap = useRef<HTMLCanvasElement>(null)
  const engine = useRef<{ renderer: THREE.WebGLRenderer; city: City; hall: Hall | null; mode: 'city' | 'hall' } | null>(null)
  const input = useRef<DriveInput>({ throttle: 0, steer: 0, brake: false })
  const targetRef = useRef<Venue | null>(null)
  const murmur = useRef<(() => void) | null>(null)
  const enterRef = useRef<((venue: Venue) => Promise<void>) | null>(null)
  const joinEventRef = useRef<((code: string) => Promise<void>) | null>(null)
  useEffect(() => () => murmur.current?.(), [])
  targetRef.current = target

  const chooseLanguage = (value: LifeLanguage) => {
    setLanguage(value)
    saveLifeLanguage(value)
    setPhase('welcome')
  }

  // ---------------------------------------------------------------------------
  // The 3D engine: loaded on demand, only when the visitor gets in the car.
  // ---------------------------------------------------------------------------

  const start = useCallback(async () => {
    // iPhone asks once for motion access; it must be requested from this tap.
    const motion = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent
    if (motion?.requestPermission) void motion.requestPermission().catch(() => undefined)
    setPhase('loading')
    setFailed(false)
    try {
      const [THREE, { City }] = await Promise.all([import('three'), import('@/life/city')])
      const container = host.current
      if (!container) return
      const renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 0.9
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      container.appendChild(renderer.domElement)

      const city = new City()
      await city.build(setProgress)
      const saved = loadGarage()
      city.setVehicle(saved.vehicle, saved.paint || undefined)
      city.setOutfit(saved.outfit)
      engine.current = { renderer, city, hall: null, mode: 'city' }
      setVenues(city.venues)
      setPhase('driving')
      // Deep link straight into a hall: /life?hall=music
      const direct = new URLSearchParams(location.search).get('hall')
      const venue = direct ? city.venues.find((item) => item.worldId === direct) : undefined
      if (venue) window.setTimeout(() => void enterRef.current?.(venue), 300)
      // Deep link to a live event: /life?live=CODE
      const liveParam = new URLSearchParams(location.search).get('live')
      if (liveParam) window.setTimeout(() => void joinEventRef.current?.(liveParam), 300)
    } catch {
      setFailed(true)
    }
  }, [])

  // Render loop and resizing.
  useEffect(() => {
    if (phase !== 'driving' && phase !== 'hall' && phase !== 'elevator') return
    let frame = 0
    let last = performance.now()
    const resize = () => {
      const current = engine.current
      if (!current || !host.current) return
      const { clientWidth: width, clientHeight: height } = host.current
      current.renderer.setSize(width, height)
      for (const camera of [current.city.camera, current.hall?.camera]) {
        if (!camera) continue
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
    }
    resize()
    window.addEventListener('resize', resize)

    let lastNear: Venue | null = null
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      const current = engine.current
      if (!current) return
      const delta = (now - last) / 1000
      last = now
      if (current.mode === 'city') {
        const state = current.city.update(delta, input.current)
        if (state.nearVenue !== lastNear) {
          lastNear = state.nearVenue
          setNear(state.nearVenue)
        }
        if (state.walkedIn && current.mode === 'city') {
          if (sessionRef.current) {
            current.mode = 'hall'
            void enterRef.current?.(state.walkedIn)
          } else if (performance.now() - guestPromptAt.current > 4000) {
            // A guest at the door: ask once to sign up, not every frame.
            guestPromptAt.current = performance.now()
            openAuthRef.current('signup')
          }
        }
        drawMinimap(minimap.current, current.city, state.position, state.heading, targetRef.current)
        current.renderer.render(current.city.scene, current.city.camera)
      } else if (current.hall) {
        current.hall.update(delta, input.current)
        current.renderer.render(current.hall.scene, current.hall.camera)
      }
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [phase])

  // Leaving the page frees the GPU.
  useEffect(
    () => () => {
      const current = engine.current
      if (!current) return
      current.city.dispose()
      current.hall?.dispose()
      current.renderer.dispose()
      current.renderer.domElement.remove()
      engine.current = null
    },
    [],
  )

  // Tilt steering on phones: lean the phone left or right to turn, like a steering wheel.
  useEffect(() => {
    if (phase !== 'driving' || !window.matchMedia('(pointer: coarse)').matches) return
    let lastTilt = 0
    const onTilt = (event: DeviceOrientationEvent) => {
      const angle = screen.orientation?.angle ?? Number((window as unknown as { orientation?: number }).orientation ?? 0)
      const raw = angle === 90 ? (event.beta ?? 0) : angle === 270 || angle === -90 ? -(event.beta ?? 0) : (event.gamma ?? 0)
      const tilt = Math.abs(raw) < 5 ? 0 : Math.max(-1, Math.min(1, (raw - Math.sign(raw) * 5) / 20))
      // Touch pads win: tilt only steers while no steering pad is held.
      if (input.current.steer === lastTilt) input.current = { ...input.current, steer: tilt }
      lastTilt = tilt
    }
    window.addEventListener('deviceorientation', onTilt)
    return () => window.removeEventListener('deviceorientation', onTilt)
  }, [phase])

  // Keyboard driving.
  useEffect(() => {
    if (phase !== 'driving' && phase !== 'hall') return
    const keys = new Set<string>()
    const apply = () => {
      const up = keys.has('arrowup') || keys.has('w') || keys.has('z')
      const down = keys.has('arrowdown') || keys.has('s')
      const left = keys.has('arrowleft') || keys.has('a') || keys.has('q')
      const right = keys.has('arrowright') || keys.has('d')
      input.current = { throttle: up ? 1 : down ? -1 : 0, steer: left ? -1 : right ? 1 : 0, brake: keys.has(' ') }
    }
    const down = (event: KeyboardEvent) => {
      keys.add(event.key.toLowerCase())
      apply()
    }
    const up = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase())
      apply()
    }
    // Switching app or tab must never leave a key "held" (the car would drive on by itself).
    const release = () => {
      keys.clear()
      apply()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', release)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', release)
      input.current = { throttle: 0, steer: 0, brake: false }
    }
  }, [phase])

  const enter = async (venue: Venue) => {
    // Guests can drive around, but entering a hall needs an account.
    if (!session) {
      openAuth('signup')
      if (engine.current) engine.current.mode = 'city'
      return
    }
    const current = engine.current
    if (!current) return
    input.current = { throttle: 0, steer: 0, brake: true }
    setCurrentVenue(venue)
    setPhase('elevator')
    const [{ Hall }] = await Promise.all([import('@/life/hall'), new Promise((resolve) => setTimeout(resolve, 2600))])
    current.hall?.dispose()
    const hall = new Hall()
    await hall.build(WORLDS[venue.worldId], t(language, 'comingSoon'))
    const { clientWidth: width, clientHeight: height } = host.current!
    hall.camera.aspect = width / height
    hall.camera.updateProjectionMatrix()
    current.hall = hall
    current.mode = 'hall'
    murmur.current?.()
    murmur.current = startCrowdMurmur()
    input.current = { throttle: 0, steer: 0, brake: false }
    setSeated(false)
    setPhase('hall')
  }

  enterRef.current = enter

  /** Enter the hall of a live event from its code: same live, same audience count, on the big screen. */
  const joinEvent = async (raw: string) => {
    setCodeError(null)
    if (!session) {
      openAuth('signup')
      return
    }
    try {
      const found = await findLiveByCode(raw)
      if (!found) {
        setCodeError(t(language, 'codeUnknown'))
        return
      }
      const venue = venues.find((item) => item.worldId === found.worldId) ?? venues[0]
      if (!venue) return
      setCodeOpen(false)
      setCode('')
      setLiveEvent(found)
      if (engine.current) engine.current.mode = 'hall'
      await enter(venue)
    } catch {
      setCodeError(t(language, 'codeUnknown'))
    }
  }
  joinEventRef.current = joinEvent

  const leaveHall = () => {
    setLiveEvent(null)
    setLiveStatus('')
    const current = engine.current
    if (!current || !currentVenue) return
    murmur.current?.()
    murmur.current = null
    current.city.parkAt(currentVenue)
    current.mode = 'city'
    setTarget(null)
    setPhase('driving')
  }

  // Dragging in the hall turns the head.
  const drag = useRef<{ x: number; y: number } | null>(null)

  const pedal = (patch: Partial<DriveInput>) => () => {
    input.current = { ...input.current, ...patch }
  }

  const updateGarage = (change: Partial<Garage>) => {
    setGarage((current) => {
      const next = { ...current, ...change }
      saveGarage(next)
      return next
    })
  }
  const pickVehicle = (id: Vehicle['id']) => {
    engine.current?.city.setVehicle(id, garage.paint || undefined)
    updateGarage({ vehicle: id })
  }
  const pickPaint = (paint: string) => {
    engine.current?.city.setVehicle(garage.vehicle, paint)
    updateGarage({ paint })
  }
  const pickOutfit = (outfit: string) => {
    engine.current?.city.setOutfit(outfit)
    updateGarage({ outfit })
  }
  const toggleWalk = () => {
    const city = engine.current?.city
    if (!city) return
    if (city.toggleWalk()) setWalking(city.isWalking)
    else {
      setNotice(t(language, 'backToCar'))
      window.setTimeout(() => setNotice(null), 1800)
    }
  }

  return (
    <div data-guest-ok translate="no" className="notranslate fixed inset-0 z-50 overflow-hidden bg-[#0b0b10] text-white select-none">
      <div
        ref={host}
        className="absolute inset-0 touch-none"
        onPointerDown={(event) => {
          if (phase === 'hall') drag.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerMove={(event) => {
          if (!drag.current || phase !== 'hall') return
          engine.current?.hall?.look(event.clientX - drag.current.x, event.clientY - drag.current.y)
          drag.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />

      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label={t(language, 'close')}
        className="pressable absolute top-[calc(var(--safe-top)+14px)] left-4 z-20 grid size-11 place-items-center rounded-2xl bg-black/45 backdrop-blur-md"
      >
        <BackIcon />
      </button>

      {/* Language, then welcome */}
      <AnimatePresence>
        {(phase === 'language' || phase === 'welcome' || phase === 'loading') && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[radial-gradient(90%_70%_at_50%_30%,#3a2a55,#0b0b10_70%)] px-6 text-center"
          >
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-1/2 items-end justify-center gap-[6vw] opacity-80">
              {Object.values(WORLDS).map((world, index) => (
                <span
                  key={world.id}
                  className="w-[3px] rounded-full blur-[1px]"
                  style={{ height: `${40 + ((index * 37) % 50)}%`, background: `linear-gradient(to top, ${world.accent}, transparent)` }}
                />
              ))}
            </div>

            {phase === 'language' && (
              <div className="relative w-full max-w-sm">
                <p className="text-sm font-bold tracking-widest text-white/60 uppercase">Life</p>
                <h1 className="mt-2 text-3xl font-extrabold">{t(language, 'chooseLanguage')}</h1>
                <div className="mt-8 grid gap-2.5">
                  {LIFE_LANGUAGES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => chooseLanguage(option.id)}
                      className="pressable h-14 rounded-2xl border border-white/12 bg-white/8 text-lg font-extrabold backdrop-blur-md hover:bg-white/14"
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {phase === 'welcome' && (
              <div className="relative w-full max-w-md">
                <h1 className="text-3xl leading-tight font-extrabold">{t(language, 'welcomeTitle')}</h1>
                <p className="mt-4 text-[15px] leading-relaxed text-white/75">{t(language, 'welcomeText')}</p>
                <button
                  type="button"
                  onClick={start}
                  className="pressable mt-8 h-14 w-full rounded-2xl bg-[linear-gradient(180deg,#FFE27A,#FF9F43)] text-lg font-extrabold text-[#1a1406] shadow-[0_16px_40px_rgba(255,170,60,.45)]"
                >
                  {t(language, 'start')}
                </button>
                <p className="mt-3 text-xs text-white/50">{window.matchMedia('(pointer: coarse)').matches ? t(language, 'hintTouch') : t(language, 'hintKeys')}</p>
                <button type="button" onClick={() => setPhase('language')} className="mt-6 text-sm font-bold text-white/60 underline">
                  {t(language, 'language')}: {LIFE_LANGUAGES.find((option) => option.id === language)?.name}
                </button>
              </div>
            )}

            {phase === 'loading' && (
              <div className="relative w-full max-w-xs">
                <p className="text-lg font-extrabold">{failed ? 'Connection problem' : t(language, 'loading')}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/12">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#FFD54F,#FF6FB1,#6FB8FF)] transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                {failed && (
                  <button type="button" onClick={start} className="pressable mt-6 h-12 rounded-2xl bg-white/12 px-6 font-extrabold">
                    Retry
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Driving HUD */}
      {phase === 'driving' && (
        <>
          <div className="absolute top-[calc(var(--safe-top)+14px)] right-4 z-20 flex flex-col items-end gap-2">
            <canvas ref={minimap} width={300} height={300} className="size-[132px] rounded-3xl border border-white/15 bg-black/45 backdrop-blur-md lg:size-[180px]" />
          </div>

          {/* Every world visible on phones too: chips wrap under the minimap instead of scrolling away. */}
          <div className="absolute top-[calc(var(--safe-top)+64px)] left-3 z-20 grid w-[176px] grid-cols-2 gap-1 lg:top-[calc(var(--safe-top)+14px)] lg:right-[204px] lg:left-[72px] lg:flex lg:w-auto lg:flex-wrap lg:gap-1.5">
            {venues.map((venue) => (
              <button
                key={venue.worldId}
                type="button"
                onClick={() => setTarget(target?.worldId === venue.worldId ? null : venue)}
                className={clsx(
                  'pressable h-7 min-w-0 truncate rounded-full px-2 text-[10px] lg:h-9 lg:px-3.5 lg:text-xs font-extrabold whitespace-nowrap backdrop-blur-md',
                  target?.worldId === venue.worldId ? 'text-[#111]' : 'bg-black/45 text-white',
                )}
                style={target?.worldId === venue.worldId ? { background: venue.color } : { boxShadow: `inset 0 0 0 1.5px ${venue.color}` }}
              >
                <span className="lg:hidden">{venue.name.replace(/ World$/, "")}</span><span className="hidden lg:inline">{venue.name}</span>
              </button>
            ))}
          </div>

          <AnimatePresence>
            {near && (
              <motion.div
                key={near.worldId}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                className="absolute inset-x-0 bottom-[calc(var(--safe-bottom)+150px)] z-30 flex flex-col items-center gap-2 px-6 lg:bottom-16"
              >
                <p className="rounded-full bg-black/55 px-4 py-1.5 text-sm font-bold backdrop-blur-md">
                  {walking ? t(language, 'enterHere') : t(language, 'arrived')} · {near.name}
                </p>
                <button
                  type="button"
                  onClick={() => void enter(near)}
                  className="pressable h-14 rounded-2xl px-8 text-lg font-extrabold text-[#111] shadow-[0_14px_40px_rgba(0,0,0,.4)]"
                  style={{ background: near.color }}
                >
                  {t(language, 'enter')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Walk / shop */}
          <div className="absolute top-[calc(var(--safe-top)+156px)] right-4 z-20 flex flex-col gap-2 lg:top-auto lg:right-auto lg:bottom-16 lg:left-6">
            <button type="button" onClick={toggleWalk} className="pressable h-10 rounded-2xl bg-black/55 px-3 text-xs font-extrabold text-white backdrop-blur-md lg:h-11 lg:px-4 lg:text-sm">
              {walking ? t(language, 'getIn') : t(language, 'getOut')}
            </button>
            <button type="button" onClick={() => setShopOpen(true)} className="pressable h-10 rounded-2xl bg-black/55 px-3 text-xs font-extrabold text-white backdrop-blur-md lg:h-11 lg:px-4 lg:text-sm">
              {t(language, 'shop')}
            </button>
            <button
              type="button"
              onClick={() => (session ? setCodeOpen(true) : openAuth('signup'))}
              className="pressable flex h-10 items-center gap-1.5 rounded-2xl bg-[#e0284a]/85 px-3 text-xs font-extrabold text-white backdrop-blur-md lg:h-11 lg:px-4 lg:text-sm"
            >
              <span className="size-2 animate-pulse rounded-full bg-white" />
              {t(language, 'liveCode')}
            </button>
          </div>
          {codeOpen && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 px-6" onClick={() => setCodeOpen(false)}>
              <form
                onClick={(event) => event.stopPropagation()}
                onSubmit={(event) => {
                  event.preventDefault()
                  void joinEvent(code)
                }}
                className="w-full max-w-sm rounded-3xl bg-[#121219] p-5"
              >
                <p className="text-lg font-extrabold">{t(language, 'liveCode')}</p>
                <p className="mt-1 text-sm text-white/60">{t(language, 'liveCodeHint')}</p>
                <input
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="A1B2C3"
                  className="mt-4 h-14 w-full rounded-2xl bg-white/10 px-4 text-center text-2xl font-extrabold tracking-[0.3em] uppercase outline-none focus:ring-2 focus:ring-white/40"
                />
                {codeError && <p className="mt-2 text-sm font-semibold text-[#ff8fa3]">{codeError}</p>}
                <button type="submit" className="pressable mt-4 h-12 w-full rounded-2xl bg-white font-extrabold text-[#111]">
                  {t(language, 'enterEvent')}
                </button>
              </form>
            </div>
          )}
          {notice && <p className="absolute top-1/2 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-bold">{notice}</p>}
          <AnimatePresence>
            {shopOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-end justify-center bg-black/55 lg:items-center" onClick={() => setShopOpen(false)}>
                <motion.div
                  initial={{ y: 40 }}
                  animate={{ y: 0 }}
                  exit={{ y: 40 }}
                  onClick={(event) => event.stopPropagation()}
                  className="w-full max-w-md rounded-t-3xl bg-[#121219] p-5 pb-[calc(var(--safe-bottom)+20px)] lg:rounded-3xl"
                >
                  <p className="text-lg font-extrabold">{t(language, 'shop')}</p>
                  <p className="mb-3 text-xs text-white/60">{t(language, 'shopFree')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {VEHICLES.map((vehicle) => (
                      <button
                        key={vehicle.id}
                        type="button"
                        onClick={() => pickVehicle(vehicle.id)}
                        className={clsx('pressable rounded-2xl p-3 text-center text-sm font-bold', garage.vehicle === vehicle.id ? 'bg-white text-[#111]' : 'bg-white/8')}
                      >
                        <span className="block text-3xl">{vehicle.id === 'moto' ? '🏍️' : vehicle.id === 'suv' ? '🚙' : '🏎️'}</span>
                        {t(language, vehicle.id)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 mb-2 text-sm font-bold">{t(language, 'paint')}</p>
                  <div className="flex flex-wrap gap-2">
                    {OUTFITS.map((color) => (
                      <button key={color} type="button" aria-label={color} onClick={() => pickPaint(color)} className={clsx('pressable size-9 rounded-full', garage.paint === color && 'ring-2 ring-white ring-offset-2 ring-offset-[#121219]')} style={{ background: color }} />
                    ))}
                  </div>
                  <p className="mt-4 mb-2 text-sm font-bold">{t(language, 'outfit')}</p>
                  <div className="flex flex-wrap gap-2">
                    {OUTFITS.map((color) => (
                      <button key={color} type="button" aria-label={color} onClick={() => pickOutfit(color)} className={clsx('pressable size-9 rounded-full', garage.outfit === color && 'ring-2 ring-white ring-offset-2 ring-offset-[#121219]')} style={{ background: color }} />
                    ))}
                  </div>
                  <button type="button" onClick={() => setShopOpen(false)} className="pressable mt-5 h-12 w-full rounded-2xl bg-white font-extrabold text-[#111]">
                    OK
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Touch controls */}
          <div className="absolute inset-x-0 bottom-[calc(var(--safe-bottom)+18px)] z-20 flex items-end justify-between px-5 lg:hidden">
            <div className="flex gap-3">
              <Pad label="◀" onDown={pedal({ steer: -1 })} onUp={pedal({ steer: 0 })} />
              <Pad label="▶" onDown={pedal({ steer: 1 })} onUp={pedal({ steer: 0 })} />
            </div>
            <div className="flex items-end gap-3">
              <Pad label="▼" small onDown={pedal({ throttle: -1 })} onUp={pedal({ throttle: 0 })} />
              <Pad label="▲" tall onDown={pedal({ throttle: 1 })} onUp={pedal({ throttle: 0 })} />
            </div>
          </div>
          <p className="absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 rounded-full bg-black/45 px-4 py-1.5 text-xs font-bold text-white/80 backdrop-blur-md lg:block">
            {t(language, 'hintKeys')}
          </p>
        </>
      )}

      {/* Elevator */}
      <AnimatePresence>
        {phase === 'elevator' && currentVenue && <Elevator key="elevator" venue={currentVenue} label={t(language, 'elevator')} />}
      </AnimatePresence>

      {/* In the hall */}
      {phase === 'hall' && liveEvent && <HallLive clashId={liveEvent.id} hall={engine.current?.hall ?? null} onStatus={setLiveStatus} />}
      {phase === 'hall' && liveEvent && (
        <div className="absolute top-[calc(var(--safe-top)+14px)] left-1/2 z-20 flex max-w-[70vw] -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-extrabold backdrop-blur-md">
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-[#ff5b6e]" />
          <span className="truncate">{liveEvent.title}</span>
          {liveStatus && <span className="shrink-0 text-white/70">· {liveStatus}</span>}
        </div>
      )}
      {phase === 'hall' && currentVenue && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--safe-bottom)+20px)] z-20 flex flex-col items-center gap-3 px-6 text-center">
          <p className="max-w-md rounded-2xl bg-black/50 px-4 py-2.5 text-sm font-semibold backdrop-blur-md">
            <span className="font-extrabold" style={{ color: currentVenue.color }}>
              {currentVenue.name}
            </span>{' '}
            · {seated ? t(language, 'seated') : t(language, 'walkInHall')}
          </p>
          <p className="text-xs text-white/60">{t(language, 'lookAround')}</p>
          {!seated && (
            <div className="pointer-events-auto flex w-full items-end justify-between lg:hidden">
              <div className="flex gap-3">
                <Pad label="◀" onDown={pedal({ steer: -1 })} onUp={pedal({ steer: 0 })} />
                <Pad label="▶" onDown={pedal({ steer: 1 })} onUp={pedal({ steer: 0 })} />
              </div>
              <div className="flex items-end gap-3">
                <Pad label="▼" small onDown={pedal({ throttle: -1 })} onUp={pedal({ throttle: 0 })} />
                <Pad label="▲" tall onDown={pedal({ throttle: 1 })} onUp={pedal({ throttle: 0 })} />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const hall = engine.current?.hall
                if (!hall) return
                input.current = { throttle: 0, steer: 0, brake: false }
                hall.setSeated(!hall.isSeated)
                setSeated(hall.isSeated)
              }}
              className="pressable pointer-events-auto h-12 rounded-2xl px-6 font-extrabold text-[#111]"
              style={{ background: currentVenue.color }}
            >
              {seated ? t(language, 'stand') : t(language, 'sit')}
            </button>
            <button type="button" onClick={leaveHall} className="pressable pointer-events-auto h-12 rounded-2xl bg-white/14 px-6 font-extrabold backdrop-blur-md">
              {t(language, 'leave')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** A touch pedal: held down to act, released to stop. */
function Pad({ label, onDown, onUp, tall = false, small = false }: { label: string; onDown: () => void; onUp: () => void; tall?: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        onDown()
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onContextMenu={(event) => event.preventDefault()}
      className={clsx(
        'grid touch-none place-items-center rounded-3xl border border-white/15 bg-black/40 text-2xl font-extrabold backdrop-blur-md active:scale-95 active:bg-white/20',
        tall ? 'h-28 w-20' : small ? 'h-16 w-16' : 'h-20 w-20',
      )}
    >
      {label}
    </button>
  )
}

/** Doors close, the floors count up, the doors open on the hall. */
function Elevator({ venue, label }: { venue: Venue; label: string }) {
  const [floor, setFloor] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setFloor((value) => Math.min(value + 1, 8)), 260)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-black">
      <motion.div
        className="absolute inset-y-0 left-0 w-1/2 border-r border-black/60 bg-[linear-gradient(90deg,#2a2d35,#4b4f5a_80%,#6a6f7c)]"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-y-0 right-0 w-1/2 border-l border-black/60 bg-[linear-gradient(270deg,#2a2d35,#4b4f5a_80%,#6a6f7c)]"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
      <div className="absolute inset-x-0 top-[22%] flex flex-col items-center gap-3">
        <span className="rounded-xl bg-black/70 px-5 py-2 font-mono text-4xl font-extrabold tabular-nums" style={{ color: venue.color, textShadow: `0 0 18px ${venue.color}` }}>
          {floor}
        </span>
        <span className="text-sm font-bold text-white/80">
          {label} · {venue.name}
        </span>
      </div>
    </motion.div>
  )
}

/** The city from above: roads, the eight arenas, the car and the way to the chosen one. */
function drawMinimap(canvas: HTMLCanvasElement | null, city: City, position: THREE.Vector3, heading: number, target: Venue | null) {
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  const size = canvas.width
  const extent = city.mapExtent
  const scale = size / (extent * 2)
  const toMap = (x: number, z: number) => [(x + extent) * scale, (z + extent) * scale] as const

  context.clearRect(0, 0, size, size)
  context.fillStyle = 'rgba(40,42,48,0.9)'
  context.fillRect(0, 0, size, size)
  context.strokeStyle = 'rgba(255,255,255,0.18)'
  context.lineWidth = 3
  for (let line = -extent; line <= extent; line += 64) {
    const [a] = toMap(line, 0)
    context.beginPath()
    context.moveTo(a, 0)
    context.lineTo(a, size)
    context.stroke()
    context.beginPath()
    context.moveTo(0, a)
    context.lineTo(size, a)
    context.stroke()
  }

  const [carX, carY] = toMap(position.x, position.z)
  for (const venue of city.venues) {
    const [x, y] = toMap(venue.center.x, venue.center.z)
    context.fillStyle = venue.color
    context.globalAlpha = target && target.worldId !== venue.worldId ? 0.45 : 1
    context.beginPath()
    context.arc(x, y, target?.worldId === venue.worldId ? 13 : 9, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1

  if (target) {
    const [x, y] = toMap(target.door.x, target.door.z)
    context.strokeStyle = target.color
    context.lineWidth = 5
    context.setLineDash([12, 9])
    context.beginPath()
    context.moveTo(carX, carY)
    context.lineTo(x, y)
    context.stroke()
    context.setLineDash([])
  }

  // The car as an arrow pointing where it drives.
  context.save()
  context.translate(carX, carY)
  context.rotate(-heading + Math.PI)
  context.fillStyle = '#ffffff'
  context.shadowColor = '#000'
  context.shadowBlur = 6
  context.beginPath()
  context.moveTo(0, -14)
  context.lineTo(10, 11)
  context.lineTo(0, 5)
  context.lineTo(-10, 11)
  context.closePath()
  context.fill()
  context.restore()
}
