# Database release

Repository secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and
`SUPABASE_PROJECT_ID`. The CLI version is pinned by package-lock.json.

The Deploy database migrations workflow first runs Core CI and Database CI on
the same commit. Its production job links the project, lists migration history,
previews pending migrations, and applies them with `db push`. It never resets
the remote database, seeds it, or repairs migration history automatically.

For initial setup, run the workflow on main in preview mode and review the
pending versions. If SQL was previously applied manually, inspect those files
and the remote schema before proceeding. Do not blindly mark versions applied.
Run deploy mode after reconciliation, then set the repository Actions variable
`DATABASE_DEPLOY_ENABLED` to `true` to enable automatic migration deployment on
main. Repository secrets remain available to the existing Production environment.

For routine changes, add a migration, validate locally with `npm run db:reset`,
`npm run db:test`, `npm run db:upgrade`, and `npm run db:types:check`, then commit
and push or merge to main. Check the release workflow result in GitHub Actions.
No pending migrations is a successful no-op. Failed migration history checks
stop deployment; resolve the mismatch explicitly before retrying.

Vercel's Git integration runs independently and does not wait for this workflow.
Until application deployment is explicitly orchestrated, release additive schema
changes in a separate commit first, wait for database deployment to succeed, then
push the application changes that require that schema. Remove or rename fields
only in a later release after old application versions no longer depend on them.
