# Catalog audit — 2026-09-21

Scope: the 69 rows in `scripts/foods.json`, not a downloaded production catalog.
Reproduce with `node evals/catalog-audit.mjs`. The per-row report is written to
ignored `evals/results/catalog-audit.json`.

The catalog fingerprint is
`933515e51ebe6eaf949548b701bc540f67b3f83984af2a8934eb6a171fad98ca`.

## Findings

- All 69 rows lack a source citation or source record ID. Similarity to a published
  food table is not evidence of provenance; none is certified as reviewed nutrition.
- All 69 omit `base_amount`; the existing seeder assumes 100. This assumption must
  be made explicit and verified against the original source.
- All 69 omit structured preparation metadata. Names sometimes imply a cooked
  state, but filters cannot reliably recover that information.
- Numeric fields pass finite/nonnegative checks. This does not establish accuracy.
- No row exceeds the audit's coarse energy/mass consistency thresholds. These
  checks deliberately do not replace source review or account for all nutrients.

## Manual review queue

| Entry | Issue | Required resolution |
|---|---|---|
| Egg | Both boiled and fried eggs are aliases of one row | Separate preparation states and cooking oil assumptions |
| Skim milk | Low-fat milk is an alias of skim milk | Separate fat grades using a source record or product label |
| Oats | Dry oats and oatmeal can imply different hydration states | Specify preparation and reference basis |
| Olive oil | Unit is ml, but the 100-fat/884-kcal basis has no volume conversion evidence | Verify mass/volume basis and density before using volume calculations |
| Mushroom | Aliases combine button mushrooms and shiitake | Separate species or require clarification |
| Black beans | Chinese and English names may refer to different legumes | Verify food identity in both languages |
| Generic meat, bread and oil aliases | Broad category queries map to particular reference foods | Review alias specificity separately from semantic matching |
| Mixed dishes | Dumplings, fried rice and salad lack recipe/brand context | Label as recipe estimates or use documented recipes |

No food values, aliases, retrieval thresholds or holdout answers were changed in
this audit. The holdout remains frozen. Future catalog corrections must have a
new fingerprint and both retrieval strategies must be evaluated against that
same corrected catalog. Do not tune corrections to obtain a desired holdout score.

## Evidence boundary

A retrieval experiment using the existing catalog can measure selection behavior
over legacy reference rows. It cannot certify nutritional accuracy. Production
catalog replacement requires traceable sources, reference units, preparation,
brand where relevant, and review of every retained row.

The database-backed experiment is pending because Docker Desktop fails during
Inference Manager startup. No production or staging catalog was modified.
