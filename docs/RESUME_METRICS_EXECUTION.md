# Resume metrics execution

The user-provided `RESUME_METRICS_PLAN.md` defines the requested experiments.
This file records implementation and observed evidence without treating target
numbers as results. Three-model comparisons remain paused.

## Experiment 1: concurrent idempotency

Run `node scripts/db/resume-metrics.mjs` against the disposable
`bodybuddy-local` Supabase stack. The script refuses hosted database URLs and
requires ten distinct PostgreSQL backend sessions.

- 100 sequential logical-operation groups: 34 meals, 33 favorites, 33 workouts.
- Ten concurrent submissions per group, 1,000 primary submissions total.
- Registered, versioned proposals use `transition_coach_proposal` as the
  authenticated role. Every response must report the expected confirmed state,
  version and payload. Every operation must have exactly one matching business
  record and immutable action receipt.
- Separate probes verify competing contents, retry after discarding a committed
  response, business-insert rollback, and cross-account isolation. Their calls
  are excluded from the 1,000-submission denominator.
- Discarding a response simulates caller uncertainty after commit; it is not
  presented as an injected TCP failure.
- Timing covers the SQL RPC request/response and includes failed primary calls.
  It excludes fixture setup, inspection, AI generation, HTTP and browser work.
- Cleanup deletes only the two randomly created synthetic auth accounts and
  their cascaded records. Cleanup failure prevents a passing report.

The report includes code/migration hashes, commit, dirty status, PostgreSQL and
Node versions, machine metadata, every primary response and per-operation checks.
Incomplete execution reports duplicate count as unknown, never zero.

Local attempt on 2026-09-21: no database available, zero submissions, inconclusive.
This is not concurrency evidence. GitHub workflow `Resume concurrency evidence`
runs the protocol in its own Supabase environment and retains JSON/Markdown
reports plus generated database types as artifacts for 30 days. Copy verified
reports into permanent evidence storage before artifact expiration.

Do not use the zero-duplicates resume bullet until the real CI report passes.
Even a passing run is a bounded synthetic experiment, not general reliability
or production traffic evidence.

## Remaining experiments

1. Define and freeze 50 single-model tool-policy scenarios before 3 repetitions.
   This is separate from the paused three-model comparison. Provider failures
   remain unscored; costs with missing usage remain incomplete.
2. Resolve catalog provenance/reference-unit findings before interpreting the
   frozen retrieval holdout. Preserve shared filters and catalog fingerprints.
3. Collect application endpoint latency and full task cost baselines separately
   from the database microbenchmark. No optimization benefit is yet measured.
4. Human paired timing requires participants; no automated result substitutes for it.
