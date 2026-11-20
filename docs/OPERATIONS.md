# Operations

## Environments

| What | Where |
| --- | --- |
| Production site | https://happyclash.com (Vercel project `happyclash2`, deploys from `main`) |
| Database, auth, storage, functions | Supabase project `bqovxstyagxytqxswcgb` |
| Live video | Cloudflare account, Realtime → Serverless SFU app `happyclash-live-prod` |
| Domain DNS | Strato (A record → Vercel) |

## Configuration

Front end (`.env.local`, and Vercel environment variables):

| Variable | Meaning |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (safe in the browser) |

Edge Function secrets (Supabase dashboard → Edge Functions → Secrets). Values are never committed:

| Secret | Used by |
| --- | --- |
| `CF_REALTIME_APP_ID` | `live` |
| `CF_REALTIME_TOKEN` | `live` |

## Deploying

- **App**: push to `main`; Vercel builds and publishes in about a minute.
- **Database**: add a migration in `supabase/migrations/` and apply it (Supabase CLI `supabase db push` or the dashboard SQL editor).
- **Edge Functions**: `supabase functions deploy live`.

## Sign-in providers

| Provider | Configuration |
| --- | --- |
| Email | Supabase Auth |
| Google | Google Cloud project `happyclash`, OAuth web client; redirect URI `https://bqovxstyagxytqxswcgb.supabase.co/auth/v1/callback`; client ID and secret in Supabase → Auth → Providers → Google |
| Apple | Apple Developer team `MVSYVH5RFX`: Services ID `com.happyclash.web` (domains happyclash.com and the Supabase domain, same return URL), key ID `D478AC44JJ`; the client secret is a JWT signed with that key, set in Supabase → Auth → Providers → Apple |

Supabase Auth URL configuration: site URL `https://happyclash.com`, redirect `https://happyclash.com/**`.

## Recurring tasks

| When | Task |
| --- | --- |
| Before **May 2027** (every 6 months) | Generate a new Apple client secret from the `.p8` key and paste it in Supabase |
| Monthly | Check Supabase advisors (security, performance) and storage usage |
| Monthly | Check Cloudflare Realtime usage |

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Live shows "connection problem" | `live` function logs; secrets present; `service_role` grants on live tables |
| Google/Apple sign-in error | Provider enabled in Supabase; redirect URIs; Apple secret not expired |
| Old version after deploy | The service worker updates on next visit; a hard reload forces it |
| Upload refused | Video longer than 60 s must be trimmed; files over 50 MB are refused |
