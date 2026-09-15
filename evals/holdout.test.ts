import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { referenceUnit } from '../api/_lib/retrieval'
import { retrievalCases } from './dataset'
import { assertFrozen } from './harness'
import { HOLDOUT_VERSION, retrievalHoldout } from './holdout'

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))

it('matches the committed lock, so edits after freezing are detected', () => {
  expect(() => assertFrozen(retrievalHoldout, read('./holdout.lock.json'), HOLDOUT_VERSION)).not.toThrow()
})

it('is separate from the development cases', () => {
  const key = (c: { query: string; unit?: string; brand?: string; preparation?: string }) => [c.query.trim().toLowerCase(), c.unit ?? '', c.brand ?? '', c.preparation ?? ''].join('|')
  const development = new Set(retrievalCases.map(key))
  expect(retrievalHoldout.filter(c => development.has(key(c)))).toEqual([])
  expect(new Set(retrievalHoldout.map(c => c.id)).size).toBe(retrievalHoldout.length)
  expect(retrievalHoldout).toHaveLength(20)
})

it('expects only canonical catalog names and covers every behaviour category', () => {
  const names = new Set((read('../scripts/foods.json') as { name: string }[]).map(food => food.name))
  expect(retrievalHoldout.filter(c => c.expected !== null && !names.has(c.expected))).toEqual([])
  expect(new Set(retrievalHoldout.map(c => c.category))).toEqual(new Set(['exact-alias', 'cross-language', 'semantic', 'unit-compatible', 'unit-mismatch', 'metadata-filter', 'ambiguous', 'no-match']))
  // Unit-compatible cases must use convertible units; the unknown unit case is the intentional exception.
  expect(retrievalHoldout.filter(c => c.category === 'unit-compatible').every(c => referenceUnit(c.unit))).toBe(true)
  expect(referenceUnit('cup')).toBeUndefined()
})
