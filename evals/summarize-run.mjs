import { readFileSync, writeFileSync } from 'node:fs'

const path = process.argv[2]
if (!path || !path.endsWith('.json') || path.endsWith('.summary.json')) throw new Error('Usage: node evals/summarize-run.mjs <report.json>')
const report = JSON.parse(readFileSync(path, 'utf8'))
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null
}
const groups = report.coverage.map(coverage => {
  const rows = report.rows.filter(row => `${row.suite}/${row.config}` === coverage.group)
  const scored = rows.filter(row => row.status !== 'inconclusive')
  return {
    group: coverage.group, complete: coverage.complete, required: coverage.required,
    scored: scored.length, passed: scored.filter(row => row.status === 'pass').length,
    toolCorrect: scored.filter(row => row.toolCorrect).length,
    argumentsCorrect: scored.filter(row => row.argumentsCorrect).length,
    p50Ms: percentile(scored.map(row => row.latencyMs), 0.5),
    p95Ms: percentile(scored.map(row => row.latencyMs), 0.95),
    knownCostUsd: rows.reduce((sum, row) => sum + (row.estimatedUsd ?? 0), 0),
    costComplete: !coverage.unknownSpend,
    failures: rows.filter(row => row.status !== 'pass').map(({ id, status, reason, detail }) => ({ id, status, reason, detail })),
  }
})
const summary = {
  startedAt: report.manifest.startedAt, commit: report.manifest.commit,
  configs: report.manifest.configs, mode: report.manifest.mode,
  complete: report.manifest.mode === 'live' && groups.every(group => group.complete),
  toolRetrieval: report.manifest.toolRetrieval,
  groups,
  limitations: [
    'Small synthetic tool-policy dataset; no image, dialogue-quality or human timing claims.',
    'Tool lookups with source none return no match. This is not a retrieval-quality benchmark.',
    'Latency percentiles describe scored cases only; unavailable and skipped cases remain listed.',
    'Known cost is estimated from reported tokens, not a bill; missing usage is not zero cost.',
    'Incomplete runs do not support a model ranking. Preserve all attempts rather than selecting successful cases.',
  ],
}
writeFileSync(path.replace(/\.json$/, '.summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
