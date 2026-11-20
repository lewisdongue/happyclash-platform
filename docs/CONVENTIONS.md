# Conventions

## Product rules

- No fake or simulated data, ever. Empty states instead.
- Mobile first: build and check every screen at phone width first, then desktop.
- No overflow and nothing covering something else. Sheets and dialogs use `components/ui/Sheet.tsx` (rendered on `<body>`).
- Every user-facing text works in the supported languages (EN, FR, DE, ES, HI).
- Guests who try an action see the sign-up sheet (`useRequireSession`), never an error.

## Code

- TypeScript strict; `npm run build` must pass before every push.
- Database access only in `src/api/`. Components never call Supabase directly, except small self-contained pages.
- Security in the database (row level security, checked RPC functions), never only in the UI.
- Schema changes only through a new migration file.
- Secrets never in the repository or in the browser.
- Comments explain *why*, not *what*.
- Tailwind for styling; Talent World colours through the `world-*` tokens.

## Git

- `main` is production: every push deploys.
- Small, focused commits with a clear message.
