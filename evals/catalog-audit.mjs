import { createHash } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function auditCatalog(rows) {
  const entries = rows.map((row, index) => {
    const issues = []
    if (!row.source || /unverified/i.test(row.source)) issues.push('unverified-provenance')
    if (!Number.isFinite(row.base_amount) || row.base_amount <= 0) issues.push('implicit-or-invalid-base-amount')
    if (!row.preparation) issues.push('unspecified-preparation')
    if (!['g', 'ml'].includes(row.unit)) issues.push('unsupported-reference-unit')
    for (const key of ['protein', 'carbs', 'fat', 'calories']) {
      if (!Number.isFinite(row[key]) || row[key] < 0) issues.push(`invalid-${key}`)
    }
    const base = row.base_amount ?? 100
    if (row.unit === 'g' && row.protein + row.carbs + row.fat > base + 1) issues.push('macros-exceed-reference-mass')
    const kcal = 4 * (row.protein + row.carbs) + 9 * row.fat
    // This is a review flag, not a nutrition correction: fiber and specific factors differ.
    if (Math.abs(kcal - row.calories) > Math.max(20, row.calories * 0.2)) issues.push('review-energy-consistency')
    return { index, name: row.name, nameEn: row.name_en, unit: row.unit, issues }
  })
  return {
    version: 'catalog-audit-v1', rows: rows.length,
    sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    status: entries.some(row => row.issues.length) ? 'review-required' : 'structural-checks-pass',
    issueCounts: Object.fromEntries([...new Set(entries.flatMap(row => row.issues))].sort().map(issue => [issue, entries.filter(row => row.issues.includes(issue)).length])),
    entries,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = auditCatalog(JSON.parse(readFileSync('scripts/foods.json', 'utf8')))
  mkdirSync('evals/results', { recursive: true })
  writeFileSync('evals/results/catalog-audit.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ ...report, entries: undefined }, null, 2))
}
