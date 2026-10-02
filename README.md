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

### 4. Add GitHub Actions secrets
Repo → Settings → Secrets and variables → Actions → New repository secret, for each of:
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `ALERT_TO_EMAIL` (your own email, since there's no per-user routing yet).

### 5. Seed the one artist to prove the loop
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

Leave `sources` empty — the worker's discovery step will try to find a
Bandsintown page for the artist on its first run and insert one automatically.
If it can't find one, insert a row into `sources` yourself with a URL you
know changes (any artist tour/news page works for proving the loop).

### 6. Local dev
```
cd web
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
npm run dev
```

### 7. Run the worker once manually (don't wait 5 minutes)
Repo → Actions → "artist-tracker-worker" → Run workflow. Check the logs for
`baseline recorded for <artist>` on the first run — that's expected, no
alert yet. Run it again after the source page changes (or after editing the
page content yourself, if testing) to see `change detected` and an email.

## Known gaps (by design, for now)
- One flat alert priority/no per-artist overrides yet.
- No geo/relevance filtering yet (locations are stored but unused).
- No merch pipeline yet, concert-only.
- No multi-source merge/dedup for the same event yet.
