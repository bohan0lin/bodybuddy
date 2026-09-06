import { z } from 'zod'

// Engineering bounds, not recommended dietary targets.
export const nutritionShape = {
  protein: z.number().min(0).max(2000), carbs: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000), calories: z.number().min(0).max(20000),
}
export const macrosSchema = z.object(nutritionShape)
const name = z.string().trim().min(1).max(200)
const unit = z.string().trim().min(1).max(30)
const amount = z.number().positive().max(20000)
export const workoutType = z.enum(['strength', 'run', 'hiit', 'cycling', 'ball', 'swim', 'walk', 'yoga', 'other'])
export const mealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])
export const logInputSchema = z.object({ name, brand: name.optional(), amount: amount.optional(), unit: unit.optional(), mealType, ...nutritionShape })
export const saveInputSchema = z.object({ kind: z.enum(['food', 'meal']), name, brand: name.optional(), unit, baseAmount: amount, ...nutritionShape })
export const workoutInputSchema = z.object({ type: workoutType, note: z.string().max(1000).optional(), durationMin: z.number().positive().max(1440), calories: nutritionShape.calories })
export const actionSchema = z.discriminatedUnion('type', [
  logInputSchema.extend({ type: z.literal('log') }).strict(),
  saveInputSchema.extend({ type: z.literal('save') }).strict(),
  workoutInputSchema.omit({ type: true }).extend({ type: z.literal('workout'), workoutType }).strict(),
])
export const recognitionSchema = z.object({ items: z.array(z.object({ name, amount, unit, ...nutritionShape }).strict()).max(5) }).strict()
export const foodMatchSchema = z.object({ query: name, matched: z.boolean(), name, nameEn: name.nullable(), unit, baseAmount: amount, ...nutritionShape, distance: z.number().min(0).max(2) }).strict()
export const knowledgeSchema = z.object({ relevant: z.boolean(), title: z.string().max(200), content: z.string().max(8000), tags: z.string().max(500) }).strict()
const lang = z.enum(['zh', 'en']).optional()
const clock = { date: z.iso.date(), hour: z.number().int().min(0).max(23) }
export const MAX_BODY_BYTES = 4 * 1024 * 1024
const base64 = z.string().min(4).max(3 * 1024 * 1024).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
const mime = z.enum(['image/jpeg', 'image/png', 'image/webp'])
const imageUrl = z.string().max(3 * 1024 * 1024 + 32).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
export const requests = {
  assistant: z.object({ messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(8000), image: imageUrl.optional() }).strict()).min(1).max(40).refine((messages) => messages.at(-1)?.role === 'user' && messages.every((m) => !m.image || m.role === 'user')), ...clock, lang }).strict(),
  suggest: z.object({ ...clock, mode: z.enum(['general', 'library']).optional(), lang }).strict(),
  recognize: z.object({ image: base64, mediaType: mime, lang }).strict(),
  lookup: z.object({ name }).strict(),
  knowledge: z.object({ text: z.string().trim().min(1).max(8000), lang }).strict(),
}
export const responses = {
  assistant: z.object({ reply: z.string().max(16000), actions: z.array(actionSchema).max(12) }).strict(),
  suggest: z.object({ text: z.string().max(16000) }).strict(),
  recognize: recognitionSchema,
  lookup: z.object({ match: foodMatchSchema.nullable() }).strict(),
  knowledge: knowledgeSchema,
}
export type Endpoint = keyof typeof requests
