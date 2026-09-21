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

Verified CI run on 2026-09-21: [35642413733](https://github.com/bohan0lin/bodybuddy/actions/runs/35642413733),
commit `cd19b7491516ade65199158594ef476c588645c1`, passed. Permanent raw evidence:
[`evidence/concurrency-2026-09-21.json`](evidence/concurrency-2026-09-21.json).
All 1,000 submissions succeeded across 100 logical operations with zero duplicate
records. Maximum in-flight calls was ten, backed by ten distinct connections.
All four separate fault checks and fixture cleanup passed. PostgreSQL 17.6,
Node 24.20.0, Linux runner with four CPUs. SQL-call p50 was 1.90 ms and p95
3.68 ms; these are not application or AI response times.

Resume wording supported by this bounded synthetic experiment:

> Implemented versioned proposals and idempotent persistence; verified zero duplicate
> records across 1,000 submissions for 100 actions with 10 concurrent retries per action,
> plus conflict, rollback, response-loss retry, and account-isolation checks.

Here “response-loss retry” means discarding the successful return at the caller,
not an injected network failure. This is not production traffic evidence.

## Experiment 2: single-model tool behavior

`evals/resume-tools.ts` defines 50 authored scenarios. Its fingerprint is frozen
in `evals/resume-tools.lock.json` before live execution; changes fail validation.
The cases cover 10 meals, eight favorites, 10 workouts, 14 abstention/invalid/
ambiguous requests, and eight multi-action requests, in English and Chinese.
Three sequential repetitions plan 150 runs, not 150 independent scenarios.

Reproduce from the repository root:

```sh
node --import tsx evals/resume-tools-run.ts --dry-run
node --import tsx evals/resume-tools-run.ts --live
```

Only provider credentials are read from `.env.local`. Application database
variables are removed and nutrition lookup is injected to return no match.
The benchmark uses Google Lite from `evals/models.google.json`, not the deployed
application model. It evaluates generated proposals; it does not execute writes
or score nutrition retrieval, photo recognition, reply helpfulness or conversation
recovery. Expected action counts and types, numeric values and units are checked;
food names are not graded. This is an authored regression benchmark, not a blind
held-out user sample or an end-to-end UI test.

Each call has a 60-second timeout and no automatic retry. The observed-spend
allowance is USD 0.50; the last bounded request can exceed that allowance.
Unknown usage stops further calls. Infrastructure failures and unattempted
cases remain unscored. Only a complete run supports the planned 150-run claim.
Reports retain synthetic outputs, per-run scores, failures, source hashes and
measurement boundaries under `evals/results/`. Costs use dated paid-tier price
estimates, not actual bills. Latency includes the complete assistant tool loop,
including failures, but excludes HTTP, browser and database operations.

### Observed run: 2026-09-21

Permanent evidence: [`evidence/resume-tools-2026-09-21.json`](evidence/resume-tools-2026-09-21.json).
The frozen set was unchanged during execution; source hashes identify the
uncommitted runner/dataset used at the recorded base commit.

- Planned: 50 scenarios, three repetitions, 150 runs.
- Attempted: 23; scored: 22; passed: 22; scored failures: zero.
- One request was rate-limited by the provider (`AI_RATE_LIMITED`, mapped to HTTP
  503 by the application); 127 subsequent runs were not attempted.
- Scored coverage: 22/150 (14.7%). Overall status: **inconclusive**.
- Known estimated token cost: USD 0.0191036. Missing usage for the failed request
  means total cost and cost per successful task are unknown.
- Diagnostic tool-loop p50: 1.701 seconds; p95: 19.706 seconds over 23 attempts,
  including the failed request. This incomplete prefix does not represent the
  full scenario distribution or endpoint performance.

Do not present 22/22 as the planned benchmark's accuracy or as production model
accuracy. The scored prefix contains meals, favorites and only four workouts;
abstention and multi-action cases were not reached. Preserve this report on the
next attempt. Provider quota availability must be resolved before a new complete
run; distinguish short-window throttling from exhausted quota using the provider
dashboard. Do not change expected answers or tune prompts to these observations
and continue calling the set held out.

## Remaining experiments

1. Run the frozen 50 single-model tool-policy scenarios over 3 repetitions.
   This is separate from the paused three-model comparison. Provider failures
   remain unscored; costs with missing usage remain incomplete. The first live
   attempt is blocked by provider rate limiting, as recorded above.
2. Resolve catalog provenance/reference-unit findings before interpreting the
   frozen retrieval holdout. Preserve shared filters and catalog fingerprints.
3. Collect application endpoint latency and full task cost baselines separately
   from the database microbenchmark. No optimization benefit is yet measured.
4. Human paired timing requires participants; no automated result substitutes for it.
