# Evaluation status — 2026-09-21

## Completed preparation

- Audited all 69 seed foods; see [catalog audit](CATALOG_AUDIT.md). Structural
  checks pass, but source provenance, reference basis and preparation need review.
- Verified access to three Gemini model IDs and recorded standard-tier pricing
  in `evals/models.google.json` (verification date: 2026-09-19).
- Added a provider-key-only local runner, safe failure classification and a
  summary containing tool/argument correctness, latency and known token costs.
- Retained the frozen retrieval holdout unchanged. No retrieval code, catalog
  values, application behavior or database schema changed in this work.
- Sixteen targeted tests and lint passed. A direct dry run validated the matrix
  and correctly reported absent shell credentials without loading `.env.local`.

## Actual model runs

Both runs used the same 12 synthetic tool-policy cases per model and a $0.50
observed-spend allowance split across three groups. Tools returned proposals
only. No application database was queried; injected nutrition lookups returned
no match. Generation had no automatic retries.

| Attempt | Model | Scored / 12 | Passed | Known estimated USD | Outcome |
|---|---|---:|---:|---:|---|
| September 19 | Gemini 3.5 Flash-Lite | 10 | 10 | 0.00673130 | Incomplete |
| September 19 | Gemini 3.6 Flash | 3 | 3 | 0.01298700 | Incomplete |
| September 19 | Gemini 3.8 Flash | 0 | 0 | 0 | Incomplete; cost unknown |
| September 21 | Gemini 3.5 Flash-Lite | 0 | 0 | 0 | First case timed out |
| September 21 | Gemini 3.6 Flash | 0 | 0 | 0 | HTTP 503 AI_UNAVAILABLE |
| September 21 | Gemini 3.8 Flash | 1 | 1 | 0.00408825 | Next case HTTP 503 AI_UNAVAILABLE |

Known reported-token cost across both attempts is $0.02380655. This is **not**
the total bill: failed requests did not report usage. Unknown-cost requests
stopped their groups; the budget was not necessarily exhausted. The first
report's generic budget explanation predates the clearer stop-reason patch.

The runner records 100% pass among scored rows, but coverage is incomplete.
Do not present this as 100% reliability, rank these models, combine successful
rows from different attempts, or claim a completed three-model comparison.
Scoring covers proposal tool choice and selected argument fields; it does not
judge conversational reply quality, photos, retrieval quality or user speed.

Raw reports are retained in `docs/evidence/` with file hashes, synthetic case IDs,
usage and timings. Both record base commit `da9f9d4` and a dirty worktree. The
second also fingerprints the runner and safe error classifier. No keys, request
bodies, real user messages or model replies are in these reports.

## Retrieval experiment

Not run. Docker Desktop failed during Inference Manager startup, leaving the
isolated local database unavailable. No production/staging catalog was used as
a substitute. Existing seed rows are not yet verified nutrition references.

Once an isolated evaluation database is available:

1. Review and source catalog entries, making reference amounts and preparation
   explicit. Record the catalog version independently of holdout outcomes.
2. Seed that isolated catalog with 768-dimensional `gemini-embedding-001`
   document embeddings. Do not run the destructive legacy seeder against an
   application database.
3. Set `EVAL_SUPABASE_URL`, `EVAL_SUPABASE_ANON_KEY` and
   `EVAL_EMBEDDING_MAX_USD_PER_QUERY` in the local environment.
4. Run both retrieval strategies in one invocation against the locked holdout:
   `node --import tsx evals/local-run.mjs --live --suite retrieval --retrieval-set holdout --max-cases 40 --max-usd 0.5`.
5. Keep wrong accepted matches, abstentions and infrastructure failures separate.
   The vector/hybrid comparison is an ablation under shared filters, not a
   historical old-pipeline comparison. Report observed numbers, not target numbers.

When provider service is stable, rerun the complete model matrix using the
command in `evals/README.md`. Keep these failed attempts alongside later results.
No further live calls should be needed to review this evidence package.
