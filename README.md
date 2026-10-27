# Artist Drop & Concert Tracker

Milestone 1 scaffold: prove one full loop (account → follow one artist → one
real source → worker checks it on a schedule, independent of any laptop →
detect a change → store an alert → email it → show it in the web feed →
acknowledge). No entity merging, geo filtering, or multi-source dedup yet —
that comes after this loop is proven.

## Layout

- `web/` — Next.js app (feed, login). Deploy later; runs fine locally for now.
- `worker/` — Python checker, run on a schedule by GitHub Actions.
- `supabase/migrations/0001_init.sql` — full schema from the project brief.
- `.github/workflows/worker.yml` — cron (every 5 min) that runs the worker.

## Remaining manual setup (things only you can do)

### 1. Create the Supabase project
1. Go to supabase.com → New project. Pick any region, save the generated DB password somewhere safe.
2. Once created: **Project Settings → API** — copy the `Project URL`, the `anon public` key, and the `service_role` key (keep the service key secret, never put it in the web app or commit it).
3. **SQL Editor → New query** — paste the contents of `supabase/migrations/0001_init.sql` and run it.

### 2. Turn on Google sign-in
1. In Supabase: **Authentication → Providers → Google** — note the "Callback URL" it shows you (looks like `https://<project-ref>.supabase.co/auth/v1/callback`).
2. In Google Cloud Console → create a project (or reuse one) → **APIs & Services → Credentials → Create OAuth client ID** → type "Web application".
3. Add the Supabase callback URL from step 1 as an **Authorized redirect URI**. Add `http://localhost:3000` as an **Authorized JavaScript origin** for local testing.
4. Copy the generated Client ID and Client Secret back into the Supabase Google provider screen, and toggle it on.

### 3. Get an email key (Resend)
1. resend.com → sign up (free tier) → API Keys → create one.
2. For real delivery you'd verify a domain, but for milestone 1 testing you can send from `onboarding@resend.dev` as `ALERT_FROM_EMAIL`.

### 4. Get a Ticketmaster key
developer.ticketmaster.com → sign up → My Apps. The Consumer Key is the
`TICKETMASTER_API_KEY` (free tier: 5,000 calls/day, 5/sec).

### 5. Add GitHub Actions secrets
Fill in `worker/.env` (gitignored), then upload it in one go:
`gh secret set -f worker/.env`. Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `ALERT_TO_EMAIL` (your own email, since
there's no per-user routing yet), `TICKETMASTER_API_KEY`.

Newer Supabase projects also need `supabase/migrations/0002_api_grants.sql`
run after `0001_init.sql`, or the API can't see the tables (PGRST205).

### 6. Seed the one artist to prove the loop
After you've signed in once through the web app (so a row exists in `auth.users`), run in the Supabase SQL editor:

```sql
insert into locations (user_id, name, latitude, longitude, radius_km)
values
  ('<your-user-id>', 'Dublin', 53.3498, -6.2603, 50),
  ('<your-user-id>', 'Boston', 42.3601, -71.0589, 50);

with a as (
  insert into artists (name) values ('<artist name>') returning id
)
insert into user_artist_follows (user_id, artist_id)
select '<your-user-id>', a.id from a;
```

Leave `sources` empty — the worker's discovery step looks the artist up on
Ticketmaster (exact name match) on its first run and inserts a `ticketmaster`
source. If it can't find one, insert a `generic_html` source yourself with a
URL you know changes (any artist tour/news page works).

### 7. Local dev
```
cd web
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
npm run dev                        # http://localhost:3001 (3000 is taken by Vibes)
```

### 8. Run the worker once manually (don't wait for the schedule)
`gh workflow run artist-tracker-worker`. Ticketmaster sources log
`<artist>: N upcoming near your locations, M new`; every new show becomes an
alert in the feed, and all of a run's new shows go out as one email.

## Known gaps (by design, for now)
- One flat alert priority/no per-artist overrides yet.
- Geo filtering is Ticketmaster-only (radius around each active location).
- No alerts for changes to already-seen events (reschedules, cancellations).
- No merch pipeline yet, concert-only.
- No multi-source merge/dedup for the same event yet.
