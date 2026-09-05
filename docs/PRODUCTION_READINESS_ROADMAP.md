# BodyBuddy Production Readiness Roadmap

> Primary implementation handoff for Claude Code. This document consolidates the remaining product-engineering, security, reliability, testing, AI evaluation, observability, PWA, and portfolio work. Complete work in priority order. Do not deploy unless the user explicitly asks.

## 1. Sources of truth

Use these documents in this order:

1. This roadmap for production-readiness priorities and sequencing.
2. [`redesign/IMPLEMENTATION_GUIDE.md`](./redesign/IMPLEMENTATION_GUIDE.md) for the approved product and visual design.
3. [`redesign/REVIEW_AND_FIX_PLAN.md`](./redesign/REVIEW_AND_FIX_PLAN.md) for the first redesign review and its historical findings.
4. Existing source code and database migrations for current behavior.

Do not redo completed redesign work unless a task below requires a focused correction.

## 2. Current baseline

As of 2026-09-04 on branch `redesign`:

- Four-tab Today / Calendar / Coach / Me navigation is implemented.
- Today and Me redesigns are implemented.
- Voice, photo, and manual meal entry points exist.
- Route-level code splitting is implemented.
- Profile writes are awaitable and target/profile routes wait for initial store hydration.
- The project has Vitest with 14 focused tests.
- The current AI eval harness covers food-name RAG lookup and assistant tool selection.
- TypeScript, Oxlint, Vitest, Vite production build, PWA generation, and translation-key parity pass.
- The initial JavaScript bundle is approximately 490 kB before gzip and 143 kB after gzip.

Known unresolved facts:

- The configured production Supabase project returned PostgreSQL error `42703` for `profiles.goal_type`; the migration file exists but was not applied when last checked.
- Store hydration still treats Supabase read errors as empty data.
- Voice recognition can remain stuck in `processing` after a manual stop that produces no result/error event.
- Authenticated browser and installed-iPhone PWA acceptance testing is still required.

## 3. Priority definitions

- **P0 — Release blocker:** complete before the next production deployment.
- **P1 — Production foundation:** complete before describing the system as production-grade.
- **P2 — Production maturity:** improves operations, resilience, safety, and measurable quality.
- **P3 — Portfolio differentiation:** makes the engineering decisions and outcomes easy for an interviewer to understand.

## 4. P0 — Release blockers

### P0.1 Apply and verify the `goal_type` migration

Owner split:

- Claude Code: keep the migration idempotent, locally testable, and backward compatible.
- User/operator: run the migration in the target Supabase project or through an approved migration pipeline.

Required work:

- Apply `supabase/migration-goal-type.sql` to the target project.
- Confirm `profiles.goal_type` exists.
- Confirm the check constraint accepts only `recomposition`, `fat_loss`, `muscle_gain`, `maintenance`, `performance`, or `null`.
- Confirm existing calories and macro targets are unchanged.
- Confirm changing only numeric targets still works when goal type is null.
- Confirm changing goal type and numeric targets persists after a hard reload.

Do not place database passwords, service-role keys, or user credentials in source files, logs, fixtures, prompts, or commits.

Acceptance criteria:

- A schema probe selecting `goal_type` returns HTTP 200 rather than PostgreSQL `42703`.
- The migration can be run repeatedly without error.
- Existing profile rows retain all numeric target values.

### P0.2 Make store hydration fail closed

Problem:

`StoreProvider` currently ignores Supabase `error` values. A network, RLS, schema, or service error can be interpreted as an empty account. The UI may then expose default zeros and empty collections as if loading succeeded.

Required work:

- Check the result of every initial Supabase query.
- Do not set `loading=false` with default/empty data when a read failed.
- Add an explicit store state such as `idle | loading | ready | error` plus a retry action.
- Render a localized retry/error screen instead of editable routes when hydration fails.
- Distinguish a successful `maybeSingle()` response with no profile row from a failed query.
- Create a default profile only after a confirmed successful no-row response.
- Check the fallback profile insert result.
- Prevent target/profile forms from becoming editable until store state is `ready`.
- Add tests for partial query failure, profile read failure, retry success, and confirmed no-row creation.

Acceptance criteria:

- Simulated Supabase read failure never displays an editable all-zero profile.
- Retry loads the original saved profile without a page reload.
- A genuine new user receives a default profile with all targets set to zero.

### P0.3 Fix voice-recognition terminal states

Problem:

Manual stop sets voice state to `processing`, but `onend` preserves that state. Some browsers can emit `onend` without `onresult` or `onerror`, leaving the microphone disabled indefinitely.

Required work:

- Extract voice lifecycle transitions into a small testable hook or state helper.
- Ensure every recognition session reaches `idle`, `ready`, or `error` after `onend`.
- Clear the recognition ref after the session ends.
- Ignore late events from an obsolete session.
- Preserve an existing transcript when a retry fails.
- Add a timeout/failsafe for browsers that fail to emit a terminal event.
- Keep transcript editing and confirm-before-write behavior.
- Add tests for result, error, permission denial, manual stop with result, manual stop without result, and component unmount.

Acceptance criteria:

- The microphone is never permanently disabled after stop/cancel/error.
- Permission denial produces a localized recoverable state.
- No recording begins without an explicit user gesture.

### P0.4 Close remaining redesign interaction defects

Required work:

- Make the inactive `DailySummaryCarousel` face unavailable to keyboard focus and assistive technology (`inert` plus appropriate accessible state, with a compatible fallback if needed).
- Keep visible arrow and pagination controls operable by keyboard.
- Replace fixed `86400000` date arithmetic in `dateOffset()` with local-calendar `setDate()` arithmetic to avoid DST skips/duplicates.
- Add localized Previous month / Next month labels to Calendar icon buttons.
- Add tests for DST-adjacent date offsets and carousel active/inactive state.

Acceptance criteria:

- Tabbing cannot reach an off-screen carousel action.
- The seven-day strip always contains seven distinct consecutive local dates around DST changes.
- Calendar controls have meaningful localized accessible names.

## 5. P1 — Security and trusted server boundaries

### P1.1 Authenticate every AI endpoint

Current risk:

Keeping model keys server-side protects the key itself, but an unauthenticated public endpoint can still be abused to spend quota. Client-supplied user context can also be forged.

Required work:

- Send the current Supabase access token in the `Authorization: Bearer <token>` header for protected AI requests.
- Add shared server middleware/helper to verify the JWT against Supabase.
- Return standardized `401` and `403` responses.
- Never accept a client-provided user ID as authoritative.
- Fetch sensitive user context server-side using the verified user ID where practical.
- If some context remains client supplied for latency, explicitly classify it as untrusted and validate it.
- Keep AI tool execution proposal-only unless an endpoint has an authenticated, explicit write contract.
- Add contract tests for missing, expired, malformed, and valid tokens.

Acceptance criteria:

- Anonymous requests cannot invoke paid model endpoints.
- User A cannot cause the server to load User B's data.
- Authentication errors never leak implementation details or secrets.

### P1.2 Add rate limits and request budgets

Required work:

- Define per-user and per-IP burst limits.
- Define a daily model-call or token budget per user.
- Apply stricter limits to image recognition than text requests.
- Return `429` with a retry hint.
- Limit message count, text length, image byte size, image dimensions, and allowed MIME types.
- Reject malformed payloads before calling a model.
- Add timeout and request cancellation support.
- Record limit decisions in structured logs without storing sensitive content.

Implementation may use a provider appropriate to the deployment, but do not introduce Redis solely for resume decoration. Document the chosen tradeoff and free-tier implications.

### P1.3 Treat all external input as untrusted

Required work:

- Define Zod request and response schemas for every API endpoint.
- Use one standardized API error envelope with `code`, `message`, and `requestId`.
- Validate assistant messages, action proposals, RAG matches, image metadata, and knowledge ingestion.
- Bound numeric nutrition/workout values and reject `NaN`, infinity, negatives where invalid, and extreme values.
- Prevent prompt injection in saved knowledge from overriding system/tool rules.
- Escape/render assistant text safely; do not introduce raw HTML rendering.

## 6. P1 — Data reliability and database engineering

### P1.4 Build a reliable mutation layer

Problem:

Most meal, workout, saved-item, weight, and knowledge mutations update local state optimistically but report database failures only through `console.error`. A user can see a record that disappears after refresh.

Required work:

- Make every mutation return a Promise with a typed result.
- Centralize optimistic update, rollback/refetch, duplicate-submit prevention, and user-visible error handling.
- Add localized success/error states or a small accessible toast system.
- Use stable client-generated UUIDs as idempotency keys for create operations.
- Ensure retrying a timed-out create cannot duplicate a meal/workout.
- Add confirmation or recoverable Undo for destructive deletes.
- Do not navigate away until critical writes are acknowledged.
- Test failed create, update, delete, duplicate retry, rollback, and refetch behavior.

### P1.5 Generate and use Supabase database types

Required work:

- Generate TypeScript types from the Supabase schema.
- Replace `any` row mappers with generated Row/Insert/Update types.
- Keep domain models separate from raw database rows where useful.
- Validate unknown enum values at the boundary.
- Add a CI check that generated types are not stale after schema changes.

### P1.6 Establish a real migration pipeline

Required work:

- Consolidate the authoritative schema/migration order.
- Verify a fresh local database can be created from migrations.
- Verify migrations upgrade a fixture representing the previous schema.
- Verify migrations are idempotent where the repository expects repeatability.
- Create separate development/staging/production Supabase projects or an equivalent isolation strategy.
- Never run E2E tests against production user data.
- Document deployment order, backward compatibility, rollback/roll-forward strategy, and operator checks.

## 7. P1 — Four-part CI architecture

Keep the four concerns separate so deterministic checks are not blocked by model quota.

### CI 1: Core CI — required on every pull request

Create a workflow such as `.github/workflows/ci.yml`.

Required jobs:

```text
install (npm ci)
lint
typecheck
unit/component tests
production build
git diff/check-generated-artifacts where applicable
```

Required improvements:

- Add an explicit `typecheck` package script.
- Cache npm safely using the lockfile.
- Pin the supported Node major version.
- Upload useful test/build artifacts only when needed.
- Make this workflow required for merging.
- Do not require AI or cloud secrets.

Initial test additions:

- Store hydration success/failure/retry.
- Mutation rollback and duplicate prevention.
- Voice state lifecycle.
- DST-safe date utilities.
- Nutrition bounds and conversions.
- Carousel accessibility state.
- Navigation route families.
- BMI, streak, and monthly distinct-day helpers.

### CI 2: Supabase integration CI — required on every pull request

Create a workflow such as `.github/workflows/database.yml` using a disposable local Supabase stack in CI.

Required checks:

- Start a clean local Supabase instance.
- Apply all migrations from zero.
- Apply the migration set a second time if idempotency is an intended property.
- Seed test users and representative records.
- Verify new-user defaults.
- Verify profile goal type and numeric target persistence.
- Verify foreign keys, uniqueness, and expected constraints.
- Verify RLS: User A cannot read/update/delete User B's profile, meals, weights, workouts, saved items, or knowledge.
- Verify authenticated CRUD for each table.
- Generate database types and fail on an unexpected diff.
- Tear down the disposable database.

Do not use production Supabase credentials in this workflow.

### CI 3: Playwright E2E — required before release; targeted smoke on PRs

Create a staging-only E2E workflow after Core CI and Database CI are stable.

Environment requirements:

- Dedicated staging Supabase project or isolated ephemeral environment.
- Dedicated E2E test user created through a secure setup step.
- Vercel preview URL or locally served production build.
- Credentials stored only in GitHub Actions Secrets.
- Per-run data namespace and cleanup.

Core journeys:

1. Sign in and sign out.
2. Direct-load `/settings/targets` and verify hydrated values.
3. Change goal and targets, reload, and verify persistence.
4. Create, edit, and delete a meal.
5. Create, edit, and delete a workout.
6. Verify Today totals, seven-day ring state, Calendar marker, and Day back navigation.
7. Create and delete a knowledge item.
8. Change language/theme and verify reload persistence.
9. Simulate API/database failure and verify visible recovery behavior.
10. Mock camera, speech-recognition, and model responses for deterministic UI-flow tests.

Test at mobile and desktop viewport sizes. Keep real iOS permission behavior in the manual release checklist.

### CI 4: AI eval — separate, budgeted, and initially non-blocking

Keep `.github/workflows/eval.yml` independent from deterministic CI.

Execution policy:

- Run a small smoke suite only when AI prompts, tools, RAG, model configuration, or AI request schemas change.
- Run the full suite manually or nightly/weekly according to quota.
- Use concurrency control so multiple commits do not run duplicate evals.
- Set an explicit maximum case count/cost per run.
- Do not make model-backed evals a required merge check until variance and quota behavior are understood.
- An entirely skipped/rate-limited run must be reported as **inconclusive**, not as a pass.

Split the harness into independently scored suites:

1. **Retrieval eval:** food aliases, correct match, no-match, distance threshold, multilingual queries.
2. **Structured extraction eval:** meal/workout fields, units, portions, brands, time/date intent.
3. **Tool-policy eval:** correct tool, no unwanted tool, confirm-before-write, multiple actions, ambiguous requests.
4. **Recommendation eval:** remaining-budget arithmetic, use of saved foods, workout/knowledge awareness, constraint adherence.
5. **Safety eval:** extreme deficits, medical requests, eating-disorder signals, minors/pregnancy/medical-condition uncertainty, prompt injection.
6. **Bilingual eval:** equivalent Chinese and English intent produces equivalent structured behavior.
7. **Photo eval:** versioned licensed/synthetic image set, expected foods, editable uncertainty; run less frequently because it is expensive.

Scoring requirements:

- Prefer deterministic schema/tool assertions over LLM-as-judge where possible.
- Use numeric ranges for nutrition estimates rather than exact values.
- Separate retrieval accuracy from generation quality.
- Track pass rate, false positive/negative rate, tool precision/recall, latency, tokens, and estimated cost.
- Version dataset, prompt, model, tool schema, and scoring logic.
- Save machine-readable JSON plus a concise Markdown or GitHub Step Summary report.
- Compare against a checked-in baseline and flag regressions by suite.
- Record skipped and inconclusive cases separately from passes.
- Never put real user messages, photos, health records, or credentials in eval fixtures.

Initial harness corrections:

- Add enough cases that an 80% threshold is meaningful.
- Add negative/adversarial cases and ambiguous requests.
- Include recent meals, workouts, saved foods, and knowledge in assistant fixtures.
- Test proposed action payloads, not only action type.
- Add deterministic unit tests for the scorer itself.
- Reduce rate-limit pressure through suite selection, controlled concurrency, and provider-aware backoff rather than treating skips as success.

## 8. P1 — Health safety and privacy

### P1.7 Add a deterministic health-safety layer

Required work:

- Define product boundaries: nutrition coaching, not medical diagnosis or treatment.
- Mark AI nutrition and exercise-burn values as estimates before confirmation.
- Add deterministic validation after model output and before rendering/saving.
- Reject or ask for clarification on impossible portions, negative values, and extreme calorie/macro recommendations.
- Avoid recommending extreme calorie deficits or unsafe rapid weight change.
- Handle higher-risk contexts conservatively and direct users to qualified professionals when appropriate.
- Keep saved knowledge as user-provided context, not trusted medical fact.
- Prevent knowledge text from changing system/tool policy.
- Document the safety rules and add matching eval cases.

### P1.8 Add user data controls

Required work:

- Write a concise privacy/data-use page.
- Explain what photos/text are sent to the model provider.
- Define image retention behavior; avoid retaining images unless explicitly needed and consented.
- Add account data export.
- Add account/data deletion with clear confirmation and recoverability expectations.
- Define log retention and redaction; never log auth headers or raw sensitive payloads by default.

## 9. P2 — Observability and operational reliability

### P2.1 Add structured end-to-end observability

Required work:

- Generate a request ID at the client/API boundary and return it in errors.
- Add structured server logs with endpoint, user hash/opaque ID, status, latency, retry count, model, prompt version, token usage, and estimated cost.
- Add frontend/server error reporting such as Sentry or an equivalent free-tier solution.
- Redact authorization headers, photos, prompts, emails, and health values unless explicitly required for a narrowly controlled diagnostic mode.
- Define dashboards/queries for:
  - AI success rate and P50/P95 latency.
  - Tokens and estimated cost per request/active user.
  - Rate-limit and retry frequency.
  - Photo/voice failure rates.
  - Store hydration and mutation failure rates.
  - Client crash-free sessions.
- Create a short incident runbook for model outage, Supabase outage, migration failure, and sudden cost spike.

### P2.2 Harden AI reliability and cost behavior

Required work:

- Add bounded exponential backoff with jitter for retryable errors.
- Do not retry validation, authentication, or other permanent errors.
- Add endpoint-specific timeouts and client cancellation.
- Prevent duplicate model requests from double taps.
- Bound conversation history through summarization or a clear context window policy.
- Track prompt/model versions in every response/log/eval result.
- Add model fallback only if its quality/cost tradeoff is documented and evaluated.
- Add a kill switch or feature flag for expensive AI capabilities.

### P2.3 Add product analytics without collecting sensitive content

Track events, not raw meal/health text:

- Meal entry started/completed by voice, photo, or manual route.
- Time to complete a meal entry.
- Photo estimate accepted or edited.
- Voice transcript sent or abandoned.
- Assistant action confirmed or dismissed.
- Calendar/day-detail usage.
- Knowledge item created and later used in a recommendation.

Define product metrics:

- Median time to log a meal.
- Voice/photo completion rate.
- Photo correction rate.
- Assistant action confirmation rate.
- 7-day retention and tracked-day frequency.

Document consent, retention, and opt-out behavior.

## 10. P2 — Offline-first PWA resilience

Implement only after mutation reliability and E2E coverage are stable.

Required work:

- Cache the authenticated app shell and last successfully loaded user view appropriately.
- Use IndexedDB for an explicit offline mutation queue.
- Allow manual meal/workout entry while offline.
- Show synced / pending / failed status without alarming visual noise.
- Retry safely when connectivity returns.
- Use UUID/idempotency keys to prevent duplicate records.
- Define conflict behavior for edits and deletes.
- Keep AI actions clearly unavailable or queued only when behavior is safe and understandable.
- Test offline creation, app restart, reconnection, duplicate prevention, and conflict handling.

Do not cache auth tokens or sensitive responses outside the established secure client/session mechanism without a documented threat review.

## 11. P2 — Performance and accessibility budgets

Required work:

- Establish measurable mobile budgets for initial JS, LCP, CLS, and interaction latency.
- Keep Recharts isolated from the initial route.
- Analyze the remaining approximately 490 kB initial bundle and remove unused provider/client code from browser bundles.
- Ensure all icon-only buttons have localized names.
- Run automated accessibility checks in component/E2E tests.
- Verify dialogs, carousels, forms, errors, toasts, and navigation with keyboard and a screen reader.
- Respect reduced motion and minimum touch targets.
- Keep light/dark contrast and iPhone safe-area behavior in release QA.

## 12. P3 — Architecture and portfolio evidence

### P3.1 Document engineering decisions

Add concise ADRs for:

- PWA instead of native iOS/TestFlight.
- Supabase/Postgres/RLS as the backend.
- Provider-agnostic Vercel AI SDK integration.
- Proposal-first AI tools and human confirmation before writes.
- pgvector for food retrieval but structured storage for user knowledge.
- Local/staging/production environment strategy.
- Chosen rate limiter and observability provider.
- Offline conflict/idempotency strategy if implemented.

### P3.2 Add architecture artifacts

Create:

- High-level system architecture diagram.
- Authenticated AI request sequence diagram.
- Voice/photo meal logging sequence diagram.
- Database/RLS boundary diagram.
- CI pipeline diagram showing deterministic CI versus model-backed evals.
- Threat model covering API abuse, cross-user access, prompt injection, sensitive logs, and cost exhaustion.

### P3.3 Publish measurable outcomes

After implementation, update the README with verified numbers:

- Bundle reduction.
- Test counts by layer.
- RAG retrieval accuracy on the versioned eval set.
- Tool-call precision/recall.
- P50/P95 AI latency.
- Cost per representative AI interaction.
- Meal-entry completion time or correction rate if analytics data is available.

Do not invent metrics. Label local/staging measurements accurately.

### P3.4 Improve the portfolio presentation

- Add current light/dark Today and Me screenshots.
- Add a 60–90 second demo video.
- Include one concise architecture section and one reliability section in the README.
- Add a case study covering a real failure and fix, such as Vercel ESM imports, model overload handling, PWA keyboard/safe-area behavior, or migration drift.
- Explain tradeoffs and rejected alternatives; do not add CrewAI, Kafka, Redis, microservices, or other infrastructure without a real requirement.

## 13. Manual release validation — not CI

Automated testing does not replace physical-device acceptance testing.

Before each release, test with a dedicated non-production account:

- iPhone installed PWA launch/update/session persistence.
- Camera permission allow/deny/cancel/retry.
- Microphone permission allow/deny/stop/retry.
- Keyboard open/dismiss on Coach, LogMeal, Knowledge, targets, and profile.
- Bottom navigation remains flush with the safe-area bottom.
- No content is hidden by notch, home indicator, or sticky navigation.
- Light, dark, and system themes.
- Chinese and English.
- Offline/reconnect flows after offline support exists.
- Empty, partial, and fully populated account states.

Never place manual QA account credentials in this document or source control.

## 14. Recommended implementation milestones

### Milestone A — Safe redesign release

- Complete all P0 items.
- Apply and verify `goal_type` migration.
- Run Core CI checks.
- Complete authenticated browser and iPhone PWA manual QA.

### Milestone B — Secure data foundation

- Complete authenticated AI endpoints, rate limiting, schemas, mutation reliability, generated DB types, migration pipeline, and health-safety boundaries.
- Add Core CI and Supabase integration CI.

### Milestone C — Automated product verification

- Add Playwright staging E2E.
- Expand and split AI eval suites.
- Establish baseline reports and budget controls.

### Milestone D — Operable production system

- Add structured observability, dashboards, incident runbooks, product analytics, and AI cost controls.

### Milestone E — Differentiated portfolio project

- Add offline-first sync if justified by user need.
- Complete ADRs, diagrams, threat model, verified metrics, screenshots, and demo video.

## 15. Definition of production-ready for BodyBuddy

The project may be described as production-ready only when:

- All P0 items are complete.
- Paid AI endpoints require valid authentication and enforce request limits.
- User-visible writes cannot silently fail.
- Database migrations and RLS are automatically tested.
- Core CI, database CI, and release E2E are passing.
- AI evals produce versioned, non-misleading reports with cost controls.
- Health-safety and privacy boundaries are documented and enforced.
- Operational errors, latency, token use, and cost are observable.
- A staging environment is separate from production user data.
- The manual iPhone PWA release checklist has been completed.

## 16. Claude Code execution rules

When implementing this roadmap:

1. Read this file completely before editing code.
2. Work strictly in priority order; do not start P2/P3 while P0 remains open unless the user explicitly changes priority.
3. Inspect existing code and tests before introducing dependencies or abstractions.
4. Keep each commit focused and reviewable.
5. Use English commit messages.
6. Do not add Claude, Anthropic, OpenAI, Codex, or another AI tool as a co-author.
7. Never commit credentials, auth state, `.env.local`, production data, user photos, or real health records.
8. Use a local/disposable database for automated integration tests and staging for E2E.
9. Do not make paid AI evals part of ordinary deterministic CI.
10. Preserve confirm-before-write for all AI-proposed user-data changes.
11. Run relevant checks after every milestone and report exact results.
12. Do not deploy unless the user explicitly requests it after verification.

Minimum deterministic verification:

```bash
npm run lint
npm run test
npm run build
git diff --check
```

For every completed roadmap item, update its tests and documentation in the same focused change.
