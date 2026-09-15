# Staging environment

Updated: 2026-09-15. Covers section 4.2 of the
[technical improvement plan](./TECHNICAL_IMPROVEMENT_PLAN.md) and section 2 of
[remaining agent work](./REMAINING_AGENT_WORK.md).

## Status

| Part | State |
|---|---|
| Build guard, staging migration target, seed scripts, STAGING badge | Implemented and locally verified |
| Supabase staging project, GitHub `Staging` environment, Vercel Preview variables | Not created; needs account access |
| Stable staging URL and iPhone acceptance | Not started |

Nothing below has been run against a hosted project.

## Safety rules built into the repository

- `npm run build` first runs `scripts/check-deploy-env.mjs`. When Vercel reports
  `VERCEL_ENV=preview`, the build fails unless `VITE_APP_ENV=staging`,
  `PRODUCTION_SUPABASE_PROJECT_REF` is set, and both `VITE_SUPABASE_URL` and
  `SUPABASE_URL` (or its fallback) are hosted projects other than production.
  Production builds fail if marked non-production, and, once
  `PRODUCTION_SUPABASE_PROJECT_REF` is set, if they use a different project.
  Local and CI builds are not checked. Custom Supabase domains are not
  recognised and fail the check.
- Staging builds show a `STAGING` badge on every screen, including sign-in.
- The **Deploy database migrations** workflow has a `target` input. Staging can
  be migrated from any branch; production still only from `main`. A staging run
  stops if the `Staging` environment's project ID equals the repository variable
  `PRODUCTION_SUPABASE_PROJECT_REF`.
- `scripts/seed-foods.mjs` empties the `foods` table, so it now requires
  `SEED_SUPABASE_PROJECT_REF` to equal the target URL's project ref.
- `npm run staging:seed` reads only `STAGING_*` variables, refuses the production
  ref, and requires `--confirm <ref>`.

Once this code reaches a branch Vercel builds, every Preview deployment without
the staging variables fails. That is intended: previews must not use production.

## 1. Create the Supabase staging project

1. Create a separate project and record its 20-character project ref.
2. Authentication → URL configuration: set Site URL to the stable staging URL
   (step 6) and add it under Redirect URLs.
3. Seeded accounts are pre-confirmed. Consider disabling public sign-ups except
   when testing the sign-up flow; the built-in email service is rate-limited.
4. Never copy production users or records into this project.

## 2. Apply migrations

1. GitHub → Settings → Environments → create `Staging` with secrets
   `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` (staging database password) and
   `SUPABASE_PROJECT_ID` (staging ref).
2. Settings → Variables → add repository variable `PRODUCTION_SUPABASE_PROJECT_REF`.
3. Actions → Deploy database migrations → run from the branch under test with
   `target: staging`, `mode: preview`. Review pending versions, then run again with
   `mode: deploy`.

## 3. Seed the food catalog

Set variables in the shell for this command only; do not use `--env-file=.env.local`.

```bash
VITE_SUPABASE_URL=https://<staging-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<staging service key> SEED_SUPABASE_PROJECT_REF=<staging-ref> GOOGLE_GENERATIVE_AI_API_KEY=<key> node scripts/seed-foods.mjs
```

This calls the embedding API once for the catalog. `scripts/foods.json` has no
provenance metadata, so rows keep `source = legacy-unverified`.

## 4. Seed acceptance accounts

```bash
STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co STAGING_SUPABASE_PROJECT_REF=<staging-ref> STAGING_SUPABASE_SERVICE_ROLE_KEY=<staging service key> PRODUCTION_SUPABASE_PROJECT_REF=<production-ref> STAGING_TEST_PASSWORD=<12+ characters> npm run staging:seed -- --confirm <staging-ref>
```

| Account | Contents |
|---|---|
| `staging-empty@bodybuddy.test` | Only the default profile the `on_auth_user_created` trigger creates; no records (new-user state) |
| `staging-partial@bodybuddy.test` | Targets, 2 weights, 1 meal today, 1 favorite |
| `staging-full@bodybuddy.test` | Profile, 14 days of weights, 7 days of meals (today partly logged), 4 workouts, 6 favorites, 3 knowledge items |

All values are synthetic and dated relative to the seed day (`--today YYYY-MM-DD`
overrides it). Re-running deletes and recreates only accounts carrying this
script's metadata marker; an unmarked account with one of these emails stops the
run. Rehearse locally with `STAGING_SUPABASE_URL=http://127.0.0.1:54321`,
`STAGING_SUPABASE_PROJECT_REF=local` and `--confirm local`.

## 5. Configure Vercel Preview

Set these for the **Preview** environment (optionally only for the `staging` branch):

| Variable | Value |
|---|---|
| `VITE_APP_ENV` | `staging` |
| `VITE_SUPABASE_URL`, `SUPABASE_URL` | Staging project URL |
| `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY` | Staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service key (request limits) |
| `PRODUCTION_SUPABASE_PROJECT_REF` | Production project ref |
| `GOOGLE_GENERATIVE_AI_API_KEY` | A key with its own spending limit, if AI features are tested |

Also add `PRODUCTION_SUPABASE_PROJECT_REF` to **Production** to enable the
production check. Keep "Automatically expose System Environment Variables"
enabled: without `VERCEL_ENV` the check silently does nothing. Every checked build
logs `Deployment environment check passed for VERCEL_ENV=...`.

## 6. Stable URL

Push a `staging` branch. Vercel serves its latest deployment at the branch alias
(`<project>-git-staging-<scope>.vercel.app`), or assign a domain to that branch.
Preview Deployment Protection may require a Vercel login; decide whether the
iPhone signs in or the staging URL gets an exception before installing the app.

## 7. Verify isolation before any acceptance testing

- The build log shows the passed check for `VERCEL_ENV=preview`.
- The `STAGING` badge is visible on the sign-in screen.
- Browser network requests go only to `<staging-ref>.supabase.co`.
- Sign in as `staging-full@bodybuddy.test`; its synthetic data appears.
- Log a meal, then confirm the row exists in the staging table editor. The seeded
  emails must not exist in production.
- Send a coach message and find its `X-Request-Id` in a Preview runtime log
  `ai_request` line (see [request tracing](./REQUEST_TRACING.md)).

Then continue with iPhone acceptance in section 3 of
[remaining agent work](./REMAINING_AGENT_WORK.md). Production release order is in
[database release](./DATABASE_RELEASE.md).
