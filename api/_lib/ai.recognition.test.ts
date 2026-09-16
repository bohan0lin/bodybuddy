import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ generate: vi.fn(), lookup: vi.fn() }))
vi.mock('ai', () => ({ generateObject: mocks.generate, generateText: vi.fn() }))
vi.mock('./rag.js', () => ({ lookupFoods: mocks.lookup }))
import { recognizeFood } from './ai.js'

const label = { name: 'Packaged bread', amount: 100, unit: 'g', energy: 1668, energyUnit: 'kJ', protein: 12, carbs: 46.5, fat: 18.2 }
const bread = { query: 'bread', matched: true, name: 'Whole wheat bread', nameEn: null, baseAmount: 100, unit: 'g', calories: 247, protein: 13, carbs: 43, fat: 3.4, distance: 0 }
beforeEach(() => { vi.clearAllMocks(); mocks.lookup.mockResolvedValue([bread]) })
function extract(mode: string, items = [label]) {
  mocks.generate.mockResolvedValue({ object: { mode, items }, usage: {} })
  return recognizeFood('abcd', 'image/jpeg')
}

it('preserves the screenshot label instead of replacing it with generic bread', async () => {
  expect(await extract('nutrition_label')).toEqual({ labelBased: true, items: [{
    name: label.name, amount: 100, unit: 'g', protein: 12, carbs: 46.5, fat: 18.2, calories: 399,
  }] })
  expect(mocks.lookup).not.toHaveBeenCalled()
})

it.each([{ amount: 30, unit: 'g' }, { amount: 100, unit: 'ml' }, { amount: 1, unit: 'serving' }])('preserves label basis $amount $unit and kcal', async (basis) => {
  const result = await extract('nutrition_label', [{ ...label, ...basis, energy: 120, energyUnit: 'kcal' }])
  expect(result.items[0]).toMatchObject({ ...basis, calories: 120, fat: 18.2 })
  expect(mocks.lookup).not.toHaveBeenCalled()
})

it('does not fill unreadable labels with catalog data even if the model includes estimates', async () => {
  expect(await extract('unreadable_label')).toEqual({ items: [] })
  expect(mocks.lookup).not.toHaveBeenCalled()
})

it('does not combine independent label bases into one meal', async () => {
  expect(await extract('nutrition_label', [label, label])).toEqual({ items: [] })
  expect(mocks.lookup).not.toHaveBeenCalled()
})

it('still scales catalog nutrition for ordinary food photos', async () => {
  const result = await extract('food_photo', [{ ...label, amount: 50, energyUnit: 'kcal' }])
  expect(mocks.lookup).toHaveBeenCalledWith([{ name: label.name, unit: 'g' }], undefined)
  expect(result.items[0]).toMatchObject({ amount: 50, calories: 124, protein: 6.5, carbs: 21.5, fat: 1.7 })
})

it('keeps visual estimates when retrieval fails', async () => {
  mocks.lookup.mockRejectedValue(new Error('offline'))
  expect((await extract('food_photo', [{ ...label, energy: 300, energyUnit: 'kcal' }])).items[0]).toMatchObject({ calories: 300, fat: 18.2 })
})

it('rejects incomplete label extraction instead of inventing missing nutrition', async () => {
  mocks.generate.mockResolvedValue({ object: { mode: 'nutrition_label', items: [{ ...label, fat: undefined }] } })
  await expect(recognizeFood('abcd', 'image/jpeg')).rejects.toThrow()
  expect(mocks.lookup).not.toHaveBeenCalled()
})
