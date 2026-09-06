import { expect, it } from 'vitest'
import sharp from 'sharp'
import { actionSchema, foodMatchSchema, requests } from './contracts.js'
import { validateImage } from './image.js'

it.each([-1, NaN, Infinity, 20001])('rejects invalid model nutrition %s', (calories) => {
  expect(actionSchema.safeParse({ type: 'log', name: 'rice', mealType: 'lunch', protein: 1, carbs: 1, fat: 1, calories }).success).toBe(false)
})
it('rejects invalid enums, dates, history size and image URLs', () => {
  expect(requests.suggest.safeParse({ date: '2026-02-30', hour: 12 }).success).toBe(false)
  expect(requests.assistant.safeParse({ date: '2026-09-06', hour: 24, messages: [] }).success).toBe(false)
  expect(requests.assistant.safeParse({ date: '2026-09-06', hour: 12, messages: Array.from({ length: 41 }, () => ({ role: 'user', text: 'hello' })) }).success).toBe(false)
  expect(requests.assistant.safeParse({ date: '2026-09-06', hour: 12, messages: [{ role: 'user', text: '', image: 'https://private-host/photo' }] }).success).toBe(false)
  expect(actionSchema.safeParse({ type: 'workout', workoutType: 'invalid', durationMin: 10, calories: 10 }).success).toBe(false)
  expect(foodMatchSchema.safeParse({ baseAmount: 0 }).success).toBe(false)
})
it('validates actual image format and dimensions', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer()
  await expect(validateImage(png.toString('base64'), 'image/png')).resolves.toBeUndefined()
  await expect(validateImage(png.toString('base64'), 'image/jpeg')).rejects.toMatchObject({ code: 'INVALID_IMAGE' })
  const wide = await sharp({ create: { width: 4097, height: 1, channels: 3, background: 'white' } }).png().toBuffer()
  await expect(validateImage(wide.toString('base64'), 'image/png')).rejects.toMatchObject({ code: 'INVALID_IMAGE' })
  await expect(validateImage(Buffer.from('not an image').toString('base64'), 'image/png')).rejects.toMatchObject({ code: 'INVALID_IMAGE' })
})
