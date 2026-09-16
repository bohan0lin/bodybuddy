# Versioned evaluation

`npm run eval -- --dry-run` validates configuration and emits a manifest without
model calls. Reports are written under ignored `evals/results/` as JSON and Markdown.
Synthetic datasets contain no beta-user messages, photos or health records.

`models.example.json` contains two existing model IDs and one explicitly unresolved
candidate. Set real supported model IDs and verified input/output prices before
live testing. No prices are invented; missing prices or keys yield inconclusive
cases. Keep secret values in environment variables, never in model configuration.

```sh
npm run eval -- --live --suite tools --config evals/models.example.json --max-cases 36 --max-usd 1
npm run eval -- --live --suite retrieval --max-cases 40 --max-usd 1
npm run eval:compare -- before/report.json after/report.json
```

Report comparisons require both the same `manifest.scorer` version and the same
`evals/scoring.ts` implementation hash. Changed or missing scorer metadata is
rejected, even if the dataset and catalog match. Rerun both configurations with
one scorer before reporting an improvement; changing scoring rules alone is not
evidence of model or retrieval improvement.

Required provider keys: `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, and/or
`ANTHROPIC_API_KEY`. No production `.env.local` is loaded.

### Database isolation

Every mode, including `--suite tools`, removes `SUPABASE_URL`, `VITE_SUPABASE_*`
and `SUPABASE_SERVICE_ROLE_KEY` from the process before any lookup runs. The only
database that can be queried is `EVAL_SUPABASE_URL` with `EVAL_SUPABASE_ANON_KEY`;
setting only one of them, or pointing it at the application URL, stops the run.

- With an evaluation catalog, retrieval cases and the assistant's `lookupNutrition`
  tool use it in strict mode. A lookup failure makes that case inconclusive
  (infrastructure) instead of silently becoming "no match".
- Without one, tool-case lookups return no match without any network request.
  The report records `toolRetrieval: "none"`; such runs are not comparable with
  runs that used a catalog.

Live runs read the queried `foods` rows (content columns, including embeddings)
and record a SHA-256 `catalog.fingerprint`. The `scripts/foods.json` hash is only
the local seed file. `eval:compare` requires equal fingerprints whenever either
report used a catalog. The catalog must have the new migrations, reviewed
metadata, and seeded embeddings. Set `EVAL_EMBEDDING_MAX_USD_PER_QUERY` to a
conservative per-query ceiling; it is reserved for budget control (retrieval
cases and tool lookups), not reported as a measured embedding cost.

### Preflight and budgets

Before any call, a live run checks the complete matrix: every model has a key,
verified pricing and a non-placeholder ID; retrieval has the evaluation catalog,
an embedding key and an embedding ceiling; `--max-cases` covers every group
(76 for `all` with three models). Any issue stops the run with exit code 2 and a
report listing the issues. `--allow-partial` runs the ready groups anyway; the
missing groups remain inconclusive with a stated reason.

Case and spending allowances are split per group (each retrieval strategy and
each model) in proportion to case counts, so an early configuration cannot use a
later configuration's budget. Calls run sequentially with no automatic retries
and a 60-second per-case timeout. Generation cost uses total reported tokens
across tool steps. A group stops once observed spend reaches its allowance; the
final bounded request can exceed it. An unknown charge stops that group.
Configure a provider-side hard limit if required.

Inconclusive rows carry `reason`: `configuration`, `budget` or `infrastructure`.
Reports count these separately from failures, and count wrong accepted matches
separately from abstentions.

The vector/hybrid retrieval groups are an ablation under identical metadata and
unit filters, not a fixed legacy baseline. Do not describe them as "old vs new".

Exit codes for live runs: 0 complete/pass, 1 complete/fail, 2 inconclusive. Dry runs
exit successfully for valid configuration but explicitly contain zero scored cases.
Rate limits and infrastructure failures never become successful negative cases.

Tool selection and argument correctness are separate dimensions. Extra actions
fail a no-tool or single-tool request. Retrieval distinguishes incorrect accepted
matches from abstentions; report both alongside recall/overall case pass rate.
Retrieval uses a fixed embedding model, independently of the three assistant model
configurations. Do not describe that as three embedding-model comparisons.

The 20 retrieval examples in `dataset.ts` are development cases used while
building retrieval. They are not proof of the requested held-out 15%-to-5%
improvement.

### Retrieval holdout

`evals/holdout.ts` holds a separate 20-query acceptance set frozen on 2026-09-15
(`retrieval-holdout-v1`), covering exact aliases, cross-language names, semantic
paraphrases, compatible and incompatible units, brand/preparation filters,
ambiguous queries that should abstain, and non-foods. Its content hash is recorded
in `evals/holdout.lock.json`, and `evals/holdout.test.ts` fails if a case changes
without a deliberate new version.

```sh
npm run eval -- --live --suite retrieval --retrieval-set holdout --max-cases 40 --max-usd 1
```

The runner refuses a holdout that differs from its lock, and records the set
name, version and fingerprint. `eval:compare` rejects retrieval reports built from
different case sets or catalogs. Rules: never tune retrieval code against holdout
failures; run the baseline and candidate on the same catalog; retain both reports;
keep failed and unavailable cases. Expected answers for the semantic and
ambiguous categories are product judgements, and the catalog entries themselves
are still `legacy-unverified`.

## Paired user timing study

Recruit five consenting beta testers and define five comparable meal-entry tasks
per tester. Use synthetic meal examples and pseudonymous participant/task IDs.
Counterbalance the order of baseline and candidate interfaces to reduce learning
effects. Define timing from the first entry gesture to a confirmed saved record;
include correction and retry time. Record failures instead of omitting them.

Use JSON rows with `participantId`, `taskId`, `beforeSeconds`, `afterSeconds`,
`beforeCompleted`, `afterCompleted`, and `order` (`before-first` or `after-first`).
Do not commit raw trial files. Run `npx tsx evals/analyzeTrials.ts path/to/trials.json`
to report medians, paired time saved, completion rates and exclusions. A small beta
sample is descriptive evidence, not a claim of general population performance.
