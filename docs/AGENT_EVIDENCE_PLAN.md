# Agent implementation and evidence plan

Updated 2026-09-09. Development branch: `codex/agent-proposals-evaluations`.
Production remains unchanged until physical-device acceptance and explicit approval.

## Priorities approved for this iteration

1. Editable, confirm-before-write meal/favorite/workout proposals.
2. Immutable action receipts, transactional writes, exact retries and content conflicts.
3. Deterministic UI/database and browser execution tests.
4. Exact/semantic retrieval with metadata and unit compatibility.
5. Versioned model evaluation and reproducible outcome measurement.

The unresolved installed-iPhone keyboard issue and missing isolated hosted staging
environment remain release blockers. This work does not claim to fix either.

## Implemented contracts

The assistant emits `{ actionId, date, action }`. Tool execution only assembles
proposals; `lookupNutrition` is read-only. The UI lets users edit all relevant
fields before confirmation. Cancellation makes no database call. Nutrition and
exercise burn are visibly estimates; changing a portion requires reviewing its
nutrition values, rather than silently scaling a mixed meal.

Confirmation uses `confirm_agent_action`, authenticated with the user's Supabase
session. The PostgreSQL function fixes ownership to `auth.uid()`, validates the
payload, inserts an immutable receipt, and creates the record in one transaction.
The `(user_id, action_id)` primary key serializes concurrent submissions.

- Same ID and JSONB-equivalent payload: return the existing receipt.
- Same ID with different date/content/action type: `PT409`, no overwrite.
- Invalid payload or failed record insert: transaction rollback, no receipt.
- Deleted user record: old receipt remains; replay does not recreate the record.
- Account deletion: receipts cascade with the account.
- Uncertain network outcome: freeze the confirmed payload and retry its original
  ID. Editing it after an uncertain write is deliberately unavailable.

The function is a narrow security-definer boundary because clients must not write
or modify receipts directly. It uses an empty search path and authenticated grants;
authenticated clients have only owner-scoped SELECT on receipts. This is a user
write endpoint, not proof that a model originated the client-supplied proposal.

The receipt retains nutrition payloads for idempotency and conflict comparison.
It is private account data, not telemetry. There is no automatic retention expiry
yet; deleting the entire account deletes it. Chat text/photos are not copied into
receipts. Explicit record edits outside the proposal flow remain ordinary edits.

## Retrieval behavior and limits

Exact normalized names, English names and comma-separated aliases run before
embeddings. Brand, preparation and compatible base units filter candidates.
Duplicate exact aliases and close semantic ties abstain. The existing distance
threshold is retained; the ambiguity margin is an engineering default, not an
empirically optimized threshold. Neither currently has a verified accuracy claim.

Photo calibration permits compatible mass or volume conversions only. It never
equates grams and milliliters or invents a serving size. Existing catalog rows are
marked `legacy-unverified`: new provenance fields do not establish source quality.
Catalog curation, preparation/brand population, and source verification are still
required. The old destructive seed script must not be used on production for evals.

## Verification layers

- Unit/component: contract validation, tool-only proposals, editing/cancellation,
  uncertain outcomes, conflicts, unit conversion, candidate selection and scoring.
- PostgreSQL integration: 15 action scenarios plus retrieval/RLS/replay/upgrade.
- Browser E2E: 15 scenarios in desktop and mobile Chromium, real local auth and
  database, synthetic AI responses. These test system execution, not model quality,
  real camera recognition, speech permissions, or Safari keyboard behavior.
- Physical iPhone: still required before release.

Run local verification with Docker's disposable `bodybuddy-local` stack:

```sh
npm run db:start
# Use migration up locally to preserve existing local data; reset is for disposable CI.
npx supabase migration up --local
npm run db:types
npm run typecheck
npm test
npm run db:test
npm run db:upgrade
npx playwright install chromium
npm run test:e2e
npm run build
```

The E2E launcher refuses remote database targets and creates/deletes a new test
account per scenario. It uses real RPCs and simulates a lost acknowledgement after
the database commits. Traces are disabled to avoid recording authentication tokens.
Do not label the mobile Chromium project as real iPhone acceptance.

## Resume claim ledger

| Proposed claim | Evidence required / present status |
|---|---|
| Editable tools and actionId-based idempotent persistence | Implemented on the development branch; attach final test results before publishing |
| All 15 E2E scenarios pass | Requires a completed browser run; 15 database tests are not a substitute |
| Incorrect matches reduced from 3/20 to 1/20 | Not measured; do not publish these numbers |
| Compared three model configurations | Runner supports three configurations; a real completed comparison is still required |
| Median entry time 180s to 30s, 25 paired trials, five testers | No tester data supplied; do not publish these numbers |

Until measured, use implementation-only wording: “Implemented editable assistant
proposals with explicit confirmation, transactional idempotency and conflict
detection; built separate model-evaluation and system-execution test pipelines.”

## Real-device and production release order

Create an isolated Supabase staging project, apply migrations there, and configure
Vercel Preview-scoped credentials and auth redirects. Use a stable staging URL for
the installed test PWA. Testers must explicitly approve the preview revision before
merging to main. Apply additive database migrations before deploying the new client
and assistant response contract. This branch has not been deployed.
