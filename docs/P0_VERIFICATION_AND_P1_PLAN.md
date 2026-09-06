# P0 verification and P1 execution plan

## Scope of this change

Close the remaining local P0 code defects and establish Core CI. No deployment,
production migration, production-data tests, or paid model evals are performed.

### P0.1 — migration prepared; remote acceptance pending

The additive migration preserves numeric columns. Its constraint existence check
is scoped to public.profiles, so a same-named constraint on another table cannot
silently prevent creation. Target-project execution and repeatability are not yet
verified. An operator must record a successful goal_type schema probe, accepted
enums/null, rejected invalid values, unchanged numeric targets, and hard-reload
persistence using a dedicated test account. Never include credentials or real
profile values in the record.

### P0.2 — hydration failure handling

Every initial read is checked. Failed reads or thrown transport errors expose
retry instead of editable routes. Default creation only follows a successful
no-row response; it explicitly writes zero targets and validates the returned
insert before publishing data. Component tests cover saved targets, partial and
profile failures, retry, new-user creation, and failed creation.

### P0.3 — voice lifecycle

A controller owns the recognition instance, detaches handlers on completion,
ignores obsolete callbacks, and aborts on unmount. Stop has a five-second failsafe;
an entire session has a sixty-second failsafe. Errors never erase the transcript.
Voice entry remains user initiated and AI actions still require confirmation.
Tests cover result/end/error, synchronous stop/end, missing events, start/stop
exceptions, replacement and disposal. Real iPhone permissions remain manual QA.

### P0.4 — calendar and carousel

Date offsets use local setDate arithmetic. DST tests run in America/New_York in
CI. Inactive cards use inert and aria-hidden; the hidden workout button is also
disabled and removed from tab order as a fallback. Component tests verify both
faces after switching. Real browser keyboard/screen-reader validation remains
part of release acceptance.

## Core CI

`.github/workflows/ci.yml` installs from the npm lockfile on Node 24 and runs lint,
typecheck, tests, production/PWA build and whitespace checks without cloud secrets.
Configure the `Core CI / core` check as required in repository rules after its
first successful GitHub run. Local execution is not proof of a successful hosted
workflow or branch-protection configuration.

## Remaining P1 sequence

API-boundary implementation is now present; see [API trust boundary](./API_TRUST_BOUNDARY.md)
for contracts, tests and rollout limitations. Live auth/RLS and staging journeys
remain unverified. Other P1 phases below are still pending.

1. **API boundary (P1.1/P1.3):** share auth, request/response schemas and safe errors
   between Vercel and Vite; verify Supabase tokens; derive identity server-side;
   test invalid tokens and cross-user context access across all five endpoints.
2. **Database foundation (P1.5/P1.6):** canonical migrations, disposable database
   CI, fresh/upgrade fixtures, RLS/CRUD/constraint checks, generated types with
   drift detection, development/staging/production isolation.
3. **Limits (P1.2):** atomic persistent user/IP burst counters and daily budgets,
   stricter image limits, payload bounds, cancellation and timeouts; test concurrent
   budget reservations and 429 retry hints. Evaluate Supabase counters before
   introducing another service and document the operational/cost tradeoff.
4. **Mutations (P1.4):** typed async results, pending state, visible localized
   errors, rollback/refetch, stable IDs across retries, deletion confirmation/Undo;
   wait for acknowledged writes before navigation or Coach completion markers.
5. **Safety/privacy (P1.7/P1.8):** deterministic output bounds, estimate labels,
   higher-risk behavior and knowledge-injection defenses; privacy page, export,
   authenticated account deletion, retention and redaction rules.
6. **Product verification:** isolated Playwright mobile/desktop journeys; seven
   independently scored AI eval suites, budgets, baseline reports, versioning and
   explicit inconclusive/skipped results. Keep model-backed evals non-blocking.

Each phase must include its tests and documentation. Do not declare P0 or P1
complete while external acceptance checks remain unverified. Do not deploy without
an explicit deployment request.
