import { expect, it } from 'vitest'
import { combineFoods, scaleFood } from './foodEntry'

it('preserves a single portion and combines multiple foods as one serving', () => {
  const food = { name: 'Rice', amount: 100, unit: 'g', protein: 3, carbs: 28, fat: 1, calories: 130 }
  expect(combineFoods([])).toBeNull()
  expect(combineFoods([food])).toEqual(food)
  expect(combineFoods([food, food])).toMatchObject({ amount: 1, unit: 'serving', protein: 6, calories: 260 })
  expect(scaleFood(food, 50)).toMatchObject({ amount: 50, calories: 65, protein: 1.5 })
})
