# Database

Supabase Postgres. The migrations in `supabase/migrations/` are the source of truth: applied in order, they rebuild the schema exactly. Never edit a migration that has been applied; add a new one.

## Tables

| Area | Tables |
| --- | --- |
| People | `profiles`, `follows`, `blocks` |
| Videos | `entries`, `entry_views`, `sparks`, `boosts`, `comments`, `comment_likes` |
| Clashes | `clashes`, `clash_invites`, `duel_votes` |
| Groups | `groups`, `group_members` |
| Live | `live_rooms`, `live_participants` |
| Activity | `notifications` |
| Safety | `reports`, `safety_reports` |
| Admin | `admins`, `admin_approvals`, `audit_events` |
| 3D assets | `asset_import_tickets` |

Views: `entry_feed`, `clash_feed`, `group_feed`.

## Security

- Row level security is enabled on every table. A user can only change their own rows; private Clashes and groups are visible only to members and invitees (`can_view_clash`, `is_group_member`).
- Blocking is enforced in queries (`is_blocked_with`, `blocked_between`).
- Rate limits on writes: `enforce_rate_limit`. Suspended accounts are refused: `refuse_suspended`.
- `SECURITY DEFINER` functions (admin, live, account deletion) check the caller themselves (`require_admin`, `require_live_staff`).
- The `service_role` key is used only by Edge Functions, never in the browser.

## Counters and realtime

Views, Sparks, comments, boosts and Clash Backs are counted on the `entries` row by triggers (`bump_entry_counter`, `bump_comment_counters`). Triggers broadcast changes on Realtime topics (`broadcast_entry_counts`, `broadcast_new_entry`), and the app refetches on each event.

## Main functions

| Function | Purpose |
| --- | --- |
| `ranked_feed()` | The Home feed order |
| `record_view()` | Counts a view once per user and video |
| `apply_boost()` | Boosts (3 per day, never on your own video) |
| `talent_ranking()`, `country_ranking()`, `group_ranking()` | Rankings by period |
| `profile_stats()` | Profile statistics |
| `live_join()`, `live_request_stage()`, `live_set_permissions()`, `live_set_moderator()`, `live_leave()` | Live room rules |
| `verify_with_link()` | Blue badge through a social profile link |
| `submit_report()` | Reports with a case ID |
| `delete_my_account()` | Account deletion (files are removed by the app first) |
| `handle_new_user()` | Creates the profile at sign-up (email, Google, Apple) |

## Constraints worth knowing

- Videos: 60 seconds at most (`entries_one_minute`). Clash `max_seconds` between 10 and 60.
- One duel vote per user.
- Storage bucket `media`: 50 MB per file.
