# Roadmap & status

## Where things stand (2026-11-02)

Milestone 1 loop is **working end to end**: sign in → follow artists → worker
(GitHub Actions) finds shows on Ticketmaster near your locations → stores
events + alerts → one digest email per run → alerts in the web feed.

First real run (Actions run 40439300333) discovered all 5 seeded artists and
emailed 7 shows (Oasis ×5 near Dublin/Boston, Geese ×2 in Boston).

### Live setup
- **Supabase project:** "Concert Tracker", ref `xkmuiwmekhtpssiknhxu`.
  Migrations `0001_init.sql` and `0002_api_grants.sql` are applied.
  ⚠️ The Supabase account also has the **Spotify Vibes** project — check the
  ref in the dashboard URL before running any SQL (0001 was once run in Vibes
  by mistake and cleaned up).
- **Auth:** Google OAuth (Google Cloud client `artist-tracker-001`, app in
  testing mode — only listed test users can sign in). Supabase Site URL and
  redirect URL point at `http://localhost:3001`.
- **Email:** Resend, sending from `onboarding@resend.dev` (test sender — only
  delivers to the Resend account's own address).
- **Events:** Ticketmaster Discovery API (free tier, ~10 calls per run).
- **Web app:** `/feed`, `/artists` (search Ticketmaster, follow, pause,
  unfollow), `/locations` (Open-Meteo city search, radius, pause, remove).
  The shared catalogue tables (artists, sources, artist_identities, events)
  have RLS on with no policies, so the web app reads/writes them server-side
  with `SUPABASE_SERVICE_KEY` after checking the signed-in user.
  `web/.env.local` needs that plus `TICKETMASTER_API_KEY` (both server-only).
- **Look:** vaporwave, forest-green edition — one fixed dark theme. Colours
  and the shared classes (`.panel`, `.btn`, `.btn-primary`, `.btn-danger`,
  `.input`, `.chip`, `.pixel`, `.vapor-heading`, `.vapor-sun`,
  `.vapor-grid`) live in `web/src/app/globals.css`. Feed alerts render as
  ticket-stub cards from the linked `events` row.
  Background is a pine-forest skyline (`components/Skyline.tsx`) over the
  grid; an LED ticker under the nav and the feed side panels (up next,
  stats, ticket sales) share `utils/shows.ts`.
- **Secrets:** live in `worker/.env` (gitignored) and GitHub Actions secrets.
  Re-upload after editing: `gh secret set -f C:/Users/johnm/artist-tracker/worker/.env`
  (forward slashes — backslashes get eaten by the `!` shell).
- **Seeded data:** one user (jtmoran24@gmail.com); locations Dublin + Boston
  (50 km); follows: ear, Oasis, Phantogram, Geese, Cameron Winter.
  Follows and locations are now managed in the web app.

### Gotchas we hit
- **Port 3000 is Vibes** (pm2). The web app dev server is pinned to 3001.
- **Newer Supabase projects don't grant API roles on SQL-created tables** →
  PGRST205 "not in schema cache". Fixed by 0002; its default privileges cover
  future tables too.
- **supabase-py < ~2.10 rejects `sb_secret_` keys** — pinned 2.33.0.
- **Bandsintown** URL guessing never worked (needs numeric IDs, blocks bots);
  replaced by Ticketmaster.
- **`.env` files must be LF**, or bash-sourced values carry a trailing `\r`.
- **GitHub disables scheduled workflows after 60 days with no commits.** If it
  stops, re-enable it in Actions — otherwise Supabase free tier pauses the
  project after ~7 days of no activity.
- No local Python on this machine; the worker is tested via
  `gh workflow run artist-tracker-worker`. Node is available.

## ▶ Next session — start here (agreed 2026-11-02)
Do these in order:

1. **Deploy the web app to Vercel** so it works away from this PC (phone,
   links from emails). Steps:
   - Vercel project from this repo, root directory `web/`.
   - Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_KEY`, `TICKETMASTER_API_KEY` (values in
     `web/.env.local`; the last two must stay server-only).
   - Add the deployed URL to Supabase Auth → Site URL / redirect URLs, and to
     the Google OAuth client's authorised origins + redirect URIs.
   - The user has to sign in to Vercel/Google/Supabase dashboards themselves.
   - Later: publish the Google app out of testing mode for other users.
2. **One-click Spotify import of follows** — pull the user's followed and
   top artists from Spotify, match each to a Ticketmaster attraction, and
   follow it with `origin = 'spotify_import'` (column already exists on
   `user_artist_follows`). Show the matches for review before following.
   Spotify app credentials: the user also runs Spotify Vibes (separate
   project on port 3000, same Supabase account) — check whether its Spotify
   developer app can be reused or a new one is needed.

## Also requested (2026-11-02)
- **Collapse repeat dates of the same run.** Multi-night stands show as
  separate cards/rows today — e.g. Geese at Roadrunner, Boston on Tue 10 and
  Wed 11 Nov, and Oasis ×3 at Gillette / ×2 at Slane. Group by artist + venue
  (or artist + city) into one entry like "Geese · Roadrunner, Boston ·
  10–11 Nov (2 nights)", with each night's ticket link still reachable.
  Applies to the feed cards, the ticker, `tickets.exe`, the "next near you"
  line on /artists, and ideally the digest email too. Keep the events table
  one row per night; group at display time (`web/src/utils/shows.ts` is the
  shared place for the web side).
- **Full Spotify link with recommendations.** Beyond importing follows (#2
  above): connect Spotify with listening-history scopes (`user-top-read`,
  `user-read-recently-played`, `user-follow-read`) and use top/recent
  artists to *suggest* bands the user would want to see — e.g. heavily played
  but not yet followed, and related artists with shows near the user's
  locations. Show them as suggestions with a one-click follow, not
  auto-follows. Needs Spotify OAuth tokens stored per user (refresh token,
  server-side only) and probably a worker step to refresh suggestions.

## Backlog
1. **Reschedule/cancellation alerts** — compare stored events against
   Ticketmaster's current `dates.status` / `localDate` on each run and alert on
   changes (currently already-seen events are ignored).
2. **Local-time sale times** — emails show presale/on-sale in UTC.
3. **Confirm discovered identities** — following from search marks the match
   confirmed, but the 5 seeded artists still say "auto-detected". A wrong
   match can be fixed today by unfollowing and following the right act from
   search; a one-click "confirm" would be nicer.
4. **Alerts for shows found before you followed** — the worker only alerts on
   events it hasn't stored yet, so a new follower of an artist someone else
   already follows won't hear about shows already found.
5. **Vaporwave HTML digest email** to match the site.

## Later
- Per-user email routing (everything goes to `ALERT_TO_EMAIL` today).
- Verified Resend domain for real delivery.
- Merch pipeline, multi-source dedup, per-artist location overrides
  (tables already exist in the schema).
