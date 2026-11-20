# Architecture

## Overview

```
Browser (React PWA)
  │  publishable key only
  ├── Supabase Postgres ── row level security on every table
  │     ├── views & RPC functions (feed, rankings, admin, live)
  │     ├── triggers (counters, notifications, realtime broadcasts)
  │     └── Realtime broadcast topics: entry:<id>, clash:<id>, feed
  ├── Supabase Storage ── buckets `media` (user videos) and `assets` (3D models)
  ├── Supabase Edge Function `live` ── holds the Cloudflare token
  │     └── Cloudflare Realtime SFU (WebRTC media for Live Clashes)
  └── Vercel (static hosting of the built app, redirects, cache headers)
```

## Front end

- `src/main.tsx` starts the language layer, registers the service worker and mounts providers.
- `src/app/router.tsx` declares every route. Pages are lazy-loaded; `lib/chunkReload.ts` and `RouteError` reload the app if a deploy replaced a chunk.
- `src/app/session.tsx` exposes the Supabase session; `useRequireSession()` opens the sign-up sheet for guests instead of failing.
- `src/api/` is the only place that talks to the database. Components use the React Query hooks from `queries.ts` and the mutation helpers of each domain file.
- `src/app/realtime.ts` keeps one shared channel per topic. A `counts` event triggers a refetch: the database stays the single source of truth.

## Feed and video

- Ranking is done in SQL by `ranked_feed()`: unseen videos first, then engagement with time decay, a bonus for fresh videos and for videos with few views. Already-seen videos go last, even on a later visit (`entry_views`).
- `components/feed/VideoPlayer.tsx` plays only the visible, active video; any other video is paused. Sound follows `app/sound.tsx`: browsers require one gesture, the first tap anywhere unlocks sound for the session, and the user's own choice is remembered.
- Uploads: `pages/CreatePage.tsx`. Videos longer than 60 s open `components/create/TrimSheet.tsx`, which cuts the chosen minute in the browser with `lib/trimVideo.ts` (container copy, no re-encode). In-app recording is capped at 60 s.

## Clashes, duels, groups

- Clash creation wizard: `pages/ClashBuilderPage.tsx` (format video or live, access public/private/group, schedule, duration, rules, winner).
- Clash Back chains: `pages/ChainPage.tsx`; blind duels: `pages/DuelPage.tsx` (one vote per user, database constraint).
- Groups with roles and invitations: `pages/GroupsPage.tsx`, `pages/GroupPage.tsx`.

## Live Clashes

- List and "Go live": `pages/LivesPage.tsx` (`/live`). Room: `pages/LivePage.tsx` (`/live/:id`).
- Who may do what is stored in `live_participants` (role, stage, cam/mic permissions) and changed only through RPC functions (`live_join`, `live_request_stage`, `live_set_permissions`…).
- Media: the browser asks the `live` Edge Function for a session; the function checks permissions in the database and talks to Cloudflare. The browser never sees the Cloudflare token. The host can cut a talent's camera or microphone (`enforce`).

## Life (3D)

- `pages/LifePage.tsx` drives the UI phases (welcome, loading, driving, elevator, hall) and touch, keyboard and tilt controls.
- `life/city.ts`: the city grid, arenas and their glowing doors, the car and the walking avatar, pedestrians (instanced), minimap data.
- `life/hall.ts`: the theatre inside each arena (stage, raked seats, seated audience, lights), walking and sitting.
- `life/models.ts`: model loading and geometry helpers; `life/garage.ts`: free shop (vehicles, paint, outfit) saved on the device; `life/i18n.ts`: Life texts in 5 languages.
- 3D models in `public/life/` are optimised (WebP textures, simplified meshes). Phones get a lighter scene.

## Languages

`lib/language.ts` picks the language (saved choice, else the browser language) for the whole site; Life has its own translated texts and is excluded from automatic translation.

## Admin

`/admin` is visible only to accounts listed in `admins`. Critical actions require a second admin (`admin_approvals`) and every action is logged (`audit_events`).
