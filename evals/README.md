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

Required provider keys: `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, and/or
`ANTHROPIC_API_KEY`. Retrieval uses only `EVAL_SUPABASE_URL` and
`EVAL_SUPABASE_ANON_KEY`; no production `.env.local` is loaded. The evaluation
catalog must have the new migrations, reviewed metadata, and seeded embeddings.
Set `EVAL_EMBEDDING_MAX_USD_PER_QUERY` to a conservative per-query ceiling; it is
reserved for budget control, not reported as a measured embedding cost.

The case cap is global across suites/configurations. A cap below the complete
matrix intentionally produces inconclusive results. Calls run sequentially with
no automatic retries and a 60-second per-case timeout. Generation cost uses total
reported tokens across tool steps. The budget stops subsequent calls once observed
spend reaches the cap; the final bounded request can exceed it. An unknown charge
halts further generation calls. Configure a provider-side hard limit if required.

Exit codes for live runs: 0 complete/pass, 1 complete/fail, 2 inconclusive. Dry runs
exit successfully for valid configuration but explicitly contain zero scored cases.
Rate limits and infrastructure failures never become successful negative cases.

Tool selection and argument correctness are separate dimensions. Extra actions
fail a no-tool or single-tool request. Retrieval distinguishes incorrect accepted
matches from abstentions; report both alongside recall/overall case pass rate.
Retrieval uses a fixed embedding model, independently of the three assistant model
configurations. Do not describe that as three embedding-model comparisons.

The 20 retrieval examples in `dataset.ts` are authored validation cases. They are
not proof of the requested held-out 15%-to-5% improvement. Freeze and hash a separate
holdout before tuning, run baseline and candidate on the same catalog, retain both
reports, and do not silently exclude failed/unavailable cases. The comparison tool
rejects incomplete or mismatched datasets.

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
