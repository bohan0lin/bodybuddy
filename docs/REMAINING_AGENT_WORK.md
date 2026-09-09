# Remaining Agent and Evidence Work

Updated: 2026-09-09

This document lists work that is still required before the resume bullets can be presented as verified outcomes.

Sections 1 and 6 are complete on branch `codex/agent-proposals-evaluations`
(`a931de2`, `08f1ba8`), which is pushed but not merged or deployed.

Every remaining section is blocked on something only the account owner can
supply, not on further code:

| Section | Blocked on |
| --- | --- |
| 2. Staging environment | A Supabase project and Vercel Preview variables created under the owner's accounts |
| 3. iPhone PWA acceptance | A physical iPhone and the staging URL from section 2 |
| 4. Retrieval experiment | An embedding provider key to build the holdout catalog |
| 5. Three-model evaluation | Provider keys and the budget for paid model calls |
| 7. Timing study | Five consenting human testers |
| 8. Production release | Sections 2 and 3, plus explicit approval |

## 1. Finish local verification after the latest edits — done 2026-09-09

Run against the disposable local Supabase stack on `127.0.0.1:54321`. No hosted
project or production data was involved.

- Unit/component suite: 147 tests in 21 files passed.
- Local Supabase integration suite: 33 tests passed, covering idempotency,
  content conflicts, concurrent confirmation, cross-user isolation, request
  limits and retrieval boundaries.
- Proposal E2E: 30 runs passed (15 scenarios in desktop and mobile Chromium).
- Lint, typecheck, API typecheck, production build, generated database type
  check and `git diff --check` all passed; all nine migrations applied to a
  fresh local database and the generated types matched.
- Diff reviewed: no debug leftovers, no Chinese comments in added lines, no
  credentials, and report/result directories are ignored rather than committed.
- Committed as two focused English commits authored only by the repository
  owner, with no AI attribution.

Re-run this section after any further code change; the results above describe
the tree at `08f1ba8` only.

## 2. Create a real hosted staging environment

- Create a separate Supabase staging project. Do not use production user data for E2E or manual testing.
- Apply all current migrations to staging, including the agent action and retrieval migrations.
- Seed the staging food catalog with reviewed synthetic/reference data and embeddings.
- Create separate Vercel Preview environment variables for the staging Supabase URL and anon key.
- Configure staging authentication redirects and email behavior.
- Create a stable Vercel Preview or staging URL that can be installed to an iPhone Home Screen.
- Verify that staging writes cannot reach the production Supabase project.

## 3. Complete real iPhone PWA acceptance

Use a dedicated non-production account and the staging URL.

- Install the preview as a Home Screen app.
- Launch, reload, and update the installed app.
- Test Coach, Log Meal, Knowledge, targets, and profile with the keyboard open.
- Test keyboard dismissal repeatedly and confirm there is no bottom blank space.
- Test camera permission allow, deny, cancel, and retry.
- Test microphone permission allow, deny, stop, and retry.
- Test bottom navigation, safe-area spacing, notch handling, and home-indicator spacing.
- Test Chinese and English.
- Test light, dark, and system themes.
- Test empty, partially populated, and populated accounts.
- Record iOS version, device model, browser/PWA version, and exact reproduction steps for any failure.

Do not call Chromium mobile tests real iPhone acceptance.

## 4. Complete the retrieval quality experiment

- Freeze a separate 20-query holdout set before tuning the retrieval code.
- Include exact aliases, English/Chinese queries, metadata filters, unit mismatches, ambiguous foods, and no-match queries.
- Run the old vector-only baseline and the new exact-plus-semantic pipeline against the same catalog and same holdout.
- Record accepted match, expected match, abstention, incorrect accepted match, and infrastructure failure separately.
- Verify whether the error count is actually 3 to 1.
- Only publish the “15% to 5%” bullet if the observed results support it.
- Store the baseline and candidate reports with dataset, catalog, prompt, code, and scorer versions.

## 5. Complete the three-model evaluation

- Choose three currently supported model IDs.
- Add the required provider keys only as local or GitHub Actions secrets; never commit them.
- Verify current input and output pricing for each model and record the verification date.
- Run the same versioned tool-policy and structured-extraction cases for all three models.
- Compare tool selection, argument correctness, unwanted-tool rate, latency, token usage, and estimated cost.
- Run retrieval, tool-policy, photo, bilingual, and safety suites where budget allows.
- Separate model judgment quality from database execution correctness.
- Mark rate-limited, unavailable, or incomplete runs inconclusive.
- Publish a comparison report only after every compared configuration has complete scored results.

## 6. Complete the 15-scenario evidence package — done 2026-09-09

All 15 scenarios below passed in desktop and mobile Chromium at `08f1ba8`
(30 runs, no failures). The runner refuses to start unless the disposable local
Supabase stack is serving on `127.0.0.1:54321`, so no hosted project was
reachable during the run. Only test code is committed; the report, results and
any authentication state stay ignored.

- Confirm proposal generation performs no writes.
- Confirm edited meal, favorite, and workout proposals persist edited values.
- Confirm cancellation performs no write.
- Confirm rapid duplicate submissions create one record.
- Confirm retry after an uncertain response reuses the same action ID and payload.
- Confirm different content with the same action ID produces a conflict.
- Confirm invalid quantities are rejected before write.
- Confirm multiple proposals can be confirmed or cancelled independently.
- Confirm photo conversations still require explicit confirmation.
- Save the test report and commit only the test code, not authentication state or test data.

## 7. Run the paired meal-entry timing study

- Recruit five consenting beta testers.
- Define five comparable meal-entry tasks per tester.
- Counterbalance baseline and new-interface order.
- Measure from the first entry gesture to a confirmed saved record.
- Include correction and retry time.
- Record failures instead of dropping them.
- Store only pseudonymous participant/task IDs and timing fields.
- Run `evals/analyzeTrials.ts` on the private trial file.
- Report median time, completion rate, exclusions, and paired time saved.
- Publish the “3 minutes to 30 seconds” bullet only if the measured data supports it.

## 8. Production release sequence

- Review the final staging and iPhone results.
- Review the database migration diff and confirm it is additive and backward compatible.
- Apply migrations to production through the approved migration pipeline only after staging passes.
- Confirm the production database schema and generated types match.
- Deploy the application after the migration is available.
- Run a production smoke check with a dedicated account, without using real user data for experiments.
- Keep rollback and roll-forward steps documented.
- Do not merge or deploy until the user explicitly approves the verified staging result.

## Resume claim status

Safe to describe after the relevant evidence is retained:

- “Implemented an assistant with editable proposals, explicit confirmation, transactional idempotency, duplicate-submit handling, and content-conflict detection.”
- “Built deterministic database and browser tests covering proposal confirmation, editing, cancellation, retries, conflicts, and isolation.”
- “Built a versioned evaluation pipeline that separates model judgment quality from system execution correctness.”

Do not yet present these as verified outcomes:

- Incorrect matches reduced from 15% to 5% or from 3 errors to 1 error.
- Comparison of three model configurations.
- 25 paired tasks with five testers and median meal-entry time reduced from 3 minutes to 30 seconds.
- Full iPhone PWA acceptance.
- Production-grade staging isolation.
