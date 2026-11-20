# HappyClash

The talent arena: people post short talent videos, answer each other with **Clash Back**, compete in **Clashes** (solo, duel, group, live) and explore **Life**, a 3D city where every Talent World has its own arena.

Production: <https://happyclash.com>

> **About this repository.** HappyClash was designed and built end to end by
> [Bryan Lewis Dongue Ndiffo](https://www.lewisdongue.com/portfolio) for a client, who allowed this public copy of the source.
> The launch videos and the production admin e-mail addresses are left out; secrets never lived in the code.

This repository contains the web app (installable PWA, ready to be wrapped for the App Store and Google Play), the database schema and the server functions.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the app is built: folders, data flow, realtime, video, Life 3D, live |
| [docs/DATABASE.md](docs/DATABASE.md) | Tables, security rules, triggers, counters, ranking, migrations |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Environments, secrets, deployment, sign-in providers, renewals, troubleshooting |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Code style and rules every change must respect |

## Stack

| Concern | Choice |
| --- | --- |
| UI | React 19, TypeScript (strict), Tailwind CSS 4, `motion` |
| Routing | React Router, every page except Home lazy-loaded |
| Data | Supabase: Postgres with row level security, Auth, Storage, Realtime, Edge Functions |
| Server state | TanStack Query |
| 3D | three.js (Life), `@google/model-viewer` (3D icons and trophies) |
| Live video | WebRTC through Cloudflare Realtime (SFU), brokered by the `live` Edge Function |
| Video cutting | `mediabunny` (in-browser trim of long videos, no re-encode) |
| PWA | `vite-plugin-pwa` (Workbox) |
| Hosting | Vercel, production deploys automatically from `main` |

## Getting started

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm install
npm run dev                  # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run typecheck` | TypeScript check only |
| `npm run build` | Type check + production build into `dist/` |
| `npm run preview` | Serve the production build locally |

`npm install` uses `legacy-peer-deps` (see `.npmrc`): `@google/model-viewer` declares a narrower `three` peer range than the version used by Life.

## Project layout

```
src/
  main.tsx          entry: language, service worker, providers
  app/              router, session, auth UI, sound, realtime channels, appearance
  api/              all database access (queries, mutations, mappers, React Query hooks)
  pages/            one file per route (see src/app/router.tsx)
  components/       UI grouped by feature (feed, clash, duel, live, profile, admin, ui…)
  life/             Life 3D world: city, halls, models, garage, translations
  content/          static content (legal documents)
  lib/              small pure helpers (formatting, language, video trim, Supabase client)
  hooks/            reusable React hooks
  theme/            Talent World colours applied through CSS variables
  types/            shared domain types
public/             icons, launch media, optimised 3D models (public/life)
supabase/
  migrations/       database schema, in order (source of truth)
  functions/        Edge Functions (live media broker, asset import)
vercel.json         redirects, cache headers
```

## Key rules

- **No fake data.** Everything on screen comes from the database. Empty tables show empty states.
- **Security lives in the database.** Every table has row level security; the browser only holds the publishable key. Private keys exist only in server function secrets.
- **Mobile first.** Every screen is designed and checked on a phone first, then on desktop. No overflow, no element covering another.
- **Videos last 60 seconds at most**, enforced in the app and in the database. Longer videos are trimmed by the user before upload.

See [docs/CONVENTIONS.md](docs/CONVENTIONS.md) for the full list.
