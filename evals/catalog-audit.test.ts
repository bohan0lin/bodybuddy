import { expect, it } from 'vitest'
import { auditCatalog } from './catalog-audit.mjs'

it('does not silently certify legacy nutrition or implicit units', () => {
  const report = auditCatalog([{ name: 'fixture', unit: 'g', protein: 70, carbs: 40, fat: 10, calories: 10 }])
  expect(report.entries[0].issues).toEqual(expect.arrayContaining(['unverified-provenance', 'implicit-or-invalid-base-amount', 'macros-exceed-reference-mass', 'review-energy-consistency']))
})

it('distinguishes structural validation from verified nutritional accuracy', () => {
  const report = auditCatalog([{ name: 'fixture', source: 'synthetic', preparation: 'raw', base_amount: 100, unit: 'g', protein: 1, carbs: 1, fat: 0, calories: 8 }])
  expect(report.status).toBe('structural-checks-pass')
  expect(report.sha256).toHaveLength(64)
})
