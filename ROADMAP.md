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

## Next up (suggested order)
1. **Styling** — feed, artists and locations pages are bare black/white, and
   the black buttons disappear in dark mode.
2. **Reschedule/cancellation alerts** — compare stored events against
   Ticketmaster's current `dates.status` / `localDate` on each run and alert on
   changes (currently already-seen events are ignored).
3. **Local-time sale times** — emails show presale/on-sale in UTC.
4. **Confirm discovered identities** — following from search marks the match
   confirmed, but the 5 seeded artists still say "auto-detected". A wrong
   match can be fixed today by unfollowing and following the right act from
   search; a one-click "confirm" would be nicer.
5. **Alerts for shows found before you followed** — the worker only alerts on
   events it hasn't stored yet, so a new follower of an artist someone else
   already follows won't hear about shows already found.

## Later
- Per-user email routing (everything goes to `ALERT_TO_EMAIL` today).
- Verified Resend domain for real delivery.
- Deploy the web app (Vercel) — then add the deployed URL to Supabase redirect
  URLs and Google OAuth origins, and publish the Google app.
- Merch pipeline, multi-source dedup, per-artist location overrides
  (tables already exist in the schema).
