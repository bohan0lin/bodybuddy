import { expect, it } from 'vitest'
import { nutritionRatio, selectCandidate } from './retrieval.js'
it('converts compatible mass and volume units', () => {
  expect(nutritionRatio(0.2, 'kg', 100, 'g')).toBe(2)
  expect(nutritionRatio(0.25, 'l', 100, 'ml')).toBe(2.5)
  expect(nutritionRatio(200, '克', 100, 'g')).toBe(2)
})
it('never treats grams, milliliters and arbitrary servings as interchangeable', () => {
  expect(nutritionRatio(100, 'g', 100, 'ml')).toBeNull()
  expect(nutritionRatio(1, 'serving', 100, 'g')).toBeNull()
  expect(nutritionRatio(1, 'g', 0, 'g')).toBeNull()
  expect(nutritionRatio(NaN, 'g', 100, 'g')).toBeNull()
})
it('rejects ambiguous exact and near-tied semantic matches', () => {
  expect(selectCandidate([{ distance: 0 }, { distance: 0 }], true)).toBeNull()
  expect(selectCandidate([{ distance: 0.1 }, { distance: 0.12 }])).toBeNull()
  expect(selectCandidate([{ distance: 0.8 }])).toBeNull()
  expect(selectCandidate([{ distance: 0.1 }, { distance: 0.4 }])).toEqual({ distance: 0.1 })
})
